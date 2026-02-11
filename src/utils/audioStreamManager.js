// audioStreamManager.js — Continuous audio stream with white noise + TTS speech
//
// Architecture (CARD-088):
//   [Noise <audio> element] --> plays DIRECTLY through speakers (no AudioContext)
//                               Volume: element.volume = NOISE_GAIN * _volume
//                               Keeps OS audio session alive on lock screen
//
//   [TTS <audio> element]   --> plays DIRECTLY through speakers (no AudioContext)
//                               Volume: element.volume = _volume
//                               Survives lock screen (not captured by AudioContext)
//                               |
//                               +--> [captureStream()] --> [MediaStreamSource] --> [analyser]
//                                    (optional, for waveform visualization only)
//                                    (gracefully skipped if captureStream unavailable)
//
// CRITICAL: Neither audio element uses createMediaElementSource(). When an
// <audio> element is captured by createMediaElementSource(), its output goes
// exclusively through the AudioContext graph. When the OS suspends the
// AudioContext on lock screen, captured elements stop or loop — defeating the
// purpose. By keeping BOTH elements as standalone <audio> elements, the OS
// recognizes them as real media playback and keeps the audio session alive.

const NOISE_GAIN_ACTIVE = 0.02;
const NOISE_GAIN_DUCKED = 0.005;
const NOISE_BUFFER_SECONDS = 2;

export default class AudioStreamManager {
  constructor() {
    this._ctx = null;
    this._noiseAudio = null;     // HTMLAudioElement for looping white noise (standalone, no AudioContext)
    this._noiseBlobUrl = null;
    this._analyser = null;
    this._speechAudio = null;    // HTMLAudioElement for TTS playback (standalone, no AudioContext)
    this._speechStreamSource = null; // MediaStreamSource for captureStream() visualization (optional)
    this._currentBlobUrl = null;
    this._queue = [];
    this._playing = false;
    this._active = false;
    this._speed = 1.0;
    this._volume = 1.0;
    this._onError = null;
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    this._handleEnded = this._handleEnded.bind(this);
    this._handleError = this._handleError.bind(this);
  }

  get active() {
    return this._active;
  }

  get speed() {
    return this._speed;
  }

  get volume() {
    return this._volume;
  }

  getAnalyserNode() {
    return this._analyser;
  }

  setOnError(cb) {
    this._onError = cb;
  }

  /**
   * Start the continuous audio stream. Must be called from a user gesture.
   */
  start() {
    if (this._active) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      this._emitError("Web Audio API not supported");
      return;
    }

    this._ctx = new AudioCtx();
    this._active = true;

    // Analyser node for waveform visualization (fed by captureStream, not by gain chain)
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 256;

    // Generate and start looping white noise (standalone <audio>, no AudioContext)
    this._startNoise();

    // Create the speech <audio> element (standalone, no AudioContext capture).
    // Speech plays directly through speakers so it survives lock screen.
    // Optional: captureStream() feeds the analyser for waveform visualization.
    this._initSpeechAudio();

    // Media Session API — registers metadata so the OS shows lock screen controls
    this._setupMediaSession();

    // Resume AudioContext if the page becomes visible again after suspension
    document.addEventListener("visibilitychange", this._handleVisibilityChange);
  }

  /**
   * Stop the audio stream and clean up.
   */
  stop() {
    if (!this._active) return;
    this._active = false;
    this._queue = [];
    this._playing = false;

    document.removeEventListener("visibilitychange", this._handleVisibilityChange);

    if (this._speechAudio) {
      this._speechAudio.removeEventListener("ended", this._handleEnded);
      this._speechAudio.removeEventListener("error", this._handleError);
      try { this._speechAudio.pause(); } catch { /* jsdom */ }
      this._speechAudio.removeAttribute("src");
      try { this._speechAudio.parentNode?.removeChild(this._speechAudio); } catch { /* ok */ }
      this._speechAudio = null;
    }
    this._revokeBlobUrl();
    this._speechStreamSource = null;

    if (this._noiseAudio) {
      try { this._noiseAudio.pause(); } catch { /* jsdom */ }
      this._noiseAudio.removeAttribute("src");
      try { this._noiseAudio.parentNode?.removeChild(this._noiseAudio); } catch { /* ok */ }
      this._noiseAudio = null;
    }
    if (this._noiseBlobUrl) {
      try { URL.revokeObjectURL(this._noiseBlobUrl); } catch { /* ok */ }
      this._noiseBlobUrl = null;
    }

    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
    }

    this._analyser = null;
  }

  /**
   * Set master volume (0 to 1).
   */
  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    // Apply volume directly to audio elements (no AudioContext gain chain)
    if (this._speechAudio) {
      this._speechAudio.volume = this._volume;
    }
    if (this._noiseAudio) {
      // Scale noise volume relative to its base level
      this._noiseAudio.volume = (this._playing ? NOISE_GAIN_DUCKED : NOISE_GAIN_ACTIVE) * this._volume;
    }
  }

  /**
   * Set playback speed (0.5 to 2.0). Affects current and queued speech.
   */
  setSpeed(speed) {
    this._speed = Math.max(0.5, Math.min(2.0, speed));
    // Apply to currently playing audio element
    if (this._speechAudio) {
      this._speechAudio.playbackRate = this._speed;
    }
  }

  /**
   * Queue speech audio data (ArrayBuffer of WAV) for playback.
   */
  queueSpeech(audioData) {
    if (!this._active || !this._ctx) return;
    this._queue.push(audioData);
    if (!this._playing) {
      this._processQueue();
    }
  }

  // --------------- Internal ---------------

  /**
   * Fix WAV header sizes when the server used 0xFFFFFFFF (streaming/unknown length).
   * Some browsers require correct sizes to play WAV via <audio> element.
   */
  _fixWavHeader(arrayBuffer) {
    if (arrayBuffer.byteLength < 44) return arrayBuffer;

    const view = new DataView(arrayBuffer);

    // Check RIFF magic
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (riff !== "RIFF") return arrayBuffer;

    const riffSize = view.getUint32(4, true);
    const dataSize = view.getUint32(40, true);

    // Only patch if sizes are 0xFFFFFFFF (streaming placeholder)
    if (riffSize === 0xFFFFFFFF || dataSize === 0xFFFFFFFF) {
      const totalBytes = arrayBuffer.byteLength;
      view.setUint32(4, totalBytes - 8, true);   // RIFF chunk size = file size - 8
      view.setUint32(40, totalBytes - 44, true);  // data chunk size = file size - 44
    }

    return arrayBuffer;
  }

  _emitError(msg) {
    if (this._onError) this._onError(msg);
  }

  _revokeBlobUrl() {
    if (this._currentBlobUrl) {
      try { URL.revokeObjectURL(this._currentBlobUrl); } catch { /* ok */ }
      this._currentBlobUrl = null;
    }
  }

  _initSpeechAudio() {
    if (typeof document === "undefined") return;

    this._speechAudio = document.createElement("audio");
    this._speechAudio.preload = "auto";
    this._speechAudio.volume = this._volume;
    this._speechAudio.addEventListener("ended", this._handleEnded);
    this._speechAudio.addEventListener("error", this._handleError);

    // Append to DOM — mobile browsers require <audio> elements in the document.
    this._speechAudio.style.display = "none";
    document.body.appendChild(this._speechAudio);

    // CARD-088: Do NOT use createMediaElementSource() — it captures the element
    // exclusively into the AudioContext graph. When the OS suspends the
    // AudioContext on lock screen, captured elements loop/stall instead of
    // playing through. Speech must play directly through the <audio> element.
    //
    // For waveform visualization, try captureStream() which creates a parallel
    // copy of the audio without redirecting the element's output. This is
    // optional — captureStream() is not available on all browsers (notably
    // iOS Safari), so we gracefully skip if unavailable.
    try {
      if (typeof this._speechAudio.captureStream === "function") {
        const stream = this._speechAudio.captureStream();
        this._speechStreamSource = this._ctx.createMediaStreamSource(stream);
        this._speechStreamSource.connect(this._analyser);
      }
    } catch {
      // captureStream not available — visualization won't reflect speech,
      // but playback works fine without it.
    }
  }

  _startNoise() {
    if (!this._ctx || typeof document === "undefined") return;

    // Generate white noise as a WAV file and play it through an <audio> element
    // so the OS treats it as real media playback (survives lock screen).
    const sampleRate = 22050; // Low rate is fine for noise — smaller file
    const numSamples = sampleRate * NOISE_BUFFER_SECONDS;
    const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);

    // WAV header
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);     // PCM
    view.setUint16(22, 1, true);     // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byteRate
    view.setUint16(32, 2, true);     // blockAlign
    view.setUint16(34, 16, true);    // bitsPerSample
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);

    // White noise samples
    for (let i = 0; i < numSamples; i++) {
      view.setInt16(44 + i * 2, Math.floor((Math.random() * 2 - 1) * 32767), true);
    }

    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    this._noiseBlobUrl = URL.createObjectURL(blob);

    this._noiseAudio = document.createElement("audio");
    this._noiseAudio.loop = true;
    this._noiseAudio.preload = "auto";
    this._noiseAudio.src = this._noiseBlobUrl;

    // Set noise volume directly on the element (not through AudioContext).
    // This is intentional: neither audio element uses createMediaElementSource()
    // because captured elements stop/loop when the OS suspends the AudioContext
    // on lock screen. Standalone <audio> elements keep the OS audio session alive.
    this._noiseAudio.volume = NOISE_GAIN_ACTIVE * this._volume;

    // Append to DOM — mobile browsers require <audio> elements in the document.
    this._noiseAudio.style.display = "none";
    document.body.appendChild(this._noiseAudio);

    this._noiseAudio.play().catch(() => {});
  }

  _duckNoise() {
    if (!this._noiseAudio) return;
    this._noiseAudio.volume = NOISE_GAIN_DUCKED * this._volume;
  }

  _unduckNoise() {
    if (!this._noiseAudio) return;
    this._noiseAudio.volume = NOISE_GAIN_ACTIVE * this._volume;
  }

  _handleEnded() {
    this._unduckNoise();
    this._revokeBlobUrl();
    this._processQueue();
  }

  _handleError() {
    this._emitError("Audio playback error");
    this._unduckNoise();
    this._revokeBlobUrl();
    this._processQueue();
  }

  _processQueue() {
    if (this._queue.length === 0 || !this._active) {
      this._playing = false;
      return;
    }

    this._playing = true;
    const audioData = this._queue.shift();

    // Fix WAV header and create Blob URL for the <audio> element
    const fixed = this._fixWavHeader(audioData.slice(0));
    const blob = new Blob([fixed], { type: "audio/wav" });
    this._revokeBlobUrl();
    this._currentBlobUrl = URL.createObjectURL(blob);

    this._duckNoise();

    this._speechAudio.src = this._currentBlobUrl;
    this._speechAudio.volume = this._volume;
    this._speechAudio.playbackRate = this._speed;

    this._speechAudio.play().then(() => {
      // Reapply playbackRate after play starts (iOS Safari workaround)
      this._speechAudio.playbackRate = this._speed;

      // Update Media Session playback state
      if (typeof navigator !== "undefined" && navigator.mediaSession) {
        navigator.mediaSession.playbackState = "playing";
      }
    }).catch((err) => {
      this._emitError("Audio playback error: " + err.message);
      this._unduckNoise();
      this._revokeBlobUrl();
      this._processQueue();
    });
  }

  _setupMediaSession() {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: "SwarmCode Audio Stream",
      artist: "SwarmCode",
    });

    navigator.mediaSession.setActionHandler("play", () => {
      if (this._ctx && this._ctx.state === "suspended") {
        this._ctx.resume().catch(() => {});
      }
      if (this._noiseAudio && this._noiseAudio.paused) {
        this._noiseAudio.play().catch(() => {});
      }
      if (this._speechAudio && this._speechAudio.paused && this._currentBlobUrl) {
        this._speechAudio.play().catch(() => {});
      }
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      // Intentionally empty — prevent the OS from pausing our stream.
      // The user stops playback via the in-app Stop button.
    });
  }

  _handleVisibilityChange() {
    if (document.visibilityState !== "visible" || !this._active) return;

    // Page became visible again — resume AudioContext if the OS suspended it
    if (this._ctx && this._ctx.state === "suspended") {
      this._ctx.resume().catch(() => {});
    }
    // Resume noise if it was paused
    if (this._noiseAudio && this._noiseAudio.paused) {
      this._noiseAudio.play().catch(() => {});
    }
  }
}

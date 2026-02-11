// audioStreamManager.js — Continuous audio stream with white noise + TTS speech
//
// CARD-090: Entire AudioStreamManager commented out — switching to browser speechSynthesis.
// Code preserved for potential future reuse (Piper server-side TTS).

/* CARD-090: Commented out — browser TTS replaces server-side Piper + AudioStreamManager

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
    this._noiseAudio = null;
    this._noiseBlobUrl = null;
    this._analyser = null;
    this._speechAudio = null;
    this._speechStreamSource = null;
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

  start() {
    if (this._active) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      this._emitError("Web Audio API not supported");
      return;
    }

    this._ctx = new AudioCtx();
    this._active = true;

    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 256;

    this._startNoise();
    this._initSpeechAudio();
    this._setupMediaSession();

    document.addEventListener("visibilitychange", this._handleVisibilityChange);
  }

  stop() {
    if (!this._active) return;
    this._active = false;
    this._queue = [];
    this._playing = false;

    document.removeEventListener("visibilitychange", this._handleVisibilityChange);

    if (this._speechAudio) {
      this._speechAudio.removeEventListener("ended", this._handleEnded);
      this._speechAudio.removeEventListener("error", this._handleError);
      try { this._speechAudio.pause(); } catch { }
      this._speechAudio.removeAttribute("src");
      try { this._speechAudio.parentNode?.removeChild(this._speechAudio); } catch { }
      this._speechAudio = null;
    }
    this._revokeBlobUrl();
    this._speechStreamSource = null;

    if (this._noiseAudio) {
      try { this._noiseAudio.pause(); } catch { }
      this._noiseAudio.removeAttribute("src");
      try { this._noiseAudio.parentNode?.removeChild(this._noiseAudio); } catch { }
      this._noiseAudio = null;
    }
    if (this._noiseBlobUrl) {
      try { URL.revokeObjectURL(this._noiseBlobUrl); } catch { }
      this._noiseBlobUrl = null;
    }

    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
    }

    this._analyser = null;
  }

  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this._speechAudio) {
      this._speechAudio.volume = this._volume;
    }
    if (this._noiseAudio) {
      this._noiseAudio.volume = (this._playing ? NOISE_GAIN_DUCKED : NOISE_GAIN_ACTIVE) * this._volume;
    }
  }

  setSpeed(speed) {
    this._speed = Math.max(0.5, Math.min(2.0, speed));
    if (this._speechAudio) {
      this._speechAudio.playbackRate = this._speed;
    }
  }

  queueSpeech(audioData) {
    if (!this._active || !this._ctx) return;
    this._queue.push(audioData);
    if (!this._playing) {
      this._processQueue();
    }
  }

  _fixWavHeader(arrayBuffer) {
    if (arrayBuffer.byteLength < 44) return arrayBuffer;
    const view = new DataView(arrayBuffer);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (riff !== "RIFF") return arrayBuffer;
    const riffSize = view.getUint32(4, true);
    const dataSize = view.getUint32(40, true);
    if (riffSize === 0xFFFFFFFF || dataSize === 0xFFFFFFFF) {
      const totalBytes = arrayBuffer.byteLength;
      view.setUint32(4, totalBytes - 8, true);
      view.setUint32(40, totalBytes - 44, true);
    }
    return arrayBuffer;
  }

  _emitError(msg) {
    if (this._onError) this._onError(msg);
  }

  _revokeBlobUrl() {
    if (this._currentBlobUrl) {
      try { URL.revokeObjectURL(this._currentBlobUrl); } catch { }
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
    this._speechAudio.style.display = "none";
    document.body.appendChild(this._speechAudio);
    try {
      if (typeof this._speechAudio.captureStream === "function") {
        const stream = this._speechAudio.captureStream();
        this._speechStreamSource = this._ctx.createMediaStreamSource(stream);
        this._speechStreamSource.connect(this._analyser);
      }
    } catch { }
  }

  _startNoise() {
    if (!this._ctx || typeof document === "undefined") return;
    const sampleRate = 22050;
    const numSamples = sampleRate * NOISE_BUFFER_SECONDS;
    const dataSize = numSamples * 2;
    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);
    for (let i = 0; i < numSamples; i++) {
      view.setInt16(44 + i * 2, Math.floor((Math.random() * 2 - 1) * 32767), true);
    }
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    this._noiseBlobUrl = URL.createObjectURL(blob);
    this._noiseAudio = document.createElement("audio");
    this._noiseAudio.loop = true;
    this._noiseAudio.preload = "auto";
    this._noiseAudio.src = this._noiseBlobUrl;
    this._noiseAudio.volume = NOISE_GAIN_ACTIVE * this._volume;
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
    const fixed = this._fixWavHeader(audioData.slice(0));
    const blob = new Blob([fixed], { type: "audio/wav" });
    this._revokeBlobUrl();
    this._currentBlobUrl = URL.createObjectURL(blob);
    this._duckNoise();
    this._speechAudio.src = this._currentBlobUrl;
    this._speechAudio.volume = this._volume;
    this._speechAudio.playbackRate = this._speed;
    this._speechAudio.play().then(() => {
      this._speechAudio.playbackRate = this._speed;
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
    navigator.mediaSession.setActionHandler("pause", () => {});
  }

  _handleVisibilityChange() {
    if (document.visibilityState !== "visible" || !this._active) return;
    if (this._ctx && this._ctx.state === "suspended") {
      this._ctx.resume().catch(() => {});
    }
    if (this._noiseAudio && this._noiseAudio.paused) {
      this._noiseAudio.play().catch(() => {});
    }
  }
}

END OF COMMENTED-OUT CODE */

// CARD-090: Stub class so imports don't crash.
// StreamView and MessagesView import this — they will be updated in Phases 7/8.
export default class AudioStreamManager {
  get active() { return false; }
  get speed() { return 1.0; }
  get volume() { return 1.0; }
  getAnalyserNode() { return null; }
  setOnError() {}
  start() {}
  stop() {}
  setVolume() {}
  setSpeed() {}
  queueSpeech() {}
}

// audioStreamManager.js — Continuous Web Audio stream with white noise + speech mixing
//
// Architecture (from arch_tts_streaming.txt v2):
//   [Silent <audio> element] --> [MediaElementSource] --> [GainNode: 0] --+
//   [Static Noise Generator] --> [GainNode: 0.02] -----------------------+
//                                                                          +--> [GainNode: master vol] --> destination
//   [Speech AudioBuffer]     --> [GainNode: 1.0]  -----------------------+
//
// The silent <audio> element grants background playback privileges from the
// HTMLMediaElement to the entire AudioContext, preventing the OS from suspending
// audio when the phone screen is locked (iOS Safari + Chrome Android).
// Media Session API registers metadata so the OS shows lock screen controls.

const NOISE_GAIN_ACTIVE = 0.02;
const NOISE_GAIN_DUCKED = 0.005;
const NOISE_BUFFER_SECONDS = 2;
const DUCK_FADE_TIME = 0.15; // seconds for gain ramp

// Minimal silent MP3 (~200 bytes) — enough for a looping silent audio element.
// This keeps the HTMLMediaElement "playing" so the OS won't suspend the AudioContext.
const SILENT_MP3_BASE64 =
  "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwBHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwBHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export default class AudioStreamManager {
  constructor() {
    this._ctx = null;
    this._noiseSource = null;
    this._noiseGain = null;
    this._speechGain = null;
    this._masterGain = null;
    this._analyser = null;
    this._silentAudio = null;
    this._silentSource = null;
    this._silentGain = null;
    this._queue = [];
    this._playing = false;
    this._active = false;
    this._speed = 1.0;
    this._volume = 1.0;
    this._onError = null;
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
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

    // Master gain (volume control)
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._volume;
    this._masterGain.connect(this._ctx.destination);

    // Analyser node for waveform visualization
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 256;
    this._masterGain.connect(this._analyser);

    // Speech gain
    this._speechGain = this._ctx.createGain();
    this._speechGain.gain.value = 1.0;
    this._speechGain.connect(this._masterGain);

    // Noise gain
    this._noiseGain = this._ctx.createGain();
    this._noiseGain.gain.value = NOISE_GAIN_ACTIVE;
    this._noiseGain.connect(this._masterGain);

    // Generate and start looping white noise
    this._startNoise();

    // Silent <audio> element keeps the AudioContext alive when the phone is locked.
    // HTMLMediaElement has OS-level background playback privileges that extend to
    // any AudioContext it's connected to via createMediaElementSource().
    this._startSilentAudio();

    // Media Session API tells the OS this is a media player, enabling lock screen
    // controls and preventing aggressive audio suspension on iOS/Android.
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

    if (this._silentAudio) {
      try { this._silentAudio.pause(); } catch { /* jsdom */ }
      this._silentAudio.removeAttribute("src");
      this._silentAudio = null;
    }
    this._silentSource = null;
    this._silentGain = null;

    if (this._noiseSource) {
      try {
        this._noiseSource.stop();
      } catch {
        // already stopped
      }
      this._noiseSource = null;
    }

    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
    }

    this._noiseGain = null;
    this._speechGain = null;
    this._masterGain = null;
    this._analyser = null;
  }

  /**
   * Set master volume (0 to 1).
   */
  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this._masterGain && this._ctx) {
      this._masterGain.gain.setValueAtTime(
        this._volume,
        this._ctx.currentTime
      );
    }
  }

  /**
   * Set playback speed (0.5 to 2.0). Affects queued speech buffers.
   */
  setSpeed(speed) {
    this._speed = Math.max(0.5, Math.min(2.0, speed));
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

  _emitError(msg) {
    if (this._onError) this._onError(msg);
  }

  _startNoise() {
    if (!this._ctx) return;

    const sampleRate = this._ctx.sampleRate;
    const length = sampleRate * NOISE_BUFFER_SECONDS;
    const buffer = this._ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._noiseSource = this._ctx.createBufferSource();
    this._noiseSource.buffer = buffer;
    this._noiseSource.loop = true;
    this._noiseSource.connect(this._noiseGain);
    this._noiseSource.start();
  }

  _duckNoise() {
    if (!this._noiseGain || !this._ctx) return;
    this._noiseGain.gain.linearRampToValueAtTime(
      NOISE_GAIN_DUCKED,
      this._ctx.currentTime + DUCK_FADE_TIME
    );
  }

  _unduckNoise() {
    if (!this._noiseGain || !this._ctx) return;
    this._noiseGain.gain.linearRampToValueAtTime(
      NOISE_GAIN_ACTIVE,
      this._ctx.currentTime + DUCK_FADE_TIME
    );
  }

  async _processQueue() {
    if (this._queue.length === 0 || !this._active) {
      this._playing = false;
      return;
    }

    this._playing = true;
    const audioData = this._queue.shift();

    try {
      const audioBuffer = await this._ctx.decodeAudioData(audioData.slice(0));
      this._duckNoise();

      const source = this._ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = this._speed;
      source.connect(this._speechGain);

      source.onended = () => {
        this._unduckNoise();
        this._processQueue();
      };

      source.start();
    } catch (err) {
      this._emitError("Audio decode error: " + err.message);
      this._unduckNoise();
      this._processQueue();
    }
  }

  _startSilentAudio() {
    if (!this._ctx || typeof document === "undefined") return;

    this._silentAudio = document.createElement("audio");
    this._silentAudio.loop = true;
    // Volume must be > 0 for iOS to grant background privileges; route through
    // a zero-gain node instead so no actual sound is produced.
    this._silentAudio.volume = 1.0;
    this._silentAudio.src = "data:audio/mp3;base64," + SILENT_MP3_BASE64;

    try {
      this._silentSource = this._ctx.createMediaElementSource(this._silentAudio);
      this._silentGain = this._ctx.createGain();
      this._silentGain.gain.value = 0;
      this._silentSource.connect(this._silentGain);
      this._silentGain.connect(this._masterGain);
    } catch {
      // createMediaElementSource not available (e.g. test env) — fall back to
      // noise-only keep-alive which still works on desktop browsers.
      return;
    }

    this._silentAudio.play().catch(() => {
      // Autoplay blocked — the user gesture that called start() should have
      // already unlocked playback, but some browsers are stricter.
    });
  }

  _setupMediaSession() {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: "SwarmCode Audio Stream",
      artist: "SwarmCode",
    });

    navigator.mediaSession.setActionHandler("play", () => {
      if (this._silentAudio && this._silentAudio.paused) {
        this._silentAudio.play().catch(() => {});
      }
      if (this._ctx && this._ctx.state === "suspended") {
        this._ctx.resume().catch(() => {});
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
    if (this._silentAudio && this._silentAudio.paused) {
      this._silentAudio.play().catch(() => {});
    }
  }
}

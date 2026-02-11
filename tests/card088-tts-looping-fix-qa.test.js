/**
 * CARD-088 QA Tests — TTS looping on lock screen fix
 * Author: qa-1
 * Date: 2026-02-11
 *
 * Root cause: Speech <audio> was captured by createMediaElementSource(), which
 * routes output exclusively through AudioContext. When the OS suspends the
 * AudioContext on lock screen, the captured speech element loops/stalls a ~1s
 * clip instead of playing through.
 *
 * Fix: Speech <audio> now plays DIRECTLY through speakers (no AudioContext
 * capture). Volume via element.volume. Optional captureStream() feeds the
 * analyser for waveform visualization without redirecting audio output.
 *
 * Architecture (CARD-088):
 *   [Noise <audio>]  -> plays directly (element.volume = NOISE_GAIN * _volume)
 *   [TTS <audio>]    -> plays directly (element.volume = _volume)
 *                        +--> captureStream() -> MediaStreamSource -> analyser
 *                             (optional, graceful fallback)
 */

import AudioStreamManager from "../src/utils/audioStreamManager";

// ─── Web Audio API mocks ─────────────────────────────────────────────────────

function createMockGainNode() {
  return {
    gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
}

function createMockAnalyser() {
  return { fftSize: 0, connect: jest.fn(), disconnect: jest.fn() };
}

function createMockMediaStreamSource() {
  return { connect: jest.fn() };
}

function createMockAudioElement() {
  return {
    loop: false,
    src: "",
    preload: "",
    paused: false,
    playbackRate: 1,
    volume: 1,
    style: {},
    parentNode: null,
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
    removeAttribute: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
}

function createMockAudioContext() {
  return {
    sampleRate: 44100,
    currentTime: 0,
    state: "running",
    destination: { name: "destination" },
    createGain: jest.fn(() => createMockGainNode()),
    createAnalyser: jest.fn(() => createMockAnalyser()),
    createMediaElementSource: jest.fn(),
    createMediaStreamSource: jest.fn(() => createMockMediaStreamSource()),
    close: jest.fn(() => Promise.resolve()),
    resume: jest.fn(() => Promise.resolve()),
  };
}

let mockCtx;

beforeEach(() => {
  mockCtx = createMockAudioContext();
  window.AudioContext = jest.fn(() => mockCtx);

  const origCreateElement = document.createElement.bind(document);
  jest.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag === "audio") return createMockAudioElement();
    return origCreateElement(tag);
  });

  jest.spyOn(document.body, "appendChild").mockImplementation((el) => {
    if (el && el.play) el.parentNode = document.body;
    return el;
  });
  jest.spyOn(document.body, "removeChild").mockImplementation((el) => {
    if (el) el.parentNode = null;
    return el;
  });
});

afterEach(() => {
  delete window.AudioContext;
  delete window.webkitAudioContext;
  jest.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Core fix: speech NOT captured by createMediaElementSource
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-088 QA: speech decoupled from AudioContext", () => {
  test("createMediaElementSource is never called (0 times)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mockCtx.createMediaElementSource).toHaveBeenCalledTimes(0);
  });

  test("speech audio plays directly with element.volume = 1.0", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._speechAudio.volume).toBe(1.0);
  });

  test("no gain nodes created (0 createGain calls)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mockCtx.createGain).toHaveBeenCalledTimes(0);
  });

  test("_speechSource, _speechGain, _masterGain removed from instance", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._speechSource).toBeUndefined();
    expect(mgr._speechGain).toBeUndefined();
    expect(mgr._masterGain).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Volume control via element.volume
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-088 QA: volume via element.volume", () => {
  test("setVolume updates speech element volume", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.setVolume(0.5);
    expect(mgr._speechAudio.volume).toBe(0.5);
  });

  test("setVolume updates noise element volume (scaled by NOISE_GAIN_ACTIVE)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.setVolume(0.5);
    // Noise: NOISE_GAIN_ACTIVE (0.02) * volume (0.5) = 0.01
    expect(mgr._noiseAudio.volume).toBe(0.01);
  });

  test("noise volume respects ducking state when setVolume is called during speech", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.queueSpeech(new ArrayBuffer(100)); // starts playing, ducks noise

    // Now change volume while ducked
    mgr.setVolume(0.5);
    // Should use NOISE_GAIN_DUCKED (0.005) * 0.5 = 0.0025
    expect(mgr._noiseAudio.volume).toBe(0.0025);
  });

  test("speech volume set to _volume in _processQueue before play", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.setVolume(0.7);
    mgr.queueSpeech(new ArrayBuffer(100));
    expect(mgr._speechAudio.volume).toBe(0.7);
  });

  test("noise volume includes _volume factor on start", () => {
    const mgr = new AudioStreamManager();
    mgr.setVolume(0.5);
    mgr.start();
    // NOISE_GAIN_ACTIVE (0.02) * _volume (0.5) = 0.01
    expect(mgr._noiseAudio.volume).toBe(0.01);
  });

  test("noise ducking scales by _volume", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.setVolume(0.5);

    mgr.queueSpeech(new ArrayBuffer(100));
    // NOISE_GAIN_DUCKED (0.005) * 0.5 = 0.0025
    expect(mgr._noiseAudio.volume).toBe(0.0025);

    mgr._handleEnded();
    // NOISE_GAIN_ACTIVE (0.02) * 0.5 = 0.01
    expect(mgr._noiseAudio.volume).toBe(0.01);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// captureStream() for optional visualization
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-088 QA: captureStream visualization path", () => {
  test("uses captureStream when available on speech element", () => {
    const mockStream = { id: "mock-stream" };
    const origCreate = document.createElement;

    // Override to add captureStream to speech audio
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "audio") {
        const el = createMockAudioElement();
        el.captureStream = jest.fn(() => mockStream);
        return el;
      }
      return origCreate.call(document, tag);
    });

    const mgr = new AudioStreamManager();
    mgr.start();

    // captureStream should have been called on speech audio
    expect(mgr._speechAudio.captureStream).toHaveBeenCalled();
    // createMediaStreamSource should be called with the stream
    expect(mockCtx.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
    // Stream source should be connected to analyser
    const streamSource = mockCtx.createMediaStreamSource.mock.results[0].value;
    expect(streamSource.connect).toHaveBeenCalledWith(
      mockCtx.createAnalyser.mock.results[0].value
    );
  });

  test("_speechStreamSource is set when captureStream is available", () => {
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "audio") {
        const el = createMockAudioElement();
        el.captureStream = jest.fn(() => ({ id: "stream" }));
        return el;
      }
      return document.createElement.wrappedMethod.call(document, tag);
    });

    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._speechStreamSource).not.toBeNull();
  });

  test("gracefully skips when captureStream is not available", () => {
    // Default mock audio elements don't have captureStream
    const mgr = new AudioStreamManager();
    mgr.start();

    expect(mockCtx.createMediaStreamSource).toHaveBeenCalledTimes(0);
    expect(mgr._speechStreamSource).toBeNull();
    // Analyser still created (just won't get speech data)
    expect(mgr.getAnalyserNode()).not.toBeNull();
  });

  test("gracefully handles captureStream throwing", () => {
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "audio") {
        const el = createMockAudioElement();
        el.captureStream = jest.fn(() => { throw new Error("Not allowed"); });
        return el;
      }
      return document.createElement.wrappedMethod.call(document, tag);
    });

    const mgr = new AudioStreamManager();
    expect(() => mgr.start()).not.toThrow();
    expect(mgr.active).toBe(true);
    expect(mgr._speechStreamSource).toBeNull();
  });

  test("stop() nullifies _speechStreamSource", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.stop();
    expect(mgr._speechStreamSource).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Lock screen simulation: both elements survive AudioContext suspension
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-088 QA: lock screen survival (both elements)", () => {
  test("speech audio is independent of AudioContext state", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.queueSpeech(new ArrayBuffer(100));

    // Simulate OS suspending AudioContext
    mockCtx.state = "suspended";

    // Speech should still be playing via element (not through AudioContext)
    expect(mgr._speechAudio.src).toMatch(/^blob:/);
    expect(mgr._speechAudio.volume).toBe(1.0);
    expect(mgr._speechAudio.parentNode).toBe(document.body);
  });

  test("noise audio is independent of AudioContext state", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    mockCtx.state = "suspended";

    expect(mgr._noiseAudio.src).toMatch(/^blob:/);
    expect(mgr._noiseAudio.volume).toBe(0.02);
    expect(mgr._noiseAudio.parentNode).toBe(document.body);
    expect(mgr._noiseAudio.loop).toBe(true);
  });

  test("queue processing works independently of AudioContext state", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    mgr.queueSpeech(new ArrayBuffer(100));
    mgr.queueSpeech(new ArrayBuffer(100));

    // Simulate OS suspending AudioContext mid-playback
    mockCtx.state = "suspended";

    // Simulate first speech ending — queue should still process
    mgr._handleEnded();
    expect(mgr._queue).toHaveLength(0);
    expect(mgr._speechAudio.play).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Source code verification
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-088 QA: source code verification", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/utils/audioStreamManager.js"),
    "utf8"
  );

  test("architecture comment documents CARD-088 design", () => {
    expect(src).toMatch(/Architecture.*CARD-088/s);
  });

  test("both elements documented as playing DIRECTLY through speakers", () => {
    const directMatches = src.match(/plays DIRECTLY through speakers/gi);
    expect(directMatches).not.toBeNull();
    expect(directMatches.length).toBeGreaterThanOrEqual(2);
  });

  test("CRITICAL comment warns against createMediaElementSource for BOTH elements", () => {
    expect(src).toMatch(/CRITICAL.*Neither.*createMediaElementSource/is);
    expect(src).toMatch(/BOTH elements.*standalone/is);
  });

  test("_initSpeechAudio uses captureStream (not createMediaElementSource)", () => {
    const initMatch = src.match(/_initSpeechAudio\s*\(\s*\)\s*\{[\s\S]*?\n  \}/);
    expect(initMatch).not.toBeNull();
    // Should have captureStream
    expect(initMatch[0]).toMatch(/captureStream/);
    // Should NOT have createMediaElementSource as actual call
    expect(initMatch[0]).not.toMatch(/this\._ctx\.createMediaElementSource\s*\(/);
  });

  test("_initSpeechAudio sets speech volume to this._volume", () => {
    expect(src).toMatch(/this\._speechAudio\.volume\s*=\s*this\._volume/);
  });

  test("no _masterGain, _speechGain, _speechSource in constructor", () => {
    expect(src).not.toMatch(/this\._masterGain\s*=/);
    expect(src).not.toMatch(/this\._speechGain\s*=/);
    expect(src).not.toMatch(/this\._speechSource\s*=/);
  });

  test("_speechStreamSource documented as optional for captureStream", () => {
    expect(src).toMatch(/_speechStreamSource.*captureStream/i);
  });

  test("setVolume controls both elements directly (no gain chain)", () => {
    const setVolumeMatch = src.match(/setVolume\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/);
    expect(setVolumeMatch).not.toBeNull();
    expect(setVolumeMatch[0]).toMatch(/this\._speechAudio\.volume/);
    expect(setVolumeMatch[0]).toMatch(/this\._noiseAudio\.volume/);
    // Should NOT reference _masterGain
    expect(setVolumeMatch[0]).not.toMatch(/_masterGain/);
  });

  test("noise volume formula includes _volume multiplier", () => {
    // _startNoise should multiply by this._volume
    expect(src).toMatch(/NOISE_GAIN_ACTIVE\s*\*\s*this\._volume/);
    // _duckNoise should multiply by this._volume
    expect(src).toMatch(/NOISE_GAIN_DUCKED\s*\*\s*this\._volume/);
  });

  test("DUCK_FADE_TIME constant removed (no longer needed without gain ramps)", () => {
    expect(src).not.toMatch(/DUCK_FADE_TIME/);
  });
});

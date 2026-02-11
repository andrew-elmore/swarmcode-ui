/**
 * CARD-087 QA Tests — Noise decoupled from AudioContext
 * Author: qa-1
 * Date: 2026-02-11
 *
 * Root cause: The noise <audio> element was captured by createMediaElementSource(),
 * which routes its output exclusively through the AudioContext graph. When the OS
 * suspends the AudioContext on lock screen, the captured element also stops —
 * defeating the purpose of using HTMLAudioElement for lock screen survival.
 *
 * Fix: Noise <audio> element now plays DIRECTLY through speakers. Volume ducking
 * controlled via element.volume instead of AudioContext gain nodes.
 *
 * Architecture:
 *   [Noise <audio>] -> plays directly (element.volume for ducking)
 *   [TTS <audio>]   -> createMediaElementSource -> speechGain -> masterGain -> dest
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

function createMockMediaElementSource() {
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
    createMediaElementSource: jest.fn(() => createMockMediaElementSource()),
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
// Core fix: noise NOT captured by createMediaElementSource
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-087 QA: noise decoupled from AudioContext", () => {
  test("createMediaElementSource is called only once (for speech, NOT noise)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mockCtx.createMediaElementSource).toHaveBeenCalledTimes(1);
  });

  test("createMediaElementSource is called with speech audio (not noise)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mockCtx.createMediaElementSource).toHaveBeenCalledWith(mgr._speechAudio);
  });

  test("noise audio element is NOT passed to createMediaElementSource", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const sourceArgs = mockCtx.createMediaElementSource.mock.calls.map((c) => c[0]);
    expect(sourceArgs).not.toContain(mgr._noiseAudio);
  });

  test("only 2 gain nodes created (master + speech, no noiseGain)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Noise volume via element.volume (not AudioContext gain)
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-087 QA: noise volume via element.volume", () => {
  test("noise volume set to 0.02 (NOISE_GAIN_ACTIVE) on start", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._noiseAudio.volume).toBe(0.02);
  });

  test("noise volume ducks to 0.005 when speech plays", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    mgr.queueSpeech(new ArrayBuffer(100));
    expect(mgr._noiseAudio.volume).toBe(0.005);
  });

  test("noise volume unducks to 0.02 when speech ends", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    mgr.queueSpeech(new ArrayBuffer(100));
    expect(mgr._noiseAudio.volume).toBe(0.005);

    mgr._handleEnded();
    expect(mgr._noiseAudio.volume).toBe(0.02);
  });

  test("noise volume unducks on playback error", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    mgr.queueSpeech(new ArrayBuffer(100));
    expect(mgr._noiseAudio.volume).toBe(0.005);

    mgr._handleError();
    expect(mgr._noiseAudio.volume).toBe(0.02);
  });

  test("noise ducking uses direct volume assignment (no linearRampToValueAtTime)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    // Reset all gain node mocks to track calls
    const gainNodes = mockCtx.createGain.mock.results.map((r) => r.value);

    mgr.queueSpeech(new ArrayBuffer(100));

    // No gain node should have linearRampToValueAtTime called for ducking
    // (master and speech gain should not ramp for ducking purposes)
    for (const gn of gainNodes) {
      // linearRampToValueAtTime should NOT be called with 0.005 (ducked) or 0.02 (active)
      const duckCalls = gn.gain.linearRampToValueAtTime.mock.calls.filter(
        (c) => c[0] === 0.005 || c[0] === 0.02
      );
      expect(duckCalls).toHaveLength(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Speech still routes through AudioContext (for visualization)
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-087 QA: speech still through AudioContext", () => {
  test("speech MediaElementSource connects to speech gain", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    const speechSource = mockCtx.createMediaElementSource.mock.results[0].value;
    const speechGain = mockCtx.createGain.mock.results[1].value;
    expect(speechSource.connect).toHaveBeenCalledWith(speechGain);
  });

  test("speech gain connects to master gain", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    const masterGain = mockCtx.createGain.mock.results[0].value;
    const speechGain = mockCtx.createGain.mock.results[1].value;
    expect(speechGain.connect).toHaveBeenCalledWith(masterGain);
  });

  test("master gain connects to destination and analyser", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    const masterGain = mockCtx.createGain.mock.results[0].value;
    expect(masterGain.connect).toHaveBeenCalledWith(mockCtx.destination);
    expect(masterGain.connect).toHaveBeenCalledWith(
      mockCtx.createAnalyser.mock.results[0].value
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Source code verification
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-087 QA: source code verification", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/utils/audioStreamManager.js"),
    "utf8"
  );

  test("architecture comment documents CARD-087 design", () => {
    expect(src).toMatch(/CARD-087/);
    expect(src).toMatch(/plays DIRECTLY through speakers/i);
  });

  test("critical comment warns against using createMediaElementSource for noise", () => {
    expect(src).toMatch(/CRITICAL.*noise.*must NOT.*createMediaElementSource/is);
  });

  test("_duckNoise uses this._noiseAudio.volume (not gain node)", () => {
    // Verify _duckNoise sets volume directly
    expect(src).toMatch(/_duckNoise\s*\(\s*\)\s*\{[^}]*this\._noiseAudio\.volume\s*=/);
  });

  test("_unduckNoise uses this._noiseAudio.volume (not gain node)", () => {
    expect(src).toMatch(/_unduckNoise\s*\(\s*\)\s*\{[^}]*this\._noiseAudio\.volume\s*=/);
  });

  test("_startNoise sets element.volume directly (not through AudioContext)", () => {
    expect(src).toMatch(/this\._noiseAudio\.volume\s*=\s*NOISE_GAIN_ACTIVE/);
  });

  test("_startNoise does NOT call createMediaElementSource", () => {
    // Extract _startNoise method body and verify no actual call
    // (comments mentioning it are fine — checking for actual invocation)
    const startNoiseMatch = src.match(/_startNoise\s*\(\s*\)\s*\{[\s\S]*?\n  \}/);
    expect(startNoiseMatch).not.toBeNull();
    // Should not have an actual call like this._ctx.createMediaElementSource(
    // or createMediaElementSource( outside of comments
    expect(startNoiseMatch[0]).not.toMatch(/this\._ctx\.createMediaElementSource\s*\(/);
  });

  test("no _noiseSource property used in the codebase", () => {
    // _noiseSource should be completely removed
    expect(src).not.toMatch(/this\._noiseSource\s*=/);
  });

  test("comment explains standalone noise for OS audio session survival", () => {
    expect(src).toMatch(/OS.*audio session.*alive/i);
    expect(src).toMatch(/lock screen/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Lock screen simulation: AudioContext suspended but noise should keep playing
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-087 QA: lock screen behavior simulation", () => {
  test("noise audio is independent of AudioContext state", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    // Simulate OS suspending AudioContext (lock screen)
    mockCtx.state = "suspended";

    // Noise audio should still have its src, volume, and be in the DOM
    // (not affected by AudioContext suspension)
    expect(mgr._noiseAudio.src).toMatch(/^blob:/);
    expect(mgr._noiseAudio.volume).toBe(0.02);
    expect(mgr._noiseAudio.parentNode).toBe(document.body);
    expect(mgr._noiseAudio.loop).toBe(true);
  });

  test("visibility change resumes AudioContext but noise doesn't need it", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    // Simulate suspension + visibility change
    mockCtx.state = "suspended";
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });

    mgr._handleVisibilityChange();

    // AudioContext should be resumed (for speech visualization)
    expect(mockCtx.resume).toHaveBeenCalled();

    // But noise volume should still be directly on element (unchanged)
    expect(mgr._noiseAudio.volume).toBe(0.02);
  });
});

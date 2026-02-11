/**
 * CARD-070 QA Supplementary Tests — AudioStreamManager edge cases.
 * Author: qa-1
 * Date: 2026-02-11
 *
 * Supplements the 30 tests in audioStreamManager.test.js with
 * additional edge case and lifecycle coverage.
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

function createMockBufferSource() {
  return {
    buffer: null,
    loop: false,
    playbackRate: { value: 1 },
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null,
  };
}

function createMockAnalyser() {
  return {
    fftSize: 0,
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
}

function createMockAudioBuffer(duration = 1.0) {
  return {
    duration,
    length: 44100,
    sampleRate: 44100,
    numberOfChannels: 1,
    getChannelData: jest.fn(() => new Float32Array(44100)),
  };
}

function createMockAudioContext() {
  return {
    sampleRate: 44100,
    currentTime: 0,
    destination: { name: "destination" },
    createGain: jest.fn(() => createMockGainNode()),
    createBufferSource: jest.fn(() => createMockBufferSource()),
    createAnalyser: jest.fn(() => createMockAnalyser()),
    createBuffer: jest.fn((channels, length, sampleRate) => ({
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: jest.fn(() => new Float32Array(length)),
    })),
    decodeAudioData: jest.fn(() => Promise.resolve(createMockAudioBuffer())),
    close: jest.fn(() => Promise.resolve()),
  };
}

let mockCtx;
beforeEach(() => {
  mockCtx = createMockAudioContext();
  window.AudioContext = jest.fn(() => mockCtx);
});

afterEach(() => {
  delete window.AudioContext;
  delete window.webkitAudioContext;
});

// ─── Lifecycle edge cases ───────────────────────────────────────────────────

describe("CARD-070 QA: lifecycle edge cases", () => {
  test("can restart after stop", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr.active).toBe(true);

    mgr.stop();
    expect(mgr.active).toBe(false);

    // Create a fresh mock context for the second start
    const mockCtx2 = createMockAudioContext();
    window.AudioContext = jest.fn(() => mockCtx2);

    mgr.start();
    expect(mgr.active).toBe(true);
    expect(window.AudioContext).toHaveBeenCalled();
    expect(mgr.getAnalyserNode()).not.toBeNull();
  });

  test("stop during active speech queue clears queue", async () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    mgr.queueSpeech(new ArrayBuffer(100));
    mgr.queueSpeech(new ArrayBuffer(100));
    mgr.queueSpeech(new ArrayBuffer(100));

    // First item starts processing
    await new Promise((r) => setTimeout(r, 0));

    // Stop mid-queue
    mgr.stop();
    expect(mgr._queue).toHaveLength(0);
    expect(mgr.active).toBe(false);
  });

  test("queueSpeech after stop does nothing", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.stop();

    mgr.queueSpeech(new ArrayBuffer(100));
    expect(mgr._queue).toHaveLength(0);
  });
});

// ─── Volume/speed before start ──────────────────────────────────────────────

describe("CARD-070 QA: controls before start", () => {
  test("setVolume before start stores value without crashing", () => {
    const mgr = new AudioStreamManager();
    mgr.setVolume(0.3);
    expect(mgr.volume).toBe(0.3);
    // No AudioContext created yet, so no gain node calls
  });

  test("setSpeed before start stores value", () => {
    const mgr = new AudioStreamManager();
    mgr.setSpeed(1.8);
    expect(mgr.speed).toBe(1.8);
  });

  test("volume set before start is applied when start is called", () => {
    const mgr = new AudioStreamManager();
    mgr.setVolume(0.6);
    mgr.start();

    const masterGain = mockCtx.createGain.mock.results[0].value;
    expect(masterGain.gain.value).toBe(0.6);
  });

  test("speed set before start is applied to queued speech", async () => {
    const mgr = new AudioStreamManager();
    mgr.setSpeed(1.75);
    mgr.start();

    mgr.queueSpeech(new ArrayBuffer(100));
    await new Promise((r) => setTimeout(r, 0));

    const speechSource = mockCtx.createBufferSource.mock.results[1].value;
    expect(speechSource.playbackRate.value).toBe(1.75);
  });
});

// ─── Volume/speed boundary values ───────────────────────────────────────────

describe("CARD-070 QA: control boundary values", () => {
  test("setVolume(0) sets volume to exactly 0", () => {
    const mgr = new AudioStreamManager();
    mgr.setVolume(0);
    expect(mgr.volume).toBe(0);
  });

  test("setVolume(1) sets volume to exactly 1", () => {
    const mgr = new AudioStreamManager();
    mgr.setVolume(1);
    expect(mgr.volume).toBe(1);
  });

  test("setSpeed(0.5) sets speed to exactly 0.5", () => {
    const mgr = new AudioStreamManager();
    mgr.setSpeed(0.5);
    expect(mgr.speed).toBe(0.5);
  });

  test("setSpeed(2.0) sets speed to exactly 2.0", () => {
    const mgr = new AudioStreamManager();
    mgr.setSpeed(2.0);
    expect(mgr.speed).toBe(2.0);
  });
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe("CARD-070 QA: error handling", () => {
  test("setOnError replaces previous callback", () => {
    const mgr = new AudioStreamManager();
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    mgr.setOnError(cb1);
    mgr.setOnError(cb2);

    delete window.AudioContext;
    delete window.webkitAudioContext;
    mgr.start();

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledWith("Web Audio API not supported");
  });

  test("no crash when error callback is not set and decode fails", async () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mockCtx.decodeAudioData.mockRejectedValueOnce(new Error("corrupt"));

    // Should not throw even without error callback
    mgr.queueSpeech(new ArrayBuffer(100));
    await new Promise((r) => setTimeout(r, 0));
    // Manager should still be active
    expect(mgr.active).toBe(true);
  });

  test("queue continues processing after decode error", async () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    mockCtx.decodeAudioData
      .mockRejectedValueOnce(new Error("bad"))
      .mockResolvedValueOnce(createMockAudioBuffer());

    mgr.queueSpeech(new ArrayBuffer(50));
    mgr.queueSpeech(new ArrayBuffer(50));

    // Process first (fails)
    await new Promise((r) => setTimeout(r, 0));
    // Process second (succeeds)
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx.decodeAudioData).toHaveBeenCalledTimes(2);
    // Speech source created for second item
    expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(2); // noise + speech
  });
});

// ─── Analyser node ──────────────────────────────────────────────────────────

describe("CARD-070 QA: analyser node", () => {
  test("analyser fftSize is set to 256", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const analyser = mgr.getAnalyserNode();
    expect(analyser.fftSize).toBe(256);
  });
});

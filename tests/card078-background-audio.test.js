/**
 * CARD-078 QA: Background audio playback — silent <audio> element,
 * Media Session API, visibility change handler.
 * Author: qa-1
 * Date: 2026-02-11
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
  return { fftSize: 0, connect: jest.fn(), disconnect: jest.fn() };
}

function createMockMediaElementSource() {
  return { connect: jest.fn() };
}

function createMockAudioContext() {
  return {
    sampleRate: 44100,
    currentTime: 0,
    state: "running",
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
    createMediaElementSource: jest.fn(() => createMockMediaElementSource()),
    decodeAudioData: jest.fn(() => Promise.resolve({ duration: 1 })),
    close: jest.fn(() => Promise.resolve()),
    resume: jest.fn(() => Promise.resolve()),
  };
}

let mockCtx;
let addEventListenerSpy;
let removeEventListenerSpy;

beforeEach(() => {
  mockCtx = createMockAudioContext();
  window.AudioContext = jest.fn(() => mockCtx);

  // Mock document.createElement for <audio>
  const origCreateElement = document.createElement.bind(document);
  jest.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag === "audio") {
      return {
        loop: false,
        volume: 1,
        src: "",
        paused: false,
        play: jest.fn(() => Promise.resolve()),
        pause: jest.fn(),
        removeAttribute: jest.fn(),
      };
    }
    return origCreateElement(tag);
  });

  addEventListenerSpy = jest.spyOn(document, "addEventListener");
  removeEventListenerSpy = jest.spyOn(document, "removeEventListener");
});

afterEach(() => {
  delete window.AudioContext;
  delete window.webkitAudioContext;
  jest.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Silent <audio> element
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-078: Silent audio element", () => {
  test("creates an <audio> element on start()", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(document.createElement).toHaveBeenCalledWith("audio");
  });

  test("silent audio element is set to loop", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    // Access the internal silent audio ref
    expect(mgr._silentAudio).not.toBeNull();
    expect(mgr._silentAudio.loop).toBe(true);
  });

  test("silent audio volume is 1.0 (required for iOS)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._silentAudio.volume).toBe(1.0);
  });

  test("silent audio src is a data: MP3 URL", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._silentAudio.src).toMatch(/^data:audio\/mp3;base64,/);
  });

  test("play() is called on the silent audio element", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._silentAudio.play).toHaveBeenCalled();
  });

  test("createMediaElementSource connects silent audio to AudioContext", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mockCtx.createMediaElementSource).toHaveBeenCalledWith(
      mgr._silentAudio
    );
  });

  test("silent audio routes through a zero-gain node to master", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    // createGain calls: master(0), speech(1), noise(2), silentGain(3)
    expect(mockCtx.createGain).toHaveBeenCalledTimes(4);
    const silentGain = mockCtx.createGain.mock.results[3].value;
    expect(silentGain.gain.value).toBe(0);
  });

  test("stop() pauses and cleans up the silent audio element", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const silentAudio = mgr._silentAudio;
    mgr.stop();
    expect(silentAudio.pause).toHaveBeenCalled();
    expect(silentAudio.removeAttribute).toHaveBeenCalledWith("src");
    expect(mgr._silentAudio).toBeNull();
  });

  test("gracefully handles createMediaElementSource unavailable", () => {
    mockCtx.createMediaElementSource = jest.fn(() => {
      throw new Error("not supported");
    });
    const mgr = new AudioStreamManager();
    // Should not throw — falls back gracefully
    expect(() => mgr.start()).not.toThrow();
    expect(mgr.active).toBe(true);
    // Only 3 gain nodes (master, speech, noise — no silent gain)
    expect(mockCtx.createGain).toHaveBeenCalledTimes(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Media Session API
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-078: Media Session API", () => {
  let origMediaSession;

  beforeEach(() => {
    origMediaSession = navigator.mediaSession;
    Object.defineProperty(navigator, "mediaSession", {
      value: {
        metadata: null,
        setActionHandler: jest.fn(),
      },
      writable: true,
      configurable: true,
    });

    // MediaMetadata constructor
    if (typeof window.MediaMetadata === "undefined") {
      window.MediaMetadata = class {
        constructor(init) {
          Object.assign(this, init);
        }
      };
    }
  });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaSession", {
      value: origMediaSession,
      writable: true,
      configurable: true,
    });
  });

  test("registers MediaMetadata with title and artist", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(navigator.mediaSession.metadata).not.toBeNull();
    expect(navigator.mediaSession.metadata.title).toBe("SwarmCode Audio Stream");
    expect(navigator.mediaSession.metadata.artist).toBe("SwarmCode");
  });

  test("registers play and pause action handlers", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const calls = navigator.mediaSession.setActionHandler.mock.calls;
    const actions = calls.map((c) => c[0]);
    expect(actions).toContain("play");
    expect(actions).toContain("pause");
  });

  test("play handler resumes suspended AudioContext", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mockCtx.state = "suspended";
    mgr._silentAudio.paused = true;

    const playHandler = navigator.mediaSession.setActionHandler.mock.calls.find(
      (c) => c[0] === "play"
    )[1];
    playHandler();

    expect(mockCtx.resume).toHaveBeenCalled();
    expect(mgr._silentAudio.play).toHaveBeenCalled();
  });

  test("pause handler is a no-op (prevents OS from pausing)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    const pauseHandler = navigator.mediaSession.setActionHandler.mock.calls.find(
      (c) => c[0] === "pause"
    )[1];

    // Should not throw or do anything
    expect(() => pauseHandler()).not.toThrow();
    // Importantly, should NOT pause the silent audio or close the context
    expect(mgr._silentAudio.pause).not.toHaveBeenCalled();
    expect(mockCtx.close).not.toHaveBeenCalled();
  });

  test("skips Media Session setup when API not available", () => {
    Object.defineProperty(navigator, "mediaSession", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const mgr = new AudioStreamManager();
    // Should not throw
    expect(() => mgr.start()).not.toThrow();
    expect(mgr.active).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Visibility change handler
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-078: Visibility change handler", () => {
  test("registers visibilitychange listener on start()", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
  });

  test("removes visibilitychange listener on stop()", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.stop();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
  });

  test("resumes suspended AudioContext when page becomes visible", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mockCtx.state = "suspended";

    // Simulate page becoming visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    mgr._handleVisibilityChange();

    expect(mockCtx.resume).toHaveBeenCalled();
  });

  test("restarts paused silent audio when page becomes visible", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr._silentAudio.paused = true;

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    mgr._handleVisibilityChange();

    // play() called once during start() and once on visibility change
    expect(mgr._silentAudio.play).toHaveBeenCalledTimes(2);
  });

  test("does nothing when page becomes hidden", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mockCtx.resume.mockClear();

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    mgr._handleVisibilityChange();

    expect(mockCtx.resume).not.toHaveBeenCalled();
  });

  test("does nothing when not active", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.stop();
    mockCtx.resume.mockClear();

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    mgr._handleVisibilityChange();

    expect(mockCtx.resume).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ttsSlice: enabled no longer persisted
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-078: ttsSlice enabled always starts false", () => {
  test("ttsSlice initial state has enabled: false regardless of localStorage", async () => {
    // This is a behavioral contract: enabled must always be false on load
    // because AudioContext requires a user gesture to start.
    const { default: ttsReducer } = await import("../src/store/ttsSlice");
    const state = ttsReducer(undefined, { type: "@@INIT" });
    expect(state.enabled).toBe(false);
  });
});

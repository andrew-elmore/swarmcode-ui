/**
 * CARD-078 / CARD-082 QA: Background audio playback —
 * noise <audio> element keeps session alive, Media Session API,
 * visibility change handler.
 *
 * CARD-082 replaced the silent <audio> trick with a looping noise <audio>
 * element that keeps the OS audio session alive on lock screen.
 *
 * Author: qa-1 (original), senior-dev-1 (CARD-082 update)
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
let addEventListenerSpy;
let removeEventListenerSpy;

beforeEach(() => {
  mockCtx = createMockAudioContext();
  window.AudioContext = jest.fn(() => mockCtx);

  const origCreateElement = document.createElement.bind(document);
  jest.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag === "audio") {
      return createMockAudioElement();
    }
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

  addEventListenerSpy = jest.spyOn(document, "addEventListener");
  removeEventListenerSpy = jest.spyOn(document, "removeEventListener");
});

afterEach(() => {
  delete window.AudioContext;
  delete window.webkitAudioContext;
  jest.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Noise <audio> element (replaces CARD-078 silent audio)
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-078/082: Noise audio element for lock screen", () => {
  test("creates <audio> elements on start()", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(document.createElement).toHaveBeenCalledWith("audio");
  });

  test("noise audio element is set to loop", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._noiseAudio).not.toBeNull();
    expect(mgr._noiseAudio.loop).toBe(true);
  });

  test("noise audio src is a blob URL (WAV)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._noiseAudio.src).toMatch(/^blob:/);
  });

  test("play() is called on the noise audio element", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._noiseAudio.play).toHaveBeenCalled();
  });

  test("noise audio plays directly — NOT captured by createMediaElementSource", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    // Noise must NOT be captured by createMediaElementSource — captured elements
    // stop when the OS suspends the AudioContext on lock screen (CARD-087).
    const sourceArgs = mockCtx.createMediaElementSource.mock.calls.map((c) => c[0]);
    expect(sourceArgs).not.toContain(mgr._noiseAudio);
  });

  test("noise volume set to 0.02 directly on the <audio> element", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    // Volume is controlled via element.volume (not AudioContext gain)
    expect(mgr._noiseAudio.volume).toBe(0.02);
  });

  test("stop() pauses and cleans up the noise audio element", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const noiseAudio = mgr._noiseAudio;
    mgr.stop();
    expect(noiseAudio.pause).toHaveBeenCalled();
    expect(noiseAudio.removeAttribute).toHaveBeenCalledWith("src");
    expect(mgr._noiseAudio).toBeNull();
  });

  test("stop() revokes noise blob URL", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const blobUrl = mgr._noiseBlobUrl;
    expect(blobUrl).toBeTruthy();
    mgr.stop();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
  });

  test("gracefully handles createMediaElementSource unavailable", () => {
    mockCtx.createMediaElementSource = jest.fn(() => {
      throw new Error("not supported");
    });
    const mgr = new AudioStreamManager();
    // Should not throw — falls back gracefully
    expect(() => mgr.start()).not.toThrow();
    expect(mgr.active).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Media Session API
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-078/082: Media Session API", () => {
  let origMediaSession;

  beforeEach(() => {
    origMediaSession = navigator.mediaSession;
    Object.defineProperty(navigator, "mediaSession", {
      value: {
        metadata: null,
        playbackState: "none",
        setActionHandler: jest.fn(),
      },
      writable: true,
      configurable: true,
    });

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

  test("play handler resumes suspended AudioContext and noise audio", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mockCtx.state = "suspended";
    mgr._noiseAudio.paused = true;

    const playHandler = navigator.mediaSession.setActionHandler.mock.calls.find(
      (c) => c[0] === "play"
    )[1];
    playHandler();

    expect(mockCtx.resume).toHaveBeenCalled();
    expect(mgr._noiseAudio.play).toHaveBeenCalled();
  });

  test("pause handler is a no-op (prevents OS from pausing)", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    const pauseHandler = navigator.mediaSession.setActionHandler.mock.calls.find(
      (c) => c[0] === "pause"
    )[1];

    expect(() => pauseHandler()).not.toThrow();
    expect(mockCtx.close).not.toHaveBeenCalled();
  });

  test("skips Media Session setup when API not available", () => {
    Object.defineProperty(navigator, "mediaSession", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const mgr = new AudioStreamManager();
    expect(() => mgr.start()).not.toThrow();
    expect(mgr.active).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Visibility change handler
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-078/082: Visibility change handler", () => {
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

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    mgr._handleVisibilityChange();

    expect(mockCtx.resume).toHaveBeenCalled();
  });

  test("restarts paused noise audio when page becomes visible", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr._noiseAudio.paused = true;
    mgr._noiseAudio.play.mockClear();

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    mgr._handleVisibilityChange();

    expect(mgr._noiseAudio.play).toHaveBeenCalled();
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
    const { default: ttsReducer } = await import("../src/store/ttsSlice");
    const state = ttsReducer(undefined, { type: "@@INIT" });
    expect(state.enabled).toBe(false);
  });
});

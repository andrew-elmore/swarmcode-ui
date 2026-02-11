/**
 * CARD-082 QA Tests — HTMLAudioElement architecture rewrite
 * Author: qa-1
 * Date: 2026-02-11
 *
 * Validates the architectural shift from AudioBufferSourceNode to
 * HTMLAudioElement for both noise and speech, ensuring OS-level
 * media playback recognition for lock screen survival.
 */

import AudioStreamManager from "../src/utils/audioStreamManager";

// ─── Web Audio API mocks ─────────────────────────────────────────────────────

function createMockGainNode(initialValue = 1) {
  return {
    gain: { value: initialValue, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
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
let mockAudioElements;

beforeEach(() => {
  mockCtx = createMockAudioContext();
  window.AudioContext = jest.fn(() => mockCtx);

  mockAudioElements = [];
  const origCreateElement = document.createElement.bind(document);
  jest.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag === "audio") {
      const el = createMockAudioElement();
      mockAudioElements.push(el);
      return el;
    }
    return origCreateElement(tag);
  });
});

afterEach(() => {
  delete window.AudioContext;
  delete window.webkitAudioContext;
  jest.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Architecture verification: no old API usage in source
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-082 QA: old architecture removed", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/utils/audioStreamManager.js"),
    "utf8"
  );

  test("no AudioBufferSourceNode usage", () => {
    expect(src).not.toMatch(/AudioBufferSourceNode/);
  });

  test("no createBufferSource calls", () => {
    expect(src).not.toMatch(/createBufferSource/);
  });

  test("no decodeAudioData calls", () => {
    expect(src).not.toMatch(/decodeAudioData/);
  });

  test("no _silentAudio references (old CARD-078 approach)", () => {
    expect(src).not.toMatch(/_silentAudio/);
  });

  test("uses _noiseAudio (new approach)", () => {
    expect(src).toMatch(/_noiseAudio/);
  });

  test("uses _speechAudio with HTMLAudioElement", () => {
    expect(src).toMatch(/_speechAudio/);
    expect(src).toMatch(/createElement\s*\(\s*["']audio["']\s*\)/);
  });

  test("uses Blob URLs for audio playback", () => {
    expect(src).toMatch(/URL\.createObjectURL/);
    expect(src).toMatch(/URL\.revokeObjectURL/);
    expect(src).toMatch(/new Blob/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// White noise WAV generation
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-082 QA: noise WAV generation", () => {
  test("noise blob URL is created from a Blob", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._noiseBlobUrl).toMatch(/^blob:/);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  test("noise audio element has blob src set", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._noiseAudio.src).toBe(mgr._noiseBlobUrl);
  });

  test("noise audio element is set to loop for continuous playback", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._noiseAudio.loop).toBe(true);
  });

  test("noise play() is called immediately on start", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._noiseAudio.play).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Speech audio via HTMLAudioElement + Blob URL
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-082 QA: speech via HTMLAudioElement", () => {
  test("speech audio element created with preload=auto", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    expect(mgr._speechAudio).not.toBeNull();
    expect(mgr._speechAudio.preload).toBe("auto");
  });

  test("speech audio registers ended and error event listeners", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const calls = mgr._speechAudio.addEventListener.mock.calls.map(c => c[0]);
    expect(calls).toContain("ended");
    expect(calls).toContain("error");
  });

  test("queueSpeech creates blob URL and sets as src", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const createObjURLCount = URL.createObjectURL.mock.calls.length;
    mgr.queueSpeech(new ArrayBuffer(100));
    // One new createObjectURL call for speech blob
    expect(URL.createObjectURL.mock.calls.length).toBeGreaterThan(createObjURLCount);
    expect(mgr._speechAudio.src).toMatch(/^blob:/);
  });

  test("previous blob URL is revoked before creating new one", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    // Queue first speech
    mgr.queueSpeech(new ArrayBuffer(100));
    const firstBlobUrl = mgr._currentBlobUrl;

    // Simulate speech ended -> processes next
    mgr.queueSpeech(new ArrayBuffer(100));
    mgr._handleEnded();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstBlobUrl);
  });

  test("playbackRate set to current speed on play", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.setSpeed(1.75);
    mgr.queueSpeech(new ArrayBuffer(100));
    expect(mgr._speechAudio.playbackRate).toBe(1.75);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Noise ducking during speech
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-082 QA: noise ducking", () => {
  test("noise gain ducks to 0.005 when speech plays", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    // noise gain is the third createGain call (master=0, speech=1, noise=2)
    const noiseGain = mockCtx.createGain.mock.results[2].value;

    mgr.queueSpeech(new ArrayBuffer(100));

    expect(noiseGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.005, // NOISE_GAIN_DUCKED
      expect.any(Number)
    );
  });

  test("noise gain unducks to 0.02 when speech ends", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const noiseGain = mockCtx.createGain.mock.results[2].value;

    mgr.queueSpeech(new ArrayBuffer(100));
    noiseGain.gain.linearRampToValueAtTime.mockClear();

    mgr._handleEnded();

    expect(noiseGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.02, // NOISE_GAIN_ACTIVE
      expect.any(Number)
    );
  });

  test("noise gain unducks on playback error", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const noiseGain = mockCtx.createGain.mock.results[2].value;

    mgr.queueSpeech(new ArrayBuffer(100));
    noiseGain.gain.linearRampToValueAtTime.mockClear();

    mgr._handleError();

    expect(noiseGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.02,
      expect.any(Number)
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cleanup: blob URL and element lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-082 QA: cleanup and resource management", () => {
  test("stop() cleans up speech event listeners", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const speechAudio = mgr._speechAudio;

    mgr.stop();

    expect(speechAudio.removeEventListener).toHaveBeenCalledWith("ended", expect.any(Function));
    expect(speechAudio.removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
  });

  test("stop() revokes both noise and speech blob URLs", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    // Queue speech to create a speech blob URL
    mgr.queueSpeech(new ArrayBuffer(100));
    const speechBlobUrl = mgr._currentBlobUrl;
    const noiseBlobUrl = mgr._noiseBlobUrl;

    mgr.stop();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(noiseBlobUrl);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(speechBlobUrl);
  });

  test("stop() nullifies all audio nodes", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.stop();

    expect(mgr._noiseAudio).toBeNull();
    expect(mgr._speechAudio).toBeNull();
    expect(mgr._noiseSource).toBeNull();
    expect(mgr._speechSource).toBeNull();
    expect(mgr._speechGain).toBeNull();
    expect(mgr._noiseGain).toBeNull();
    expect(mgr._masterGain).toBeNull();
    expect(mgr._analyser).toBeNull();
    expect(mgr._ctx).toBeNull();
  });

  test("_handleEnded revokes blob URL and processes next queue item", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    mgr.queueSpeech(new ArrayBuffer(100));
    mgr.queueSpeech(new ArrayBuffer(100));

    const firstBlobUrl = mgr._currentBlobUrl;
    mgr._handleEnded();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstBlobUrl);
    expect(mgr._queue).toHaveLength(0); // second item processed
  });

  test("_handleError emits error, unducks, and continues queue", () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    const errorCb = jest.fn();
    mgr.setOnError(errorCb);

    mgr.queueSpeech(new ArrayBuffer(100));
    mgr.queueSpeech(new ArrayBuffer(100));

    mgr._handleError();

    expect(errorCb).toHaveBeenCalledWith("Audio playback error");
    expect(mgr._queue).toHaveLength(0); // continued to next
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Media Session playback state
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-082 QA: Media Session playback state", () => {
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
        constructor(init) { Object.assign(this, init); }
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

  test("playbackState set to 'playing' after successful play()", async () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.queueSpeech(new ArrayBuffer(100));

    // Wait for play().then() to resolve
    await new Promise((r) => setTimeout(r, 0));

    expect(navigator.mediaSession.playbackState).toBe("playing");
  });

  test("play handler also resumes speech audio if paused with blob", () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    // Simulate speech in progress
    mgr.queueSpeech(new ArrayBuffer(100));
    mgr._speechAudio.paused = true;
    mgr._speechAudio.play.mockClear();

    const playHandler = navigator.mediaSession.setActionHandler.mock.calls.find(
      (c) => c[0] === "play"
    )[1];
    playHandler();

    expect(mgr._speechAudio.play).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// iOS Safari workaround: playbackRate reapplied after play()
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-082 QA: iOS Safari playbackRate workaround", () => {
  test("playbackRate is set before AND after play() resolves", async () => {
    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.setSpeed(1.5);

    mgr.queueSpeech(new ArrayBuffer(100));

    // Before play resolves
    expect(mgr._speechAudio.playbackRate).toBe(1.5);

    // After play resolves
    await new Promise((r) => setTimeout(r, 0));
    expect(mgr._speechAudio.playbackRate).toBe(1.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Graceful degradation: createMediaElementSource unavailable
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-082 QA: graceful degradation", () => {
  test("start() works when createMediaElementSource throws", () => {
    mockCtx.createMediaElementSource = jest.fn(() => {
      throw new Error("Not implemented in test env");
    });

    const mgr = new AudioStreamManager();
    expect(() => mgr.start()).not.toThrow();
    expect(mgr.active).toBe(true);
    // Noise and speech audio elements should still exist
    expect(mgr._speechAudio).not.toBeNull();
  });

  test("queueSpeech works without MediaElementSource (plays through default output)", () => {
    mockCtx.createMediaElementSource = jest.fn(() => {
      throw new Error("Not implemented");
    });

    const mgr = new AudioStreamManager();
    mgr.start();
    mgr.queueSpeech(new ArrayBuffer(100));

    // Should still set src and call play
    expect(mgr._speechAudio.src).toMatch(/^blob:/);
    expect(mgr._speechAudio.play).toHaveBeenCalled();
  });
});

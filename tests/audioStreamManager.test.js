/**
 * CARD-070 / CARD-082: AudioStreamManager — Test Suite
 * Tests for HTMLAudioElement-based continuous stream, white noise, speech mixing,
 * queue, controls, and lock screen compatibility.
 *
 * Architecture (CARD-082):
 *   [Noise <audio>] -> [MediaElementSource] -> [noiseGain] --+
 *   [TTS <audio>]   -> [MediaElementSource] -> [speechGain] -+--> [masterGain] -> destination
 *                                                                       |
 *                                                                  [analyser]
 *
 * Author: developer-1 (original), senior-dev-1 (CARD-082 rewrite)
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
  return {
    fftSize: 0,
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
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

  // Track all created <audio> elements
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
// Construction / initial state
// ═══════════════════════════════════════════════════════════════════════════════
describe("AudioStreamManager", () => {
  test("initial state: not active, default volume and speed", () => {
    const mgr = new AudioStreamManager();
    expect(mgr.active).toBe(false);
    expect(mgr.volume).toBe(1.0);
    expect(mgr.speed).toBe(1.0);
    expect(mgr.getAnalyserNode()).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // start()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("start()", () => {
    test("creates AudioContext and sets active to true", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      expect(window.AudioContext).toHaveBeenCalled();
      expect(mgr.active).toBe(true);
    });

    test("creates gain nodes: master, speech, noise", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      // master + speech + noise = 3 gain nodes
      expect(mockCtx.createGain).toHaveBeenCalledTimes(3);
    });

    test("creates analyser node", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      expect(mockCtx.createAnalyser).toHaveBeenCalled();
      expect(mgr.getAnalyserNode()).not.toBeNull();
    });

    test("creates two <audio> elements: noise and speech", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      // noise audio + speech audio = 2 elements
      expect(document.createElement).toHaveBeenCalledWith("audio");
      expect(mockAudioElements.length).toBe(2);
    });

    test("noise <audio> element is set to loop", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      // First <audio> is noise
      expect(mgr._noiseAudio.loop).toBe(true);
    });

    test("noise <audio> src is a blob URL", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      expect(mgr._noiseAudio.src).toMatch(/^blob:/);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test("noise <audio> play() is called", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      expect(mgr._noiseAudio.play).toHaveBeenCalled();
    });

    test("speech <audio> preload is set to auto", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      expect(mgr._speechAudio.preload).toBe("auto");
    });

    test("createMediaElementSource called for both noise and speech", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      // Called for noise audio and speech audio
      expect(mockCtx.createMediaElementSource).toHaveBeenCalledTimes(2);
    });

    test("is a no-op if already active", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      mgr.start(); // second call
      expect(window.AudioContext).toHaveBeenCalledTimes(1);
    });

    test("emits error if Web Audio API not supported", () => {
      delete window.AudioContext;
      delete window.webkitAudioContext;
      const mgr = new AudioStreamManager();
      const errorCb = jest.fn();
      mgr.setOnError(errorCb);
      mgr.start();
      expect(errorCb).toHaveBeenCalledWith("Web Audio API not supported");
      expect(mgr.active).toBe(false);
    });

    test("falls back to webkitAudioContext", () => {
      delete window.AudioContext;
      window.webkitAudioContext = jest.fn(() => mockCtx);
      const mgr = new AudioStreamManager();
      mgr.start();
      expect(window.webkitAudioContext).toHaveBeenCalled();
      expect(mgr.active).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // stop()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("stop()", () => {
    test("sets active to false and closes AudioContext", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      mgr.stop();
      expect(mgr.active).toBe(false);
      expect(mockCtx.close).toHaveBeenCalled();
    });

    test("pauses and cleans up noise audio", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseAudio = mgr._noiseAudio;
      mgr.stop();
      expect(noiseAudio.pause).toHaveBeenCalled();
      expect(noiseAudio.removeAttribute).toHaveBeenCalledWith("src");
      expect(mgr._noiseAudio).toBeNull();
    });

    test("pauses and cleans up speech audio", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const speechAudio = mgr._speechAudio;
      mgr.stop();
      expect(speechAudio.pause).toHaveBeenCalled();
      expect(speechAudio.removeAttribute).toHaveBeenCalledWith("src");
      expect(mgr._speechAudio).toBeNull();
    });

    test("revokes noise blob URL", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseBlobUrl = mgr._noiseBlobUrl;
      expect(noiseBlobUrl).toBeTruthy();
      mgr.stop();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(noiseBlobUrl);
      expect(mgr._noiseBlobUrl).toBeNull();
    });

    test("clears the speech queue", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      mgr._queue.push(new ArrayBuffer(10));
      mgr._queue.push(new ArrayBuffer(10));
      mgr.stop();
      expect(mgr._queue).toHaveLength(0);
    });

    test("clears analyser node", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      expect(mgr.getAnalyserNode()).not.toBeNull();
      mgr.stop();
      expect(mgr.getAnalyserNode()).toBeNull();
    });

    test("is a no-op if not active", () => {
      const mgr = new AudioStreamManager();
      mgr.stop(); // should not throw
      expect(mgr.active).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setVolume()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("setVolume()", () => {
    test("clamps volume to 0-1 range", () => {
      const mgr = new AudioStreamManager();
      mgr.setVolume(1.5);
      expect(mgr.volume).toBe(1);
      mgr.setVolume(-0.5);
      expect(mgr.volume).toBe(0);
      mgr.setVolume(0.7);
      expect(mgr.volume).toBe(0.7);
    });

    test("updates master gain when active", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const masterGain = mockCtx.createGain.mock.results[0].value;
      mgr.setVolume(0.5);
      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setSpeed()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("setSpeed()", () => {
    test("clamps speed to 0.5-2.0 range", () => {
      const mgr = new AudioStreamManager();
      mgr.setSpeed(3.0);
      expect(mgr.speed).toBe(2.0);
      mgr.setSpeed(0.1);
      expect(mgr.speed).toBe(0.5);
      mgr.setSpeed(1.5);
      expect(mgr.speed).toBe(1.5);
    });

    test("applies speed to currently active speech audio", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      mgr.setSpeed(1.5);
      expect(mgr._speechAudio.playbackRate).toBe(1.5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // queueSpeech()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("queueSpeech()", () => {
    test("creates blob URL and sets as speech audio src", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const wavData = new ArrayBuffer(100);
      mgr.queueSpeech(wavData);

      // processQueue is synchronous
      expect(mgr._speechAudio.src).toMatch(/^blob:/);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test("calls play() on speech audio", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const speechAudio = mgr._speechAudio;
      speechAudio.play.mockClear();

      mgr.queueSpeech(new ArrayBuffer(100));
      expect(speechAudio.play).toHaveBeenCalled();
    });

    test("ducks noise gain during speech playback", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseGain = mockCtx.createGain.mock.results[2].value;

      mgr.queueSpeech(new ArrayBuffer(100));

      expect(noiseGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.005,
        expect.any(Number)
      );
    });

    test("unducks noise after speech ends", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseGain = mockCtx.createGain.mock.results[2].value;
      const speechAudio = mgr._speechAudio;

      mgr.queueSpeech(new ArrayBuffer(100));

      // Simulate speech ended via the 'ended' event handler
      const endedHandler = speechAudio.addEventListener.mock.calls.find(
        (c) => c[0] === "ended"
      );
      expect(endedHandler).toBeTruthy();
      // Call the bound handler directly
      mgr._handleEnded();

      expect(noiseGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.02,
        expect.any(Number)
      );
    });

    test("applies current speed as playbackRate", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      mgr.setSpeed(1.5);
      mgr.queueSpeech(new ArrayBuffer(100));

      expect(mgr._speechAudio.playbackRate).toBe(1.5);
    });

    test("processes queue sequentially via ended event", () => {
      const mgr = new AudioStreamManager();
      mgr.start();

      mgr.queueSpeech(new ArrayBuffer(100));
      mgr.queueSpeech(new ArrayBuffer(100));

      // First item starts immediately, second stays queued
      expect(mgr._queue).toHaveLength(1);

      // Simulate first speech ended
      mgr._handleEnded();

      // Second should now be processing
      expect(mgr._queue).toHaveLength(0);
    });

    test("does nothing if not active", () => {
      const mgr = new AudioStreamManager();
      mgr.queueSpeech(new ArrayBuffer(100));
      expect(mgr._queue).toHaveLength(0);
    });

    test("handles playback error and continues queue", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const errorCb = jest.fn();
      mgr.setOnError(errorCb);

      // First play() rejects, second succeeds
      const speechAudio = mgr._speechAudio;
      speechAudio.play
        .mockRejectedValueOnce(new Error("playback failed"))
        .mockResolvedValueOnce(undefined);

      mgr.queueSpeech(new ArrayBuffer(100));
      mgr.queueSpeech(new ArrayBuffer(100));

      // Wait for the rejected promise to propagate
      await new Promise((r) => setTimeout(r, 0));

      expect(errorCb).toHaveBeenCalledWith(
        expect.stringContaining("Audio playback error")
      );
      // Second item should now be processing
      expect(mgr._queue).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Audio routing graph
  // ═══════════════════════════════════════════════════════════════════════════
  describe("audio routing graph", () => {
    test("master gain connects to destination and analyser", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const masterGain = mockCtx.createGain.mock.results[0].value;
      expect(masterGain.connect).toHaveBeenCalledWith(mockCtx.destination);
      expect(masterGain.connect).toHaveBeenCalledWith(
        mockCtx.createAnalyser.mock.results[0].value
      );
    });

    test("speech gain connects to master gain", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const speechGain = mockCtx.createGain.mock.results[1].value;
      const masterGain = mockCtx.createGain.mock.results[0].value;
      expect(speechGain.connect).toHaveBeenCalledWith(masterGain);
    });

    test("noise gain connects to master gain", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseGain = mockCtx.createGain.mock.results[2].value;
      const masterGain = mockCtx.createGain.mock.results[0].value;
      expect(noiseGain.connect).toHaveBeenCalledWith(masterGain);
    });

    test("noise MediaElementSource connects to noise gain", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      // First createMediaElementSource call is for noise
      const noiseSource = mockCtx.createMediaElementSource.mock.results[0].value;
      const noiseGain = mockCtx.createGain.mock.results[2].value;
      expect(noiseSource.connect).toHaveBeenCalledWith(noiseGain);
    });

    test("speech MediaElementSource connects to speech gain", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      // Second createMediaElementSource call is for speech
      const speechSource = mockCtx.createMediaElementSource.mock.results[1].value;
      const speechGain = mockCtx.createGain.mock.results[1].value;
      expect(speechSource.connect).toHaveBeenCalledWith(speechGain);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Noise gain values
  // ═══════════════════════════════════════════════════════════════════════════
  describe("noise gain levels", () => {
    test("noise gain starts at 0.02", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseGain = mockCtx.createGain.mock.results[2].value;
      expect(noiseGain.gain.value).toBe(0.02);
    });

    test("speech gain starts at 1.0", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const speechGain = mockCtx.createGain.mock.results[1].value;
      expect(speechGain.gain.value).toBe(1.0);
    });
  });
});

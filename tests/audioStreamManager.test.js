/**
 * CARD-070: AudioStreamManager — Test Suite
 * Tests for Web Audio API continuous stream, white noise, speech mixing, queue, controls.
 * Author: developer-1
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
  const ctx = {
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
  return ctx;
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

    test("creates and starts looping white noise buffer", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      // Should create a 2-second noise buffer
      expect(mockCtx.createBuffer).toHaveBeenCalledWith(1, 44100 * 2, 44100);
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      // The noise source should be looping and started
      const source = mockCtx.createBufferSource.mock.results[0].value;
      expect(source.loop).toBe(true);
      expect(source.start).toHaveBeenCalled();
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

    test("stops the noise source", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseSource = mockCtx.createBufferSource.mock.results[0].value;
      mgr.stop();
      expect(noiseSource.stop).toHaveBeenCalled();
    });

    test("clears the speech queue", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      // Add to queue without processing (simulate by direct access)
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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // queueSpeech()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("queueSpeech()", () => {
    test("decodes audio data and plays it", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const wavData = new ArrayBuffer(100);
      mgr.queueSpeech(wavData);

      // Wait for async decode
      await new Promise((r) => setTimeout(r, 0));

      expect(mockCtx.decodeAudioData).toHaveBeenCalled();
      // Should have created a new buffer source for speech (in addition to noise source)
      expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(2);
    });

    test("ducks noise gain during speech playback", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseGain = mockCtx.createGain.mock.results[2].value;

      mgr.queueSpeech(new ArrayBuffer(100));
      await new Promise((r) => setTimeout(r, 0));

      expect(noiseGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.005,
        expect.any(Number)
      );
    });

    test("unducks noise after speech ends", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseGain = mockCtx.createGain.mock.results[2].value;

      mgr.queueSpeech(new ArrayBuffer(100));
      await new Promise((r) => setTimeout(r, 0));

      // Simulate speech ended
      const speechSource = mockCtx.createBufferSource.mock.results[1].value;
      speechSource.onended();

      expect(noiseGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.02,
        expect.any(Number)
      );
    });

    test("applies current speed to playback rate", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      mgr.setSpeed(1.5);
      mgr.queueSpeech(new ArrayBuffer(100));
      await new Promise((r) => setTimeout(r, 0));

      const speechSource = mockCtx.createBufferSource.mock.results[1].value;
      expect(speechSource.playbackRate.value).toBe(1.5);
    });

    test("processes queue sequentially", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();

      mgr.queueSpeech(new ArrayBuffer(100));
      mgr.queueSpeech(new ArrayBuffer(100));

      // First item processes immediately
      await new Promise((r) => setTimeout(r, 0));
      // Second should still be queued (first hasn't ended yet)
      expect(mgr._queue).toHaveLength(1);

      // Finish first speech
      const firstSource = mockCtx.createBufferSource.mock.results[1].value;
      firstSource.onended();
      await new Promise((r) => setTimeout(r, 0));

      // Second should now be processing
      expect(mgr._queue).toHaveLength(0);
    });

    test("does nothing if not active", () => {
      const mgr = new AudioStreamManager();
      mgr.queueSpeech(new ArrayBuffer(100));
      expect(mgr._queue).toHaveLength(0);
    });

    test("handles decode error gracefully and continues queue", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const errorCb = jest.fn();
      mgr.setOnError(errorCb);

      mockCtx.decodeAudioData
        .mockRejectedValueOnce(new Error("bad format"))
        .mockResolvedValueOnce(createMockAudioBuffer());

      mgr.queueSpeech(new ArrayBuffer(100));
      mgr.queueSpeech(new ArrayBuffer(100));
      await new Promise((r) => setTimeout(r, 0));

      expect(errorCb).toHaveBeenCalledWith("Audio decode error: bad format");
      // Should continue to second item
      await new Promise((r) => setTimeout(r, 0));
      expect(mockCtx.decodeAudioData).toHaveBeenCalledTimes(2);
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

    test("noise source connects to noise gain", () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      const noiseSource = mockCtx.createBufferSource.mock.results[0].value;
      const noiseGain = mockCtx.createGain.mock.results[2].value;
      expect(noiseSource.connect).toHaveBeenCalledWith(noiseGain);
    });

    test("speech source connects to speech gain", async () => {
      const mgr = new AudioStreamManager();
      mgr.start();
      mgr.queueSpeech(new ArrayBuffer(100));
      await new Promise((r) => setTimeout(r, 0));

      const speechSource = mockCtx.createBufferSource.mock.results[1].value;
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

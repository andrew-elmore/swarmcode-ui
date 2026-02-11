/**
 * CARD-080 QA: WAV header fix + Firebase routing verification.
 * Tests _fixWavHeader patching of streaming placeholder sizes and
 * validates firebase.json rewrite rules for /tts/** routes.
 * Author: qa-1
 * Date: 2026-02-11
 */

import AudioStreamManager from "../src/utils/audioStreamManager";

// ─── Helper: build a minimal WAV buffer ──────────────────────────────────────

function buildWavBuffer({ riffSize, dataSize, totalBytes = 1000 }) {
  const buf = new ArrayBuffer(totalBytes);
  const view = new DataView(buf);

  // RIFF header
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, riffSize, true);

  // WAVE format
  view.setUint8(8, 0x57);  // W
  view.setUint8(9, 0x41);  // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E

  // fmt chunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6D); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); //
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, 22050, true); // sample rate
  view.setUint32(28, 44100, true); // byte rate
  view.setUint16(32, 2, true);    // block align
  view.setUint16(34, 16, true);   // bits per sample

  // data chunk
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  view.setUint32(40, dataSize, true);

  return buf;
}

// ═══════════════════════════════════════════════════════════════════════════════
// _fixWavHeader tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-080: _fixWavHeader", () => {
  let mgr;

  beforeEach(() => {
    mgr = new AudioStreamManager();
  });

  test("patches 0xFFFFFFFF RIFF size to actual file size - 8", () => {
    const buf = buildWavBuffer({ riffSize: 0xFFFFFFFF, dataSize: 0xFFFFFFFF, totalBytes: 1000 });
    mgr._fixWavHeader(buf);
    const view = new DataView(buf);
    expect(view.getUint32(4, true)).toBe(1000 - 8); // 992
  });

  test("patches 0xFFFFFFFF data size to actual file size - 44", () => {
    const buf = buildWavBuffer({ riffSize: 0xFFFFFFFF, dataSize: 0xFFFFFFFF, totalBytes: 1000 });
    mgr._fixWavHeader(buf);
    const view = new DataView(buf);
    expect(view.getUint32(40, true)).toBe(1000 - 44); // 956
  });

  test("patches when only RIFF size is 0xFFFFFFFF", () => {
    const buf = buildWavBuffer({ riffSize: 0xFFFFFFFF, dataSize: 500, totalBytes: 1000 });
    mgr._fixWavHeader(buf);
    const view = new DataView(buf);
    expect(view.getUint32(4, true)).toBe(992);
    expect(view.getUint32(40, true)).toBe(956); // also patched
  });

  test("patches when only data size is 0xFFFFFFFF", () => {
    const buf = buildWavBuffer({ riffSize: 500, dataSize: 0xFFFFFFFF, totalBytes: 1000 });
    mgr._fixWavHeader(buf);
    const view = new DataView(buf);
    expect(view.getUint32(4, true)).toBe(992);
    expect(view.getUint32(40, true)).toBe(956);
  });

  test("does NOT patch when sizes are already valid", () => {
    const buf = buildWavBuffer({ riffSize: 992, dataSize: 956, totalBytes: 1000 });
    mgr._fixWavHeader(buf);
    const view = new DataView(buf);
    // Sizes should remain unchanged
    expect(view.getUint32(4, true)).toBe(992);
    expect(view.getUint32(40, true)).toBe(956);
  });

  test("returns buffer unchanged when too small for WAV header", () => {
    const buf = new ArrayBuffer(20);
    const result = mgr._fixWavHeader(buf);
    expect(result).toBe(buf);
    expect(result.byteLength).toBe(20);
  });

  test("returns buffer unchanged when not a RIFF file", () => {
    const buf = new ArrayBuffer(100);
    const view = new DataView(buf);
    view.setUint8(0, 0x00); // Not 'R'
    view.setUint32(4, 0xFFFFFFFF, true);
    view.setUint32(40, 0xFFFFFFFF, true);
    const result = mgr._fixWavHeader(buf);
    // Sizes should NOT be patched
    expect(new DataView(result).getUint32(4, true)).toBe(0xFFFFFFFF);
  });

  test("handles exact 44-byte buffer (header only, no data)", () => {
    const buf = buildWavBuffer({ riffSize: 0xFFFFFFFF, dataSize: 0xFFFFFFFF, totalBytes: 44 });
    mgr._fixWavHeader(buf);
    const view = new DataView(buf);
    expect(view.getUint32(4, true)).toBe(36);  // 44 - 8
    expect(view.getUint32(40, true)).toBe(0);   // 44 - 44
  });

  test("preserves RIFF magic and WAVE format after patching", () => {
    const buf = buildWavBuffer({ riffSize: 0xFFFFFFFF, dataSize: 0xFFFFFFFF, totalBytes: 500 });
    mgr._fixWavHeader(buf);
    const view = new DataView(buf);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(riff).toBe("RIFF");
    expect(wave).toBe("WAVE");
  });

  test("works with large buffers (1MB)", () => {
    const size = 1024 * 1024;
    const buf = buildWavBuffer({ riffSize: 0xFFFFFFFF, dataSize: 0xFFFFFFFF, totalBytes: size });
    mgr._fixWavHeader(buf);
    const view = new DataView(buf);
    expect(view.getUint32(4, true)).toBe(size - 8);
    expect(view.getUint32(40, true)).toBe(size - 44);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// _processQueue integration: _fixWavHeader is called before decodeAudioData
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-080: _processQueue calls _fixWavHeader", () => {
  let mockCtx;

  beforeEach(() => {
    mockCtx = {
      sampleRate: 44100,
      currentTime: 0,
      state: "running",
      destination: { name: "destination" },
      createGain: jest.fn(() => ({
        gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
        connect: jest.fn(),
      })),
      createBufferSource: jest.fn(() => ({
        buffer: null, loop: false, playbackRate: { value: 1 },
        connect: jest.fn(), start: jest.fn(), stop: jest.fn(), onended: null,
      })),
      createAnalyser: jest.fn(() => ({ fftSize: 0, connect: jest.fn() })),
      createBuffer: jest.fn((ch, len, sr) => ({
        getChannelData: jest.fn(() => new Float32Array(len)),
      })),
      createMediaElementSource: jest.fn(() => { throw new Error("not in test"); }),
      decodeAudioData: jest.fn(() => Promise.resolve({ duration: 1 })),
      close: jest.fn(() => Promise.resolve()),
      resume: jest.fn(() => Promise.resolve()),
    };
    window.AudioContext = jest.fn(() => mockCtx);
  });

  afterEach(() => {
    delete window.AudioContext;
  });

  test("_fixWavHeader is invoked before decodeAudioData in the queue", async () => {
    const mgr = new AudioStreamManager();
    mgr.start();

    const fixSpy = jest.spyOn(mgr, "_fixWavHeader");

    const wavData = buildWavBuffer({ riffSize: 0xFFFFFFFF, dataSize: 0xFFFFFFFF, totalBytes: 200 });
    mgr.queueSpeech(wavData);

    await new Promise((r) => setTimeout(r, 10));

    expect(fixSpy).toHaveBeenCalledTimes(1);
    expect(mockCtx.decodeAudioData).toHaveBeenCalledTimes(1);

    // Verify decodeAudioData received the fixed buffer (sizes patched)
    const decodedArg = mockCtx.decodeAudioData.mock.calls[0][0];
    const view = new DataView(decodedArg);
    expect(view.getUint32(4, true)).toBe(200 - 8);
    expect(view.getUint32(40, true)).toBe(200 - 44);

    mgr.stop();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Firebase routing verification (static analysis)
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-080: Firebase routing", () => {
  const fs = require("fs");
  const path = require("path");

  const firebaseFiles = [
    path.resolve(__dirname, "../../firebase.json"),
    path.resolve(__dirname, "../../swarmcode-devops/firebase.json"),
    path.resolve(__dirname, "../firebase.json"),
  ];

  for (const filePath of firebaseFiles) {
    const label = filePath.includes("swarmcode-devops")
      ? "swarmcode-devops/firebase.json"
      : filePath.includes("swarmcode-ui")
        ? "swarmcode-ui/firebase.json"
        : "root firebase.json";

    describe(label, () => {
      let config;

      beforeAll(() => {
        const raw = fs.readFileSync(filePath, "utf8");
        config = JSON.parse(raw);
      });

      test("has /tts/** rewrite rule", () => {
        const ttsRule = config.hosting.rewrites.find((r) => r.source === "/tts/**");
        expect(ttsRule).toBeDefined();
      });

      test("/tts/** routes to swarmcode-api Cloud Run service", () => {
        const ttsRule = config.hosting.rewrites.find((r) => r.source === "/tts/**");
        expect(ttsRule.run.serviceId).toBe("swarmcode-api");
        expect(ttsRule.run.region).toBe("us-central1");
      });

      test("/tts/** rule comes BEFORE ** catch-all", () => {
        const rewrites = config.hosting.rewrites;
        const ttsIndex = rewrites.findIndex((r) => r.source === "/tts/**");
        const catchAllIndex = rewrites.findIndex((r) => r.source === "**");
        expect(ttsIndex).toBeLessThan(catchAllIndex);
      });
    });
  }
});

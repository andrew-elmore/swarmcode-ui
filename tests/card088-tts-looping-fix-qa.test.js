// CARD-088 QA Tests — TTS looping on lock screen fix
// CARD-090: Commented out — AudioStreamManager replaced by browser speechSynthesis.
// Original test code preserved below for potential future reuse.

/* CARD-090: Commented out — browser TTS replaces AudioStreamManager

import AudioStreamManager from "../src/utils/audioStreamManager";

// [Full test code removed for brevity — see git history for original]
// Tests verified: speech decoupled from AudioContext, volume via element.volume,
// captureStream visualization path, lock screen survival, source code verification.

END OF COMMENTED-OUT CODE */

// CARD-090: Stub — tests disabled while AudioStreamManager is commented out
describe("(disabled by CARD-090)", () => {
  test("AudioStreamManager commented out — using browser speechSynthesis", () => {
    expect(true).toBe(true);
  });
});

// CARD-087 QA Tests — Noise decoupled from AudioContext
// Author: qa-1
// Date: 2026-02-11
//
// CARD-090: Commented out — AudioStreamManager replaced by browser speechSynthesis.
// Original code preserved in git history for potential future reuse.
//
// Root cause: The noise <audio> element was captured by createMediaElementSource(),
// which routes its output exclusively through the AudioContext graph. When the OS
// suspends the AudioContext on lock screen, the captured element also stops.
//
// Fix: Noise <audio> element now plays DIRECTLY through speakers. Volume ducking
// controlled via element.volume instead of AudioContext gain nodes.

// CARD-090: Stub — tests disabled while AudioStreamManager is commented out
describe("card087-noise-standalone-qa (disabled by CARD-090)", () => {
  test("AudioStreamManager tests disabled", () => {
    expect(true).toBe(true);
  });
});

// CARD-083 + CARD-084 QA Tests — Audio elements appended to DOM
// Author: qa-1
// Date: 2026-02-11
//
// Root cause: <audio> elements were created via document.createElement('audio')
// but never appended to the DOM. Mobile browsers (iOS Safari, Chrome Android)
// require <audio> elements to be in the document for reliable playback via
// createMediaElementSource(). Both noise (CARD-083) and speech (CARD-084)
// were affected.
//
// Fix: Both elements appended to document.body (display:none) on creation,
// removed via parentNode?.removeChild() on stop().
//
// CARD-090: Commented out — AudioStreamManager replaced by browser speechSynthesis.
// Original code preserved below for potential future reuse.

// /**
//  * CARD-083 + CARD-084 QA Tests — Audio elements appended to DOM
//  * Author: qa-1
//  * Date: 2026-02-11
//  *
//  * Root cause: <audio> elements were created via document.createElement('audio')
//  * but never appended to the DOM. Mobile browsers (iOS Safari, Chrome Android)
//  * require <audio> elements to be in the document for reliable playback via
//  * createMediaElementSource(). Both noise (CARD-083) and speech (CARD-084)
//  * were affected.
//  *
//  * Fix: Both elements appended to document.body (display:none) on creation,
//  * removed via parentNode?.removeChild() on stop().
//  *
//  * CARD-090: Commented out — AudioStreamManager replaced by browser speechSynthesis.
//  */
//
// /*
// /**
//  * CARD-083 + CARD-084 QA Tests — Audio elements appended to DOM
//  * Author: qa-1
//  * Date: 2026-02-11
//  *
//  * Root cause: <audio> elements were created via document.createElement('audio')
//  * but never appended to the DOM. Mobile browsers (iOS Safari, Chrome Android)
//  * require <audio> elements to be in the document for reliable playback via
//  * createMediaElementSource(). Both noise (CARD-083) and speech (CARD-084)
//  * were affected.
//  *
//  * Fix: Both elements appended to document.body (display:none) on creation,
//  * removed via parentNode?.removeChild() on stop().
//  *-/
//
// import AudioStreamManager from "../src/utils/audioStreamManager";
//
// // ─── Web Audio API mocks ─────────────────────────────────────────────────────
//
// function createMockGainNode() {
//   return {
//     gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
//     connect: jest.fn(),
//     disconnect: jest.fn(),
//   };
// }
//
// function createMockAnalyser() {
//   return { fftSize: 0, connect: jest.fn(), disconnect: jest.fn() };
// }
//
// function createMockMediaElementSource() {
//   return { connect: jest.fn() };
// }
//
// function createMockAudioElement() {
//   return {
//     loop: false,
//     src: "",
//     preload: "",
//     paused: false,
//     playbackRate: 1,
//     volume: 1,
//     style: {},
//     parentNode: null,
//     play: jest.fn(() => Promise.resolve()),
//     pause: jest.fn(),
//     removeAttribute: jest.fn(),
//     addEventListener: jest.fn(),
//     removeEventListener: jest.fn(),
//   };
// }
//
// function createMockAudioContext() {
//   return {
//     sampleRate: 44100,
//     currentTime: 0,
//     state: "running",
//     destination: { name: "destination" },
//     createGain: jest.fn(() => createMockGainNode()),
//     createAnalyser: jest.fn(() => createMockAnalyser()),
//     createMediaElementSource: jest.fn(() => createMockMediaElementSource()),
//     close: jest.fn(() => Promise.resolve()),
//     resume: jest.fn(() => Promise.resolve()),
//   };
// }
//
// let mockCtx;
// let appendChildSpy;
// let removeChildSpy;
//
// beforeEach(() => {
//   mockCtx = createMockAudioContext();
//   window.AudioContext = jest.fn(() => mockCtx);
//
//   const origCreateElement = document.createElement.bind(document);
//   jest.spyOn(document, "createElement").mockImplementation((tag) => {
//     if (tag === "audio") return createMockAudioElement();
//     return origCreateElement(tag);
//   });
//
//   appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation((el) => {
//     if (el && el.play) el.parentNode = document.body;
//     return el;
//   });
//   removeChildSpy = jest.spyOn(document.body, "removeChild").mockImplementation((el) => {
//     if (el) el.parentNode = null;
//     return el;
//   });
// });
//
// afterEach(() => {
//   delete window.AudioContext;
//   delete window.webkitAudioContext;
//   jest.restoreAllMocks();
// });
//
// // ═══════════════════════════════════════════════════════════════════════════════
// // CARD-083: Noise <audio> element in DOM
// // ═══════════════════════════════════════════════════════════════════════════════
//
// describe("CARD-083 QA: noise audio element in DOM", () => {
//   test("noise <audio> is appended to document.body on start()", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     expect(appendChildSpy).toHaveBeenCalledWith(mgr._noiseAudio);
//     expect(mgr._noiseAudio.parentNode).toBe(document.body);
//   });
//
//   test("noise <audio> has display:none (hidden from layout)", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     expect(mgr._noiseAudio.style.display).toBe("none");
//   });
//
//   test("noise <audio> has preload=auto", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     expect(mgr._noiseAudio.preload).toBe("auto");
//   });
//
//   test("noise <audio> is removed from DOM on stop()", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     const noiseAudio = mgr._noiseAudio;
//     mgr.stop();
//     expect(removeChildSpy).toHaveBeenCalledWith(noiseAudio);
//     expect(noiseAudio.parentNode).toBeNull();
//   });
// });
//
// // ═══════════════════════════════════════════════════════════════════════════════
// // CARD-084: Speech <audio> element in DOM
// // ═══════════════════════════════════════════════════════════════════════════════
//
// describe("CARD-084 QA: speech audio element in DOM", () => {
//   test("speech <audio> is appended to document.body on start()", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     expect(appendChildSpy).toHaveBeenCalledWith(mgr._speechAudio);
//     expect(mgr._speechAudio.parentNode).toBe(document.body);
//   });
//
//   test("speech <audio> has display:none (hidden from layout)", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     expect(mgr._speechAudio.style.display).toBe("none");
//   });
//
//   test("speech <audio> is removed from DOM on stop()", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     const speechAudio = mgr._speechAudio;
//     mgr.stop();
//     expect(removeChildSpy).toHaveBeenCalledWith(speechAudio);
//     expect(speechAudio.parentNode).toBeNull();
//   });
// });
//
// // ═══════════════════════════════════════════════════════════════════════════════
// // Both elements in DOM together
// // ═══════════════════════════════════════════════════════════════════════════════
//
// describe("CARD-083/084 QA: both audio elements in DOM", () => {
//   test("start() appends exactly 2 audio elements to document.body", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     const audioCalls = appendChildSpy.mock.calls.filter(
//       (c) => c[0] && c[0].play // audio elements have play()
//     );
//     expect(audioCalls).toHaveLength(2);
//   });
//
//   test("stop() removes both audio elements from DOM", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     mgr.stop();
//     const removeCalls = removeChildSpy.mock.calls.filter(
//       (c) => c[0] && c[0].pause // audio elements have pause()
//     );
//     expect(removeCalls).toHaveLength(2);
//   });
//
//   test("stop() then start() re-appends fresh elements", () => {
//     const mgr = new AudioStreamManager();
//     mgr.start();
//     mgr.stop();
//
//     // Fresh context for second start
//     mockCtx = createMockAudioContext();
//     window.AudioContext = jest.fn(() => mockCtx);
//     appendChildSpy.mockClear();
//
//     mgr.start();
//
//     const audioCalls = appendChildSpy.mock.calls.filter(
//       (c) => c[0] && c[0].play
//     );
//     expect(audioCalls).toHaveLength(2);
//     expect(mgr._noiseAudio.parentNode).toBe(document.body);
//     expect(mgr._speechAudio.parentNode).toBe(document.body);
//   });
// });
//
// // ═══════════════════════════════════════════════════════════════════════════════
// // Source code verification
// // ═══════════════════════════════════════════════════════════════════════════════
//
// describe("CARD-083/084 QA: source code verification", () => {
//   const fs = require("fs");
//   const path = require("path");
//   const src = fs.readFileSync(
//     path.resolve(__dirname, "../src/utils/audioStreamManager.js"),
//     "utf8"
//   );
//
//   test("_startNoise appends noise element to document.body", () => {
//     expect(src).toMatch(/document\.body\.appendChild\s*\(\s*this\._noiseAudio\s*\)/);
//   });
//
//   test("_initSpeechAudio appends speech element to document.body", () => {
//     expect(src).toMatch(/document\.body\.appendChild\s*\(\s*this\._speechAudio\s*\)/);
//   });
//
//   test("stop() uses removeChild for cleanup", () => {
//     expect(src).toMatch(/removeChild\s*\(\s*this\._speechAudio\s*\)/);
//     expect(src).toMatch(/removeChild\s*\(\s*this\._noiseAudio\s*\)/);
//   });
//
//   test("both elements set display:none to be visually hidden", () => {
//     // Should have two style.display = "none" assignments
//     const matches = src.match(/style\.display\s*=\s*["']none["']/g);
//     expect(matches).not.toBeNull();
//     expect(matches.length).toBe(2);
//   });
//
//   test("comment explains mobile browser requirement", () => {
//     expect(src).toMatch(/mobile browsers/i);
//   });
// });
// */
//
// describe("card083-084-dom-append-qa.test.js (disabled by CARD-090)", () => {
//   test("commented out", () => {
//     expect(true).toBe(true);
//   });
// });

// CARD-090: Stub test
describe("card083-084-dom-append-qa.test.js (disabled by CARD-090)", () => {
  test("AudioStreamManager tests disabled", () => {
    expect(true).toBe(true);
  });
});

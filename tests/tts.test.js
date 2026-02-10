/**
 * CARD-031: Audio Stream / TTS — Test Suite
 * Tests for preprocessText(), TtsEngine class, and TtsControls component.
 * Author: qa-1
 * Date: 2026-02-10
 */

import { preprocessText } from "../src/utils/ttsEngine";
import TtsEngine from "../src/utils/ttsEngine";

// ─── SpeechSynthesisUtterance mock (jsdom doesn't provide it) ─────────────────
class MockUtterance {
  constructor(text) {
    this.text = text;
    this.voice = null;
    this.rate = 1;
    this.volume = 1;
    this.onend = null;
    this.onerror = null;
  }
}
global.SpeechSynthesisUtterance = MockUtterance;

// ─── speechSynthesis mock ─────────────────────────────────────────────────────
function createSynthMock() {
  return {
    getVoices: jest.fn(() => [
      { name: "English US", lang: "en-US", default: true },
      { name: "English UK", lang: "en-GB", default: false },
    ]),
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    onvoiceschanged: undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2.1  Unit Tests: preprocessText()  — Test Cases 1-21
// ═══════════════════════════════════════════════════════════════════════════════
describe("preprocessText", () => {
  // TC-1: Code block removal (fenced)
  test("TC-01: replaces fenced code blocks with 'code block'", () => {
    const input = "```js\nconsole.log();\n```";
    expect(preprocessText(input)).toBe("code block");
  });

  // TC-2: Inline code removal
  test("TC-02: removes inline code", () => {
    const input = "`myVar`";
    expect(preprocessText(input)).toBe("");
  });

  // TC-3: URL replacement
  test("TC-03: replaces URLs with 'link'", () => {
    const input = "Visit https://example.com/foo";
    expect(preprocessText(input)).toBe("Visit link");
  });

  // TC-4: File path removal
  test("TC-04: removes file paths", () => {
    const input = "See src/components/App.jsx";
    expect(preprocessText(input)).toBe("See");
  });

  // TC-5: Card ID normalization — CARD-024 -> "card 24"
  test("TC-05: normalizes CARD-024 to 'card 24'", () => {
    const input = "See CARD-024";
    expect(preprocessText(input)).toBe("See card 24");
  });

  // TC-6: Card ID leading zeros stripped — CARD-001 -> "card 1"
  test("TC-06: strips leading zeros from card IDs (CARD-001 -> card 1)", () => {
    const input = "CARD-001";
    expect(preprocessText(input)).toBe("card 1");
  });

  // TC-7: Agent name: pm-1
  test("TC-07: converts agent name pm-1 to 'p m 1'", () => {
    const input = "pm-1 says";
    expect(preprocessText(input)).toBe("p m 1 says");
  });

  // TC-8: Agent name: senior-dev-1
  test("TC-08: converts agent name senior-dev-1 to 'senior dev 1'", () => {
    const input = "senior-dev-1";
    expect(preprocessText(input)).toBe("senior dev 1");
  });

  // TC-9: Agent name: devops-1
  test("TC-09: converts agent name devops-1 to 'dev ops 1'", () => {
    const input = "devops-1";
    expect(preprocessText(input)).toBe("dev ops 1");
  });

  // TC-10: Number 123 -> "one twenty three"
  test("TC-10: converts 123 to 'one twenty three'", () => {
    const input = "Bug 123";
    expect(preprocessText(input)).toBe("Bug one twenty three");
  });

  // TC-11: Number 2345 -> "twenty three forty five"
  test("TC-11: converts 2345 to 'twenty three forty five'", () => {
    const input = "Issue 2345";
    expect(preprocessText(input)).toBe("Issue twenty three forty five");
  });

  // TC-12: Number 100 -> "one hundred"
  test("TC-12: converts 100 to 'one hundred'", () => {
    const input = "100 tests";
    expect(preprocessText(input)).toBe("one hundred tests");
  });

  // TC-13: Number 205 -> "two oh five"
  test("TC-13: converts 205 to 'two oh five'", () => {
    const input = "Error 205";
    expect(preprocessText(input)).toBe("Error two oh five");
  });

  // TC-14: Number 1000 -> "ten hundred"
  test("TC-14: converts 1000 to 'ten hundred'", () => {
    const input = "1000";
    expect(preprocessText(input)).toBe("ten hundred");
  });

  // TC-15: Numbers < 100 left as-is
  test("TC-15: leaves numbers < 100 as-is", () => {
    const input = "42 tests";
    expect(preprocessText(input)).toBe("42 tests");
  });

  // TC-16: Numbers >= 10000 left as-is
  test("TC-16: leaves numbers >= 10000 as-is", () => {
    const input = "99999";
    expect(preprocessText(input)).toBe("99999");
  });

  // TC-17: Markdown stripping: ---
  test("TC-17: converts --- to '.'", () => {
    const input = "---";
    expect(preprocessText(input)).toBe(".");
  });

  // TC-18: Markdown stripping: special chars
  test("TC-18: strips markdown special characters", () => {
    const input = "**bold** _italic_";
    expect(preprocessText(input)).toBe("bold italic");
  });

  // TC-19: Whitespace normalization
  test("TC-19: normalizes whitespace", () => {
    const input = "  hello   world  ";
    expect(preprocessText(input)).toBe("hello world");
  });

  // TC-20: Combined pipeline — full message
  test("TC-20: processes combined message through full pipeline", () => {
    const input = "pm-1 says: check `myVar` at https://example.com and CARD-024 has 205 issues\n---";
    const result = preprocessText(input);
    // pm-1 -> "p m 1", inline code removed, URL -> "link", CARD-024 -> "card 24",
    // 205 -> "two oh five", --- -> "."
    expect(result).toContain("p m 1");
    expect(result).not.toContain("`");
    expect(result).toContain("link");
    expect(result).toContain("card 24");
    expect(result).toContain("two oh five");
    expect(result).not.toContain("---");
    // Verify no extra whitespace
    expect(result).not.toMatch(/ {2}/);
  });

  // TC-21: Empty string
  test("TC-21: returns empty string for empty input", () => {
    expect(preprocessText("")).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2.2  Unit Tests: TtsEngine class — Test Cases 22-29
// ═══════════════════════════════════════════════════════════════════════════════
describe("TtsEngine", () => {
  let synthMock;
  let originalSpeechSynthesis;

  beforeEach(() => {
    synthMock = createSynthMock();
    originalSpeechSynthesis = window.speechSynthesis;
    Object.defineProperty(window, "speechSynthesis", {
      value: synthMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: originalSpeechSynthesis,
      writable: true,
      configurable: true,
    });
  });

  // TC-22: Constructor defaults
  test("TC-22: constructor initializes with correct defaults", () => {
    const engine = new TtsEngine();
    expect(engine.enabled).toBe(false);
    expect(engine.rate).toBe(1.0);
    expect(engine.volume).toBe(1.0);
    expect(engine.speaking).toBe(false);
  });

  // TC-23: setEnabled
  test("TC-23: setEnabled reflects change in getter", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    expect(engine.enabled).toBe(true);
    engine.setEnabled(false);
    expect(engine.enabled).toBe(false);
  });

  // TC-24: setEnabled(false) calls stop()
  test("TC-24: setEnabled(false) calls stop() (cancels synth)", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    engine.setEnabled(false);
    expect(synthMock.cancel).toHaveBeenCalled();
  });

  // TC-25: setRate clamped 0.5-2.0
  test("TC-25: setRate clamps value between 0.5 and 2.0", () => {
    const engine = new TtsEngine();
    engine.setRate(0.1);
    expect(engine.rate).toBe(0.5);
    engine.setRate(5);
    expect(engine.rate).toBe(2.0);
    engine.setRate(1.5);
    expect(engine.rate).toBe(1.5);
  });

  // TC-26: setVolume clamped 0-1
  test("TC-26: setVolume clamps value between 0 and 1", () => {
    const engine = new TtsEngine();
    engine.setVolume(-1);
    expect(engine.volume).toBe(0);
    engine.setVolume(2);
    expect(engine.volume).toBe(1);
    engine.setVolume(0.7);
    expect(engine.volume).toBe(0.7);
  });

  // TC-27: speak() does nothing when disabled
  test("TC-27: speak() does nothing when engine is disabled", () => {
    const engine = new TtsEngine();
    // engine is disabled by default
    engine.speak("Hello world");
    expect(synthMock.speak).not.toHaveBeenCalled();
  });

  // TC-28: speak() preprocesses and queues when enabled
  // Note: setEnabled(true) calls synth.speak(emptyUtterance) to unlock audio,
  // so the actual utterance from engine.speak() is the second call.
  test("TC-28: speak() preprocesses text and calls synth.speak when enabled", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    engine.speak("Hello world");
    expect(synthMock.speak).toHaveBeenCalledTimes(2);
    const utterance = synthMock.speak.mock.calls[1][0];
    expect(utterance).toBeInstanceOf(MockUtterance);
    expect(utterance.text).toBe("Hello world");
  });

  // TC-29: stop() clears queue and cancels
  test("TC-29: stop() clears queue and calls synth.cancel()", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    engine.stop();
    expect(synthMock.cancel).toHaveBeenCalled();
    expect(engine.speaking).toBe(false);
  });
});

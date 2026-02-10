/**
 * CARD-050 QA Tests — TTS autoplay policy unlock + Chrome 15-second bug workaround.
 *
 * Verifies:
 * 1. setEnabled(true) speaks an empty utterance to unlock audio (autoplay policy)
 * 2. setEnabled(true) starts a resume timer (Chrome 15s workaround)
 * 3. setEnabled(false) calls stop() and clears the resume timer
 * 4. speak() preprocesses text, chunks long text, and queues utterances
 * 5. onerror with "canceled" does NOT trigger onError callback
 * 6. onerror with other errors triggers onError callback
 * 7. stop() clears queue and cancels synth
 */

import TtsEngine, { preprocessText } from "../src/utils/ttsEngine";

// Mock the Web Speech API
let mockSynth;
let mockUtterances;

beforeEach(() => {
  mockUtterances = [];
  mockSynth = {
    speak: jest.fn((utt) => {
      mockUtterances.push(utt);
    }),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn().mockReturnValue([
      { name: "Google UK English Male", lang: "en-GB", default: true },
    ]),
    speaking: false,
    onvoiceschanged: undefined,
  };
  Object.defineProperty(window, "speechSynthesis", {
    value: mockSynth,
    writable: true,
    configurable: true,
  });

  // Mock SpeechSynthesisUtterance
  global.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
    text,
    rate: 1,
    volume: 1,
    voice: null,
    onend: null,
    onerror: null,
  }));

  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ─── Autoplay Policy Unlock ─────────────────────────────────────────────────

describe("CARD-050: Autoplay policy unlock on enable", () => {
  test("setEnabled(true) speaks an empty utterance to unlock audio", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);

    // Should have called synth.speak with an empty utterance
    expect(mockSynth.speak).toHaveBeenCalled();
    const firstCall = mockSynth.speak.mock.calls[0][0];
    expect(firstCall.text).toBe("");
  });

  test("setEnabled(false) calls stop and cancels synth", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    mockSynth.speak.mockClear();
    mockSynth.cancel.mockClear();

    engine.setEnabled(false);
    expect(mockSynth.cancel).toHaveBeenCalled();
    expect(engine.enabled).toBe(false);
  });

  test("autoplay unlock error triggers onError callback", () => {
    // Make synth.speak throw on empty utterance
    mockSynth.speak.mockImplementationOnce(() => {
      throw new Error("NotAllowedError");
    });

    const errorHandler = jest.fn();
    const engine = new TtsEngine();
    engine.setOnError(errorHandler);
    engine.setEnabled(true);

    expect(errorHandler).toHaveBeenCalledWith(
      expect.stringContaining("Failed to unlock audio")
    );
  });
});

// ─── Chrome 15-Second Bug Workaround ────────────────────────────────────────

describe("CARD-050: Chrome 15s resume timer", () => {
  test("setEnabled(true) starts a 10s interval timer", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);

    // Simulate synth is speaking
    mockSynth.speaking = true;
    mockSynth.pause.mockClear();
    mockSynth.resume.mockClear();

    // Advance 10s — timer should fire
    jest.advanceTimersByTime(10000);
    expect(mockSynth.pause).toHaveBeenCalledTimes(1);
    expect(mockSynth.resume).toHaveBeenCalledTimes(1);
  });

  test("resume timer does not pause/resume when not speaking", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    mockSynth.speaking = false;
    mockSynth.pause.mockClear();
    mockSynth.resume.mockClear();

    jest.advanceTimersByTime(10000);
    expect(mockSynth.pause).not.toHaveBeenCalled();
    expect(mockSynth.resume).not.toHaveBeenCalled();
  });

  test("setEnabled(false) clears the resume timer", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    engine.setEnabled(false);

    mockSynth.speaking = true;
    mockSynth.pause.mockClear();
    mockSynth.resume.mockClear();

    jest.advanceTimersByTime(20000);
    expect(mockSynth.pause).not.toHaveBeenCalled();
    expect(mockSynth.resume).not.toHaveBeenCalled();
  });

  test("multiple enable/disable cycles do not leak timers", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    engine.setEnabled(false);
    engine.setEnabled(true);
    engine.setEnabled(false);
    engine.setEnabled(true);

    mockSynth.speaking = true;
    mockSynth.pause.mockClear();
    mockSynth.resume.mockClear();

    // After 10s, only ONE timer should be active (not 3)
    jest.advanceTimersByTime(10000);
    expect(mockSynth.pause).toHaveBeenCalledTimes(1);
    expect(mockSynth.resume).toHaveBeenCalledTimes(1);
  });
});

// ─── Speech Error Handling ──────────────────────────────────────────────────

describe("CARD-050: Speech error handling", () => {
  test("onerror with 'canceled' does NOT trigger onError callback", () => {
    const errorHandler = jest.fn();
    const engine = new TtsEngine();
    engine.setOnError(errorHandler);
    engine.setEnabled(true);
    mockSynth.speak.mockClear();
    errorHandler.mockClear();

    engine.speak("Hello world");

    // Find the utterance that was queued (not the unlock utterance)
    const utterances = mockSynth.speak.mock.calls;
    expect(utterances.length).toBeGreaterThan(0);
    const lastUtt = utterances[utterances.length - 1][0];

    // Simulate a "canceled" error
    lastUtt.onerror({ error: "canceled" });
    expect(errorHandler).not.toHaveBeenCalled();
  });

  test("onerror with non-canceled error triggers onError callback", () => {
    const errorHandler = jest.fn();
    const engine = new TtsEngine();
    engine.setOnError(errorHandler);
    engine.setEnabled(true);
    mockSynth.speak.mockClear();
    errorHandler.mockClear();

    engine.speak("Hello world");

    const utterances = mockSynth.speak.mock.calls;
    const lastUtt = utterances[utterances.length - 1][0];

    // Simulate an "audio-busy" error
    lastUtt.onerror({ error: "audio-busy" });
    expect(errorHandler).toHaveBeenCalledWith("Speech error: audio-busy");
  });

  test("stop() clears queue and cancels synth", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    mockSynth.cancel.mockClear();

    engine.speak("First message");
    engine.speak("Second message");
    engine.stop();

    expect(mockSynth.cancel).toHaveBeenCalled();
    expect(engine.speaking).toBe(false);
  });
});

// ─── Text Preprocessing Pipeline ────────────────────────────────────────────

describe("CARD-050: Text preprocessing pipeline", () => {
  test("code blocks are replaced with 'code block'", () => {
    expect(preprocessText("Here is ```const x = 1;``` some code")).toContain("code block");
    expect(preprocessText("Here is ```const x = 1;``` some code")).not.toContain("const");
  });

  test("inline code is stripped", () => {
    expect(preprocessText("Use `npm install` to install")).not.toContain("npm install");
  });

  test("URLs are replaced with 'link'", () => {
    expect(preprocessText("Visit https://example.com for details")).toContain("link");
    expect(preprocessText("Visit https://example.com for details")).not.toContain("example.com");
  });

  test("CARD IDs are normalized (CARD-024 -> card 24)", () => {
    expect(preprocessText("Working on CARD-024")).toContain("card 24");
    expect(preprocessText("Working on CARD-024")).not.toContain("CARD-024");
  });

  test("agent names are expanded for speech", () => {
    expect(preprocessText("pm-1 assigned the task")).toContain("p m 1");
    expect(preprocessText("developer-1 fixed it")).toContain("developer 1");
  });

  test("special characters are stripped", () => {
    const result = preprocessText("## Header | **bold** _italic_");
    expect(result).not.toContain("#");
    expect(result).not.toContain("|");
    expect(result).not.toContain("*");
    expect(result).not.toContain("_");
  });

  test("3-4 digit numbers are read as word groups", () => {
    // 123 -> "one twenty three"
    expect(preprocessText("Error 123")).toContain("one twenty three");
    // 2345 -> "twenty three forty five"
    expect(preprocessText("Port 2345")).toContain("twenty three forty five");
  });
});

// ─── speak() Integration ────────────────────────────────────────────────────

describe("CARD-050: speak() processes and queues text", () => {
  test("speak() does nothing when disabled", () => {
    const engine = new TtsEngine();
    // engine is disabled by default
    mockSynth.speak.mockClear();
    engine.speak("Should not speak");
    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  test("speak() does nothing with empty text", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    mockSynth.speak.mockClear();

    engine.speak("");
    engine.speak(null);
    engine.speak(undefined);
    // No new speak calls (beyond what setEnabled may have triggered)
    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  test("speak() preprocesses text before speaking", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    mockSynth.speak.mockClear();

    engine.speak("Check CARD-042 for details");

    expect(mockSynth.speak).toHaveBeenCalled();
    const spokenText = mockSynth.speak.mock.calls[0][0].text;
    expect(spokenText).toContain("card 42");
    expect(spokenText).not.toContain("CARD-042");
  });

  test("speak() sets rate and volume on utterance", () => {
    const engine = new TtsEngine();
    engine.setEnabled(true);
    engine.setRate(1.5);
    engine.setVolume(0.8);
    mockSynth.speak.mockClear();

    engine.speak("Test message");

    const utterance = mockSynth.speak.mock.calls[0][0];
    expect(utterance.rate).toBe(1.5);
    expect(utterance.volume).toBe(0.8);
  });
});

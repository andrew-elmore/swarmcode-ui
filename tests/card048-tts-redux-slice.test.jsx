/**
 * CARD-048 QA Tests — TTS Redux slice (state persistence, actions, error state).
 *
 * Verifies:
 * 1. TTS state persists to localStorage via saveToStorage on each action
 * 2. Actions (setEnabled, setVolume, setRate) update state correctly
 * 3. Volume is clamped to [0, 1], rate to [0.5, 2.0]
 * 4. Error state (setError, clearError) is managed correctly and NOT persisted
 *
 * Updated: 2026-02-11 (CARD-074: removed deprecated setAgentVoice, setSpeakAgentName, TtsControls)
 * Updated: 2026-02-11 (CARD-078: enabled no longer persisted — AudioContext requires user gesture)
 * Updated: 2026-02-11 (CARD-090: added voice, queue, currentIndex to state shape)
 */

import { configureStore } from "@reduxjs/toolkit";
import ttsReducer, {
  setEnabled,
  setVolume,
  setRate,
  setVoice,
  setError,
  clearError,
  enqueueMessage,
  advanceQueue,
  clearQueue,
} from "../src/store/ttsSlice";

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
};

function createTestStore(ttsOverrides = {}) {
  return configureStore({
    reducer: { tts: ttsReducer },
    preloadedState: { tts: { ...DEFAULT_TTS_STATE, ...ttsOverrides } },
  });
}

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] ?? null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
});

afterEach(() => jest.restoreAllMocks());

// ─── Redux Slice Unit Tests ─────────────────────────────────────────────────

describe("CARD-048: ttsSlice reducer actions", () => {
  test("setEnabled updates enabled state", () => {
    const store = createTestStore();
    store.dispatch(setEnabled(true));
    expect(store.getState().tts.enabled).toBe(true);
    store.dispatch(setEnabled(false));
    expect(store.getState().tts.enabled).toBe(false);
  });

  test("setEnabled(false) clears queue and resets currentIndex", () => {
    const store = createTestStore({
      enabled: true,
      queue: [{ id: 1, from: "pm-1", message: "hello", status: "speaking" }],
      currentIndex: 0,
    });
    store.dispatch(setEnabled(false));
    expect(store.getState().tts.queue).toEqual([]);
    expect(store.getState().tts.currentIndex).toBe(-1);
  });

  test("setVolume clamps to [0, 1]", () => {
    const store = createTestStore();
    store.dispatch(setVolume(0.5));
    expect(store.getState().tts.volume).toBe(0.5);

    store.dispatch(setVolume(-0.5));
    expect(store.getState().tts.volume).toBe(0);

    store.dispatch(setVolume(1.5));
    expect(store.getState().tts.volume).toBe(1);
  });

  test("setRate clamps to [0.5, 2.0]", () => {
    const store = createTestStore();
    store.dispatch(setRate(1.5));
    expect(store.getState().tts.rate).toBe(1.5);

    store.dispatch(setRate(0.1));
    expect(store.getState().tts.rate).toBe(0.5);

    store.dispatch(setRate(3.0));
    expect(store.getState().tts.rate).toBe(2.0);
  });

  test("setVoice updates voice state", () => {
    const store = createTestStore();
    store.dispatch(setVoice("Samantha"));
    expect(store.getState().tts.voice).toBe("Samantha");
  });

  test("setError and clearError manage error state", () => {
    const store = createTestStore();
    store.dispatch(setError("Speech error: audio-busy"));
    expect(store.getState().tts.error).toBe("Speech error: audio-busy");
    store.dispatch(clearError());
    expect(store.getState().tts.error).toBeNull();
  });
});

// ─── Queue Management Tests ─────────────────────────────────────────────────

describe("CARD-090: ttsSlice queue management", () => {
  test("enqueueMessage adds message to queue", () => {
    const store = createTestStore({ enabled: true });
    store.dispatch(enqueueMessage({ from: "pm-1", message: "Hello" }));
    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].from).toBe("pm-1");
    expect(queue[0].message).toBe("Hello");
    expect(queue[0].status).toBe("speaking"); // auto-starts when idle
  });

  test("enqueueMessage auto-starts first message when idle and enabled", () => {
    const store = createTestStore({ enabled: true });
    store.dispatch(enqueueMessage({ from: "pm-1", message: "First" }));
    expect(store.getState().tts.currentIndex).toBe(0);
    expect(store.getState().tts.queue[0].status).toBe("speaking");
  });

  test("enqueueMessage queues as pending when another message is speaking", () => {
    const store = createTestStore({ enabled: true });
    store.dispatch(enqueueMessage({ from: "pm-1", message: "First" }));
    store.dispatch(enqueueMessage({ from: "qa-1", message: "Second" }));
    expect(store.getState().tts.queue[1].status).toBe("pending");
    expect(store.getState().tts.currentIndex).toBe(0);
  });

  test("advanceQueue moves to next message", () => {
    const store = createTestStore({ enabled: true });
    store.dispatch(enqueueMessage({ from: "pm-1", message: "First" }));
    store.dispatch(enqueueMessage({ from: "qa-1", message: "Second" }));
    store.dispatch(advanceQueue());
    expect(store.getState().tts.queue[0].status).toBe("done");
    expect(store.getState().tts.queue[1].status).toBe("speaking");
    expect(store.getState().tts.currentIndex).toBe(1);
  });

  test("advanceQueue goes idle when no more messages", () => {
    const store = createTestStore({ enabled: true });
    store.dispatch(enqueueMessage({ from: "pm-1", message: "Only one" }));
    store.dispatch(advanceQueue());
    expect(store.getState().tts.currentIndex).toBe(-1);
  });

  test("clearQueue empties queue and resets index", () => {
    const store = createTestStore({ enabled: true });
    store.dispatch(enqueueMessage({ from: "pm-1", message: "Hello" }));
    store.dispatch(clearQueue());
    expect(store.getState().tts.queue).toEqual([]);
    expect(store.getState().tts.currentIndex).toBe(-1);
  });
});

// ─── localStorage Persistence Tests ─────────────────────────────────────────

describe("CARD-048: TTS state persists to localStorage", () => {
  test("setEnabled triggers localStorage save (volume, rate, voice — no enabled)", () => {
    const store = createTestStore();
    store.dispatch(setEnabled(true));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "swarmcode_tts",
      expect.not.stringContaining('"enabled"')
    );
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved).toHaveProperty("volume");
    expect(saved).toHaveProperty("rate");
    expect(saved).toHaveProperty("voice");
    expect(saved).not.toHaveProperty("enabled");
  });

  test("setVolume saves to localStorage", () => {
    const store = createTestStore();
    store.dispatch(setVolume(0.7));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "swarmcode_tts",
      expect.stringContaining('"volume":0.7')
    );
  });

  test("setRate saves to localStorage", () => {
    const store = createTestStore();
    store.dispatch(setRate(1.25));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "swarmcode_tts",
      expect.stringContaining('"rate":1.25')
    );
  });

  test("setVoice saves to localStorage", () => {
    const store = createTestStore();
    store.dispatch(setVoice("Google US English"));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "swarmcode_tts",
      expect.stringContaining('"voice":"Google US English"')
    );
  });

  test("error state is NOT persisted to localStorage", () => {
    const store = createTestStore();
    localStorageMock.setItem.mockClear();
    store.dispatch(setError("Some error"));
    const ttsCalls = localStorageMock.setItem.mock.calls.filter(
      (c) => c[0] === "swarmcode_tts"
    );
    expect(ttsCalls).toHaveLength(0);
  });

  test("localStorage stores correct shape (volume, rate, voice — no enabled, queue)", () => {
    const store = createTestStore();
    store.dispatch(setVolume(0.8));
    const lastCall = localStorageMock.setItem.mock.calls.find(
      (c) => c[0] === "swarmcode_tts"
    );
    const saved = JSON.parse(lastCall[1]);
    expect(saved).toHaveProperty("volume");
    expect(saved).toHaveProperty("rate");
    expect(saved).toHaveProperty("voice");
    expect(saved).not.toHaveProperty("enabled");
    expect(saved).not.toHaveProperty("error");
    expect(saved).not.toHaveProperty("queue");
    expect(saved).not.toHaveProperty("currentIndex");
    expect(saved).not.toHaveProperty("perAgentVoice");
    expect(saved).not.toHaveProperty("speakAgentName");
  });
});

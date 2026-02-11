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
 */

import { configureStore } from "@reduxjs/toolkit";
import ttsReducer, {
  setEnabled,
  setVolume,
  setRate,
  setError,
  clearError,
} from "../src/store/ttsSlice";

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  error: null,
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

  test("setError and clearError manage error state", () => {
    const store = createTestStore();
    store.dispatch(setError("Speech error: audio-busy"));
    expect(store.getState().tts.error).toBe("Speech error: audio-busy");
    store.dispatch(clearError());
    expect(store.getState().tts.error).toBeNull();
  });
});

// ─── localStorage Persistence Tests ─────────────────────────────────────────

describe("CARD-048: TTS state persists to localStorage", () => {
  test("setEnabled saves to localStorage", () => {
    const store = createTestStore();
    store.dispatch(setEnabled(true));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "swarmcode_tts",
      expect.stringContaining('"enabled":true')
    );
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

  test("error state is NOT persisted to localStorage", () => {
    const store = createTestStore();
    localStorageMock.setItem.mockClear();
    store.dispatch(setError("Some error"));
    const ttsCalls = localStorageMock.setItem.mock.calls.filter(
      (c) => c[0] === "swarmcode_tts"
    );
    expect(ttsCalls).toHaveLength(0);
  });

  test("localStorage stores correct shape (enabled, volume, rate only)", () => {
    const store = createTestStore();
    store.dispatch(setEnabled(true));
    const lastCall = localStorageMock.setItem.mock.calls.find(
      (c) => c[0] === "swarmcode_tts"
    );
    const saved = JSON.parse(lastCall[1]);
    expect(saved).toHaveProperty("enabled");
    expect(saved).toHaveProperty("volume");
    expect(saved).toHaveProperty("rate");
    expect(saved).not.toHaveProperty("error");
    expect(saved).not.toHaveProperty("perAgentVoice");
    expect(saved).not.toHaveProperty("speakAgentName");
  });
});

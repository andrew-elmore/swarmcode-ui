/**
 * CARD-048 QA Tests — TTS Redux slice (state persistence, actions, error Snackbar).
 *
 * Verifies:
 * 1. TTS state persists to localStorage via saveToStorage on each action
 * 2. Actions (setEnabled, setVolume, setRate, setAgentVoice, setSpeakAgentName) update state correctly
 * 3. Volume is clamped to [0, 1], rate to [0.5, 2.0]
 * 4. Error Snackbar renders when tts.error is set, auto-dismisses via clearError
 * 5. TtsControls dispatches correct actions and syncs to engine
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import ttsReducer, {
  setEnabled,
  setVolume,
  setRate,
  setAgentVoice,
  setSpeakAgentName,
  setError,
  clearError,
} from "../src/store/ttsSlice";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import TtsControls from "../src/components/TtsControls";
import * as api from "../src/services/api";

jest.mock("../src/services/api", () => ({
  getOrCreateBoard: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  pollBoard: jest.fn(),
  sendMessage: jest.fn(),
  pollMessages: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
}));

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  perAgentVoice: {},
  speakAgentName: false,
  error: null,
};

function createTestStore(ttsOverrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...ttsOverrides },
    },
  });
}

function renderWithProviders(ui, store) {
  const testStore = store || createTestStore();
  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper }), store: testStore };
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
  api.getAgents.mockResolvedValue({ agents: [] });
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

  test("setAgentVoice stores per-agent voice preference", () => {
    const store = createTestStore();
    store.dispatch(setAgentVoice({ agent: "pm-1", voiceName: "Google UK English Male" }));
    expect(store.getState().tts.perAgentVoice["pm-1"]).toBe("Google UK English Male");
  });

  test("setSpeakAgentName toggles speakAgentName", () => {
    const store = createTestStore();
    store.dispatch(setSpeakAgentName(true));
    expect(store.getState().tts.speakAgentName).toBe(true);
    store.dispatch(setSpeakAgentName(false));
    expect(store.getState().tts.speakAgentName).toBe(false);
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

  test("setAgentVoice saves perAgentVoice to localStorage", () => {
    const store = createTestStore();
    store.dispatch(setAgentVoice({ agent: "developer-1", voiceName: "Alex" }));
    const lastCall = localStorageMock.setItem.mock.calls.find(
      (c) => c[0] === "swarmcode_tts"
    );
    expect(lastCall).toBeDefined();
    const saved = JSON.parse(lastCall[1]);
    expect(saved.perAgentVoice["developer-1"]).toBe("Alex");
  });

  test("setSpeakAgentName saves to localStorage", () => {
    const store = createTestStore();
    store.dispatch(setSpeakAgentName(true));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "swarmcode_tts",
      expect.stringContaining('"speakAgentName":true')
    );
  });

  test("error state is NOT persisted to localStorage", () => {
    const store = createTestStore();
    localStorageMock.setItem.mockClear();
    store.dispatch(setError("Some error"));
    // setError does not call saveToStorage, so no localStorage.setItem call
    const ttsCalls = localStorageMock.setItem.mock.calls.filter(
      (c) => c[0] === "swarmcode_tts"
    );
    expect(ttsCalls).toHaveLength(0);
  });

  test("localStorage stores correct shape (no error field)", () => {
    const store = createTestStore();
    store.dispatch(setEnabled(true));
    const lastCall = localStorageMock.setItem.mock.calls.find(
      (c) => c[0] === "swarmcode_tts"
    );
    const saved = JSON.parse(lastCall[1]);
    expect(saved).toHaveProperty("enabled");
    expect(saved).toHaveProperty("volume");
    expect(saved).toHaveProperty("rate");
    expect(saved).toHaveProperty("perAgentVoice");
    expect(saved).toHaveProperty("speakAgentName");
    expect(saved).not.toHaveProperty("error");
  });
});

// ─── TtsControls Component Tests ────────────────────────────────────────────

describe("CARD-048: TtsControls component", () => {
  function createMockEngineRef() {
    return {
      current: {
        getVoices: jest.fn().mockReturnValue([]),
        voice: null,
        stop: jest.fn(),
        setVoice: jest.fn(),
        setEnabled: jest.fn(),
        setRate: jest.fn(),
        setVolume: jest.fn(),
        setOnError: jest.fn(),
      },
    };
  }

  test("renders enable/disable toggle button", () => {
    const engineRef = createMockEngineRef();
    const store = createTestStore({ enabled: false });
    renderWithProviders(<TtsControls engineRef={engineRef} />, store);

    const toggleBtn = screen.getByRole("button");
    expect(toggleBtn).toBeInTheDocument();
  });

  test("clicking toggle dispatches setEnabled(true)", () => {
    const engineRef = createMockEngineRef();
    const store = createTestStore({ enabled: false });
    renderWithProviders(<TtsControls engineRef={engineRef} />, store);

    const toggleBtn = screen.getByRole("button");
    fireEvent.click(toggleBtn);
    expect(store.getState().tts.enabled).toBe(true);
  });

  test("when enabled, shows stop button, volume slider, and rate selector", () => {
    const engineRef = createMockEngineRef();
    const store = createTestStore({ enabled: true });
    renderWithProviders(<TtsControls engineRef={engineRef} />, store);

    // Stop button should be visible
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2); // toggle + stop

    // Volume slider
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  test("error Snackbar displays when tts.error is set", async () => {
    const engineRef = createMockEngineRef();
    const store = createTestStore({ enabled: true, error: "Speech error: audio-busy" });
    renderWithProviders(<TtsControls engineRef={engineRef} />, store);

    expect(screen.getByText("Speech error: audio-busy")).toBeInTheDocument();
  });

  test("error Snackbar not visible when error is null", () => {
    const engineRef = createMockEngineRef();
    const store = createTestStore({ enabled: true, error: null });
    renderWithProviders(<TtsControls engineRef={engineRef} />, store);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("returns null when engineRef is null", () => {
    const store = createTestStore();
    const { container } = renderWithProviders(<TtsControls engineRef={null} />, store);
    expect(container.firstChild).toBeNull();
  });
});

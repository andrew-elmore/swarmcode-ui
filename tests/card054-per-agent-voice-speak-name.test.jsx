/**
 * CARD-054 QA Tests — Per-agent voice wiring (server-side Piper TTS).
 *
 * Updated for CARD-073: Voice is now read from Agent.voice in DB (agents store),
 * NOT from ttsSlice.perAgentVoice. synthesizeSpeech is called with the agent's
 * DB voice. speakAgentName and perAgentVoice (localStorage) are deprecated.
 *
 * Verifies:
 * 1. Agent with voice set in DB: synthesizeSpeech called with that voice
 * 2. Agent without voice: falls back to default voice (en_US-amy-medium)
 * 3. Different agents get different voices from their DB config
 * 4. Owner messages are never synthesized
 * 5. Settings changes mid-session (TTS rate) take effect via refs
 *
 * Author: developer-1
 * Updated: 2026-02-11 (CARD-073: replaced TtsEngine with AudioStreamManager)
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer, { setRate } from "../src/store/ttsSlice";

// Mock StreamView.getStreamManager
const mockQueueSpeech = jest.fn();
const mockStreamManager = {
  active: true,
  start: jest.fn(),
  stop: jest.fn(),
  setVolume: jest.fn(),
  setSpeed: jest.fn(),
  setOnError: jest.fn(),
  getAnalyserNode: jest.fn(() => null),
  queueSpeech: mockQueueSpeech,
};

jest.mock("../src/components/StreamView", () => ({
  getStreamManager: () => mockStreamManager,
}));

// Mock API
const mockSynthesizeSpeech = jest.fn(() => Promise.resolve(new ArrayBuffer(100)));
let capturedOnMessage = null;

jest.mock("../src/services/api", () => ({
  subscribeToMessages: jest.fn((cb) => {
    capturedOnMessage = cb;
    return Promise.resolve(jest.fn());
  }),
  synthesizeSpeech: (...args) => mockSynthesizeSpeech(...args),
}));

import MessagesView from "../src/components/MessagesView";

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const DEFAULT_AGENTS = [
  { name: "pm-1", description: "PM Agent", voice: "en_US-amy-medium", isActive: true, sortOrder: 0 },
  { name: "developer-1", description: "Developer", voice: "en_US-joe-medium", isActive: true, sortOrder: 1 },
  { name: "qa-1", description: "QA Engineer", voice: "en_GB-alba-medium", isActive: true, sortOrder: 2 },
  { name: "senior-dev-1", description: "Senior Developer", voice: null, isActive: true, sortOrder: 3 },
];

const DEFAULT_TTS_STATE = {
  enabled: true,
  volume: 1.0,
  rate: 1.0,
  perAgentVoice: {},
  speakAgentName: false,
  error: null,
};

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...(overrides.tts || {}) },
      agents: overrides.agents || { agents: DEFAULT_AGENTS, loading: false, error: null },
      board: { board: null, cards: [], loading: false, error: null, sprints: [], sprintFilter: "" },
      messages: {
        conversations: {},
        unreadCounts: {},
        selectedAgent: null,
        mobileDrawerOpen: false,
        loading: false,
        hasMore: {},
      },
      projects: { projects: [], activeProject: null, loading: false, error: null },
    },
  });
}

function renderWithProviders(ui, store) {
  function Wrapper({ children }) {
    return (
      <Provider store={store}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper }), store };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnMessage = null;
  mockStreamManager.active = true;
  mockSynthesizeSpeech.mockResolvedValue(new ArrayBuffer(100));
});

function makeMsg(from, message, id) {
  return {
    id: id || `msg-${Date.now()}-${Math.random()}`,
    from,
    to: "owner",
    message,
    createdAt: "2026-02-10T14:00:00Z",
    broadcast: false,
  };
}

// ─── Per-Agent Voice (from DB) ───────────────────────────────────────────────

describe("CARD-054: Per-agent voice wiring (DB-based)", () => {
  test("agent with voice in DB: synthesizeSpeech is called with that voice", async () => {
    const store = createTestStore();
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "Task assigned"));
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "en_US-amy-medium" })
      );
    });
  });

  test("agent without voice in DB: falls back to default voice", async () => {
    const store = createTestStore();
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("senior-dev-1", "Code review done"));
    });

    await waitFor(() => {
      // senior-dev-1 has voice: null, should fall back to en_US-amy-medium
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "en_US-amy-medium" })
      );
    });
  });

  test("different agents use different voices from DB", async () => {
    const store = createTestStore();
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "First message", "m1"));
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "en_US-amy-medium" })
      );
    });

    mockSynthesizeSpeech.mockClear();

    await act(async () => {
      capturedOnMessage(makeMsg("developer-1", "Second message", "m2"));
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "en_US-joe-medium" })
      );
    });
  });

  test("qa-1 uses en_GB-alba-medium voice from DB", async () => {
    const store = createTestStore();
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("qa-1", "All tests passed"));
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "en_GB-alba-medium" })
      );
    });
  });
});

// ─── Owner messages ──────────────────────────────────────────────────────────

describe("CARD-054: Owner messages not synthesized", () => {
  test("owner messages are not sent to TTS", async () => {
    const store = createTestStore();
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-owner",
        from: "owner",
        to: "pm-1",
        message: "Should not speak",
        createdAt: "2026-02-10T14:00:00Z",
        broadcast: false,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  });
});

// ─── Mid-Session Settings Changes via Refs ──────────────────────────────────

describe("CARD-054: Settings changes mid-session via refs", () => {
  test("changing TTS rate mid-session takes effect on next message", async () => {
    const store = createTestStore({ tts: { ...DEFAULT_TTS_STATE, rate: 1.0 } });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    // First message at 1.0 speed
    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "Before rate change", "m1"));
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ speed: 1.0 })
      );
    });

    mockSynthesizeSpeech.mockClear();

    // Change rate mid-session
    await act(async () => {
      store.dispatch(setRate(1.5));
    });

    // Second message should use new rate
    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "After rate change", "m2"));
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ speed: 1.5 })
      );
    });
  });
});

// ─── Audio queuing ──────────────────────────────────────────────────────────

describe("CARD-054: Audio queued to AudioStreamManager", () => {
  test("synthesized audio is queued via queueSpeech", async () => {
    const fakeAudio = new ArrayBuffer(512);
    mockSynthesizeSpeech.mockResolvedValue(fakeAudio);

    const store = createTestStore();
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "Queue this audio"));
    });

    await waitFor(() => {
      expect(mockQueueSpeech).toHaveBeenCalledWith(fakeAudio);
    });
  });
});

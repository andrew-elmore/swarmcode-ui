/**
 * CARD-073: Wire LiveQuery to AudioStreamManager for TTS
 * Tests that incoming LiveQuery messages trigger server-side TTS synthesis
 * and feed audio into AudioStreamManager.
 * Author: developer-1
 * Date: 2026-02-11
 */

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import messagesReducer from "../src/store/messagesSlice";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import ttsReducer from "../src/store/ttsSlice";

// --- Mock AudioStreamManager (via StreamView.getStreamManager) ---

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

// --- Mock API ---

const mockSynthesizeSpeech = jest.fn();
let capturedOnMessage = null;

jest.mock("../src/services/api", () => ({
  subscribeToMessages: jest.fn((onMessage) => {
    capturedOnMessage = onMessage;
    return Promise.resolve(() => {});
  }),
  synthesizeSpeech: (...args) => mockSynthesizeSpeech(...args),
}));

// Import after mocks are set up
import MessagesView from "../src/components/MessagesView";

const theme = createTheme();

const DEFAULT_TTS = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  perAgentVoice: {},
  speakAgentName: false,
  error: null,
};

const DEFAULT_AGENTS = [
  { objectId: "a1", name: "pm-1", description: "Project Manager", voice: "en_US-amy-medium", isActive: true, sortOrder: 0 },
  { objectId: "a2", name: "developer-1", description: "Developer", voice: "en_US-joe-medium", isActive: true, sortOrder: 2 },
  { objectId: "a3", name: "qa-1", description: "QA Engineer", voice: "en_GB-alba-medium", isActive: true, sortOrder: 3 },
  { objectId: "a4", name: "senior-dev-1", description: "Senior Developer", voice: null, isActive: true, sortOrder: 1 },
];

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      messages: messagesReducer,
      agents: agentsReducer,
      board: boardReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      messages: {
        selectedAgent: null,
        conversations: {},
        unreadCounts: {},
        mobileDrawerOpen: false,
        loading: false,
        hasMore: {},
      },
      agents: {
        agents: overrides.agents ?? DEFAULT_AGENTS,
        loading: false,
        error: null,
      },
      board: {
        board: null,
        cards: [],
        loading: false,
        error: null,
        sprints: [],
        sprintFilter: "",
      },
      tts: { ...DEFAULT_TTS, ...overrides.tts },
    },
  });
}

function renderMessagesView(overrides = {}) {
  const store = createTestStore(overrides);
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MessagesView />
      </ThemeProvider>
    </Provider>
  );
  return { ...result, store };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnMessage = null;
  mockStreamManager.active = true;
  mockSynthesizeSpeech.mockResolvedValue(new ArrayBuffer(100));
});

// ─── LiveQuery subscription ──────────────────────────────────────────────────

describe("CARD-073: LiveQuery subscription", () => {
  test("subscribes to LiveQuery on mount", async () => {
    const { subscribeToMessages } = require("../src/services/api");
    renderMessagesView();
    expect(subscribeToMessages).toHaveBeenCalledTimes(1);
    expect(typeof capturedOnMessage).toBe("function");
  });
});

// ─── TTS synthesis wiring ────────────────────────────────────────────────────

describe("CARD-073: TTS synthesis on incoming messages", () => {
  test("calls synthesizeSpeech when TTS enabled and agent message arrives", async () => {
    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true, rate: 1.0 } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg1",
      from: "pm-1",
      to: "owner",
      message: "Hello from PM",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith({
        text: "Hello from PM",
        voice: "en_US-amy-medium",
        speed: 1.0,
      });
    });
  });

  test("uses agent voice from DB when available", async () => {
    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg2",
      from: "qa-1",
      to: "owner",
      message: "Tests passed",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "en_GB-alba-medium" })
      );
    });
  });

  test("falls back to default voice when agent has no voice set", async () => {
    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg3",
      from: "senior-dev-1",
      to: "owner",
      message: "Code review done",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "en_US-amy-medium" })
      );
    });
  });

  test("passes current TTS rate as speed to synthesizeSpeech", async () => {
    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true, rate: 1.5 } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg4",
      from: "pm-1",
      to: "owner",
      message: "Sprint update",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ speed: 1.5 })
      );
    });
  });

  test("feeds synthesized audio into AudioStreamManager.queueSpeech", async () => {
    const fakeAudio = new ArrayBuffer(256);
    mockSynthesizeSpeech.mockResolvedValue(fakeAudio);

    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg5",
      from: "pm-1",
      to: "owner",
      message: "Queue this",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockQueueSpeech).toHaveBeenCalledWith(fakeAudio);
    });
  });
});

// ─── Skip conditions ────────────────────────────────────────────────────────

describe("CARD-073: TTS skip conditions", () => {
  test("does NOT call synthesizeSpeech when TTS is disabled", async () => {
    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: false } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg6",
      from: "pm-1",
      to: "owner",
      message: "Should not speak",
      createdAt: new Date().toISOString(),
    });

    // Give it a tick to ensure nothing fires
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  });

  test("does NOT call synthesizeSpeech for owner messages", async () => {
    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg7",
      from: "owner",
      to: "pm-1",
      message: "My own message",
      createdAt: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  });

  test("does NOT call synthesizeSpeech when stream manager is not active", async () => {
    mockStreamManager.active = false;

    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg8",
      from: "pm-1",
      to: "owner",
      message: "Stream not active",
      createdAt: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  });
});

// ─── Error handling ──────────────────────────────────────────────────────────

describe("CARD-073: TTS error handling", () => {
  test("dispatches setError when synthesizeSpeech fails", async () => {
    mockSynthesizeSpeech.mockRejectedValue(new Error("Network error"));

    const { store } = renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg9",
      from: "pm-1",
      to: "owner",
      message: "Will fail",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(store.getState().tts.error).toBe("TTS synthesis failed");
    });
  });

  test("does NOT call queueSpeech when synthesizeSpeech fails", async () => {
    mockSynthesizeSpeech.mockRejectedValue(new Error("API error"));

    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg10",
      from: "pm-1",
      to: "owner",
      message: "Will fail too",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalled();
    });

    // Ensure queueSpeech was never called
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueueSpeech).not.toHaveBeenCalled();
  });
});

// ─── Message dispatch ────────────────────────────────────────────────────────

describe("CARD-073: Message dispatch still works", () => {
  test("always dispatches appendMessage regardless of TTS state", async () => {
    const { store } = renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: false } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg11",
      from: "pm-1",
      to: "owner",
      subject: "Test",
      message: "Check dispatch",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      const state = store.getState().messages;
      const convo = state.conversations["pm-1"];
      expect(convo).toBeDefined();
      expect(convo.messages.some((m) => m.id === "msg11")).toBe(true);
    });
  });
});

// ─── Unknown agent (not in DB) ───────────────────────────────────────────────

describe("CARD-073: Unknown agent handling", () => {
  test("uses default voice for unknown agent names", async () => {
    renderMessagesView({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    capturedOnMessage({
      id: "msg12",
      from: "unknown-agent",
      to: "owner",
      message: "I am new",
      createdAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "en_US-amy-medium" })
      );
    });
  });
});

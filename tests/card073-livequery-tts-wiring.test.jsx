/**
 * CARD-073: Wire LiveQuery to browser speechSynthesis TTS queue
 * Updated for CARD-090: Tests that incoming LiveQuery messages enqueue to Redux
 * queue instead of calling server-side synthesizeSpeech.
 * Updated for CARD-092: LiveQuery subscription moved from MessagesView to App.jsx.
 * Author: developer-1
 * Updated: 2026-02-11 (CARD-092: renders App to capture LiveQuery callback)
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import messagesReducer from "../src/store/messagesSlice";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";

// Mock speechSynthesis API for jsdom
window.speechSynthesis = {
  cancel: jest.fn(),
  speak: jest.fn(),
  getVoices: jest.fn(() => []),
  speaking: false,
  paused: false,
  pause: jest.fn(),
  resume: jest.fn(),
};
global.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  constructor(text) { this.text = text; this.rate = 1; this.volume = 1; this.voice = null; this.onend = null; this.onerror = null; }
};

// --- Mock API ---

let capturedOnMessage = null;

jest.mock("../src/services/api", () => ({
  getOrCreateBoard: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn((onMessage) => {
    capturedOnMessage = onMessage;
    return Promise.resolve(() => {});
  }),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  createSprint: jest.fn(),
  getSprints: jest.fn(),
  updateSprint: jest.fn(),
  deleteSprint: jest.fn(),
}));

import * as api from "../src/services/api";
import App from "../src/App";

const theme = createTheme();

const DEFAULT_TTS = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
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
      projects: projectsReducer,
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
      projects: { projects: [], activeProject: null, loading: false, error: null },
      tts: { ...DEFAULT_TTS, ...overrides.tts },
    },
  });
}

function renderApp(overrides = {}) {
  const store = createTestStore(overrides);
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </Provider>
  );
  return { ...result, store };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnMessage = null;
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [], sprints: [] });
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: [] });
});

// ─── LiveQuery subscription ──────────────────────────────────────────────────

describe("CARD-073: LiveQuery subscription", () => {
  test("subscribes to LiveQuery on mount (via App.jsx)", async () => {
    const { subscribeToMessages } = require("../src/services/api");
    renderApp();
    await waitFor(() => {
      expect(subscribeToMessages).toHaveBeenCalledTimes(1);
    });
    expect(typeof capturedOnMessage).toBe("function");
  });
});

// ─── TTS queue wiring ────────────────────────────────────────────────────────

describe("CARD-073: TTS enqueue on incoming messages (CARD-090)", () => {
  test("enqueues message when TTS enabled and agent message arrives", async () => {
    const { store } = renderApp({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg1",
        from: "pm-1",
        to: "owner",
        message: "Hello from PM",
        createdAt: new Date().toISOString(),
      });
    });

    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].from).toBe("pm-1");
    expect(queue[0].message).toBe("Hello from PM");
  });

  test("enqueues message with correct from field for agent voice lookup", async () => {
    const { store } = renderApp({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg2",
        from: "qa-1",
        to: "owner",
        message: "Tests passed",
        createdAt: new Date().toISOString(),
      });
    });

    const { queue } = store.getState().tts;
    expect(queue[0].from).toBe("qa-1");
  });

  test("auto-starts speaking first enqueued message when idle", async () => {
    const { store } = renderApp({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg3",
        from: "pm-1",
        to: "owner",
        message: "Auto-start test",
        createdAt: new Date().toISOString(),
      });
    });

    const { queue, currentIndex } = store.getState().tts;
    expect(currentIndex).toBe(0);
    expect(queue[0].status).toBe("speaking");
  });

  test("subsequent messages queue as pending", async () => {
    const { store } = renderApp({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg4",
        from: "pm-1",
        to: "owner",
        message: "First",
        createdAt: new Date().toISOString(),
      });
    });

    await act(async () => {
      capturedOnMessage({
        id: "msg5",
        from: "developer-1",
        to: "owner",
        message: "Second",
        createdAt: new Date().toISOString(),
      });
    });

    const { queue, currentIndex } = store.getState().tts;
    expect(queue.length).toBe(2);
    expect(currentIndex).toBe(0);
    expect(queue[0].status).toBe("speaking");
    expect(queue[1].status).toBe("pending");
  });
});

// ─── Skip conditions ────────────────────────────────────────────────────────

describe("CARD-073: TTS skip conditions", () => {
  test("does NOT enqueue when TTS is disabled", async () => {
    const { store } = renderApp({ tts: { ...DEFAULT_TTS, enabled: false } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg6",
        from: "pm-1",
        to: "owner",
        message: "Should not speak",
        createdAt: new Date().toISOString(),
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(store.getState().tts.queue.length).toBe(0);
  });

  test("does NOT enqueue for owner messages", async () => {
    const { store } = renderApp({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg7",
        from: "owner",
        to: "pm-1",
        message: "My own message",
        createdAt: new Date().toISOString(),
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(store.getState().tts.queue.length).toBe(0);
  });
});

// ─── Message dispatch ────────────────────────────────────────────────────────

describe("CARD-073: Message dispatch still works", () => {
  test("always dispatches appendMessage regardless of TTS state", async () => {
    const { store } = renderApp({ tts: { ...DEFAULT_TTS, enabled: false } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg11",
        from: "pm-1",
        to: "owner",
        subject: "Test",
        message: "Check dispatch",
        createdAt: new Date().toISOString(),
      });
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
  test("enqueues message for unknown agent with correct from field", async () => {
    const { store } = renderApp({ tts: { ...DEFAULT_TTS, enabled: true } });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg12",
        from: "unknown-agent",
        to: "owner",
        message: "I am new",
        createdAt: new Date().toISOString(),
      });
    });

    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].from).toBe("unknown-agent");
    expect(queue[0].message).toBe("I am new");
  });
});

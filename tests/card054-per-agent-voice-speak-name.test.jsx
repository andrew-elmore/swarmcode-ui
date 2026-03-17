/**
 * CARD-054 QA Tests — Per-agent voice wiring (browser speechSynthesis).
 *
 * Updated for CARD-090: Voice is stored in agent.voice in DB (agents store).
 * Messages are enqueued to Redux queue with from field for voice lookup.
 * StreamView's speechSynthesis engine resolves voice at speak time.
 *
 * Updated for CARD-092: LiveQuery subscription moved from MessagesView to App.jsx.
 *
 * Verifies:
 * 1. Agent messages are enqueued with correct from field
 * 2. Owner messages are never enqueued
 * 3. Settings changes mid-session (TTS rate) take effect via refs
 * 4. Multiple agents enqueue correctly
 *
 * Author: developer-1
 * Updated: 2026-02-11 (CARD-092: renders App to capture LiveQuery callback)
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import agentsReducer from "../src/store/agentsSlice";
import articlesReducer from "../src/store/articlesSlice";
import projectReducer from "../src/store/projectSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer, { setRate } from "../src/store/ttsSlice";
import authReducer from "../src/store/authSlice";
import commandsReducer from "../src/store/commandsSlice";

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

// Mock API
let capturedOnMessage = null;

jest.mock("../src/services/api", () => ({
  getOrCreateProject: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn((projectId, cb) => {
    capturedOnMessage = cb;
    return jest.fn(); // sync unsubscribe (CARD-099)
  }),
  subscribeToCommands: jest.fn(() => jest.fn()), // sync (CARD-099)
  subscribeToPings: jest.fn(() => jest.fn()), // sync (CARD-099)
  getRecentMessages: jest.fn(),
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
  subscribeToCards: jest.fn(() => () => {}),
}));

import { MemoryRouter } from "react-router-dom";
import * as api from "../src/services/api";
import App from "../src/App";

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
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
  streamLoading: false,
};

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      project: projectReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
      auth: authReducer,
      commands: commandsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...(overrides.tts || {}) },
      agents: overrides.agents || { agents: DEFAULT_AGENTS, allAgents: [], loading: false, error: null },
      project: { project: { objectId: "test-board-id" }, cards: [], loading: false, error: null, sprints: [], sprintFilter: "" },
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

function renderWithProviders(store) {
  return {
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={['/test-board-id']}>
            <App />
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    ),
    store,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnMessage = null;
  api.getOrCreateProject.mockResolvedValue({ project: null, cards: [], sprints: [] });
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: [] });
  api.getRecentMessages.mockResolvedValue({ messages: [] });
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

describe("CARD-054: Per-agent voice wiring (DB-based, CARD-090)", () => {
  test("agent message is enqueued with correct from field for voice lookup", async () => {
    const store = createTestStore();
    renderWithProviders(store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "Task assigned"));
    });

    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].from).toBe("pm-1");
    expect(queue[0].message).toBe("Task assigned");
  });

  test("agent without voice in DB: still enqueued with from field", async () => {
    const store = createTestStore();
    renderWithProviders(store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("senior-dev-1", "Code review done"));
    });

    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].from).toBe("senior-dev-1");
  });

  test("different agents enqueue with their respective from fields", async () => {
    const store = createTestStore();
    renderWithProviders(store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "First message", "m1"));
    });

    await act(async () => {
      capturedOnMessage(makeMsg("developer-1", "Second message", "m2"));
    });

    const { queue } = store.getState().tts;
    expect(queue.length).toBe(2);
    expect(queue[0].from).toBe("pm-1");
    expect(queue[1].from).toBe("developer-1");
  });

  test("qa-1 message enqueued with correct from", async () => {
    const store = createTestStore();
    renderWithProviders(store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("qa-1", "All tests passed"));
    });

    const { queue } = store.getState().tts;
    expect(queue[0].from).toBe("qa-1");
  });
});

// ─── Owner messages ──────────────────────────────────────────────────────────

describe("CARD-054: Owner messages not enqueued", () => {
  test("owner messages are not sent to TTS queue", async () => {
    const store = createTestStore();
    renderWithProviders(store);

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
    expect(store.getState().tts.queue.length).toBe(0);
  });
});

// ─── Mid-Session Settings Changes via Refs ──────────────────────────────────

describe("CARD-054: Settings changes mid-session via refs", () => {
  test("messages still enqueue after TTS rate change mid-session", async () => {
    const store = createTestStore({ tts: { ...DEFAULT_TTS_STATE, rate: 1.0 } });
    renderWithProviders(store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "Before rate change", "m1"));
    });

    expect(store.getState().tts.queue.length).toBe(1);

    // Change rate mid-session
    await act(async () => {
      store.dispatch(setRate(1.5));
    });

    // Second message should still enqueue
    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "After rate change", "m2"));
    });

    expect(store.getState().tts.queue.length).toBe(2);
  });
});

// ─── Queue management ──────────────────────────────────────────────────────

describe("CARD-054: Queue management", () => {
  test("first enqueued message auto-starts as speaking", async () => {
    const store = createTestStore();
    renderWithProviders(store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage(makeMsg("pm-1", "Queue this audio"));
    });

    const { queue, currentIndex } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(currentIndex).toBe(0);
    expect(queue[0].status).toBe("speaking");
  });
});

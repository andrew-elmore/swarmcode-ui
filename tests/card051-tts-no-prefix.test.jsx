/**
 * CARD-051 QA Tests — TTS speaks message content only, no agent name prefix.
 *
 * Updated for CARD-090: Now tests that enqueueMessage is dispatched with
 * raw msg.message (no prefix), using browser speechSynthesis via Redux queue.
 * Updated for CARD-092: LiveQuery subscription moved from MessagesView to App.jsx.
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
import ttsReducer from "../src/store/ttsSlice";
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

// Mock API — full mock required since App.jsx renders all views
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

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
  streamLoading: false,
};

function createTestStore(ttsOverrides = {}) {
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
      tts: { ...DEFAULT_TTS_STATE, ...ttsOverrides },
      agents: {
        agents: [
          { name: "pm-1", description: "PM Agent", voice: "en_US-amy-medium", isActive: true, sortOrder: 0 },
          { name: "developer-1", description: "Developer", voice: "en_US-joe-medium", isActive: true, sortOrder: 1 },
        ],
        allAgents: [],
        loading: false,
        error: null,
      },
      project: { project: { objectId: "test-board-id" }, cards: [], loading: false, error: null, sprints: [], sprintFilter: "" },
      projects: { projects: [], activeProject: null, loading: false, error: null },
    },
  });
}

function renderApp(ttsOverrides = {}) {
  const store = createTestStore(ttsOverrides);
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/test-board-id']}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { ...result, store };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnMessage = null;
  api.getOrCreateProject.mockResolvedValue({ project: null, cards: [], sprints: [] });
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: [] });
  api.getRecentMessages.mockResolvedValue({ messages: [] });
});

describe("CARD-051: TTS speaks message only, no agent name prefix", () => {
  test("enqueueMessage receives only message content when TTS is enabled", async () => {
    const { store } = renderApp({ enabled: true });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-1",
        from: "developer-1",
        to: "owner",
        message: "Bug fix complete",
        createdAt: "2026-02-10T12:01:00Z",
        broadcast: false,
      });
    });

    // CARD-090: Message should be enqueued with raw message content (no prefix)
    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].message).toBe("Bug fix complete");
    expect(queue[0].from).toBe("developer-1");
  });

  test("agent name prefix is NOT prepended to enqueued message", async () => {
    const { store } = renderApp({ enabled: true });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-2",
        from: "pm-1",
        to: "owner",
        message: "Task assigned to developer-1",
        createdAt: "2026-02-10T12:02:00Z",
        broadcast: false,
      });
    });

    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].message).toBe("Task assigned to developer-1");
    expect(queue[0].message).not.toMatch(/^pm-1 says:/);
    expect(queue[0].message).not.toMatch(/^PM Agent says:/);
  });

  test("owner messages are NOT enqueued (only incoming agent messages)", async () => {
    const { store } = renderApp({ enabled: true });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-3",
        from: "owner",
        to: "pm-1",
        message: "This is from the owner",
        createdAt: "2026-02-10T12:03:00Z",
        broadcast: false,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(store.getState().tts.queue.length).toBe(0);
  });

  test("TTS does not enqueue when TTS is disabled", async () => {
    const { store } = renderApp({ enabled: false });

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-4",
        from: "pm-1",
        to: "owner",
        message: "Should not be spoken",
        createdAt: "2026-02-10T12:04:00Z",
        broadcast: false,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(store.getState().tts.queue.length).toBe(0);
  });
});

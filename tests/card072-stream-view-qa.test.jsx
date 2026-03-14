/**
 * CARD-072 QA Supplementary Tests — StreamView edge cases.
 * Updated for CARD-090: browser speechSynthesis replaces AudioStreamManager.
 * Author: qa-1
 * Updated: 2026-02-11 (CARD-090)
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import ttsReducer from "../src/store/ttsSlice";
import agentsReducer from "../src/store/agentsSlice";
import articlesReducer from "../src/store/articlesSlice";
import projectReducer from "../src/store/projectSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import authReducer from "../src/store/authSlice";
import commandsReducer from "../src/store/commandsSlice";
import * as api from "../src/services/api";

// Mock speechSynthesis API for jsdom
const mockCancel = jest.fn();
const mockSpeak = jest.fn();
const mockGetVoices = jest.fn(() => []);
window.speechSynthesis = {
  cancel: mockCancel,
  speak: mockSpeak,
  getVoices: mockGetVoices,
  speaking: false,
  paused: false,
  pause: jest.fn(),
  resume: jest.fn(),
};
global.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.volume = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
};

jest.mock("../src/services/api", () => ({
  getOrCreateProject: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn(),
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

import StreamView from "../src/components/StreamView";
import App from "../src/App";

const theme = createTheme();

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
};

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      tts: ttsReducer,
      agents: agentsReducer,
      articles: articlesReducer,
      project: projectReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      auth: authReducer,
      commands: commandsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...(overrides.tts || {}) },
      agents: overrides.agents || { agents: [], allAgents: [], loading: false, error: null },
      project: overrides.project || {
        project: null,
        cards: [],
        sprints: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
      messages: overrides.messages || {
        conversations: {
          all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
        },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
        mobileDrawerOpen: false,
      },
      projects: overrides.projects || {
        projects: [],
        activeProject: null,
        loading: false,
        error: null,
      },
    },
  });
}

function renderStreamView(ttsOverrides = {}) {
  const store = createTestStore({ tts: ttsOverrides });
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <StreamView />
      </ThemeProvider>
    </Provider>
  );
  return { ...result, store };
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
  api.getOrCreateProject.mockResolvedValue({ project: null, cards: [], sprints: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: [] });
});

// ─── Toggle state transitions ───────────────────────────────────────────────

describe("CARD-072 QA: toggle state transitions", () => {
  test("play -> stop -> play cycles correctly", () => {
    const { store } = renderStreamView({ enabled: false });

    // Start
    fireEvent.click(screen.getByLabelText("Start stream"));
    expect(store.getState().tts.enabled).toBe(true);

    // Stop
    fireEvent.click(screen.getByLabelText("Stop stream"));
    expect(mockCancel).toHaveBeenCalled();
    expect(store.getState().tts.enabled).toBe(false);

    // Start again
    fireEvent.click(screen.getByLabelText("Start stream"));
    expect(store.getState().tts.enabled).toBe(true);
  });

  test("status text toggles with button", () => {
    renderStreamView({ enabled: false });

    expect(screen.getByText("Press play to start")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Start stream"));

    expect(screen.getByText("Listening for messages")).toBeInTheDocument();
    expect(screen.queryByText("Press play to start")).not.toBeInTheDocument();
  });
});

// ─── Volume display edge cases ──────────────────────────────────────────────

describe("CARD-072 QA: volume display", () => {
  test("volume 0 shows 0%", () => {
    renderStreamView({ volume: 0 });
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  test("volume 1 shows 100%", () => {
    renderStreamView({ volume: 1.0 });
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  test("volume 0.5 shows 50%", () => {
    renderStreamView({ volume: 0.5 });
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});

// ─── Speed selector options ─────────────────────────────────────────────────

describe("CARD-072 QA: speed selector values", () => {
  test("default speed value is 1x", () => {
    renderStreamView({ rate: 1.0 });
    const combobox = screen.getByRole("combobox");
    expect(combobox).toHaveTextContent("1x");
  });
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe("CARD-072 QA: error snackbar interactions", () => {
  test("closing error snackbar clears tts.error", () => {
    const { store } = renderStreamView({ error: "Test error message" });

    expect(screen.getByText("Test error message")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(store.getState().tts.error).toBeNull();
  });
});

// ─── Minimal UI verification ────────────────────────────────────────────────

describe("CARD-072 QA: minimal UI — no extra elements", () => {
  test("only expected elements: heading, toggle, status, queue, volume, speed, snackbar", () => {
    renderStreamView();

    expect(screen.getByText("Audio Stream")).toBeInTheDocument();
    expect(screen.getByLabelText("Start stream")).toBeInTheDocument();
    expect(screen.getByText("Press play to start")).toBeInTheDocument();
    // CARD-090: Queue area instead of canvas
    expect(screen.getByText("Queue empty")).toBeInTheDocument();
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
    expect(screen.getByText("Speed")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    // No per-agent voice table
    expect(screen.queryByText("Per-Agent Voice")).not.toBeInTheDocument();
    expect(screen.queryByText("TTS Enabled")).not.toBeInTheDocument();
    expect(screen.queryByText("TTS Disabled")).not.toBeInTheDocument();
    expect(screen.queryByText("Announce agent name")).not.toBeInTheDocument();
  });
});

// ─── App.jsx integration ────────────────────────────────────────────────────

describe("CARD-072 QA: App.jsx integration", () => {
  test("Stream tab uses HeadphonesIcon (not RecordVoiceOver)", () => {
    renderApp();

    const tabs = screen.getAllByRole("tab");
    expect(tabs[3]).toHaveTextContent("Stream");
    expect(screen.queryByText("TTS")).not.toBeInTheDocument();
  });

  test("navigating to Stream tab renders StreamView with Audio Stream heading", async () => {
    renderApp();

    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[3]);

    await waitFor(() => {
      expect(screen.getByText("Audio Stream")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Start stream")).toBeInTheDocument();
  });
});

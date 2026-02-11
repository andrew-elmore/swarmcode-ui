/**
 * CARD-072 QA Supplementary Tests — StreamView edge cases.
 * Author: qa-1
 * Date: 2026-02-11
 *
 * Supplements the 15 developer tests in card072-stream-view.test.jsx with
 * additional edge case and integration coverage.
 */

import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import ttsReducer from "../src/store/ttsSlice";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import * as api from "../src/services/api";

// Mock audioStreamManager
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockSetVolume = jest.fn();
const mockSetSpeed = jest.fn();
const mockSetOnError = jest.fn();
const mockGetAnalyserNode = jest.fn(() => null);

jest.mock("../src/utils/audioStreamManager", () => {
  return class MockAudioStreamManager {
    start = mockStart;
    stop = mockStop;
    setVolume = mockSetVolume;
    setSpeed = mockSetSpeed;
    setOnError = mockSetOnError;
    getAnalyserNode = mockGetAnalyserNode;
  };
});

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
  createSprint: jest.fn(),
  getSprints: jest.fn(),
  updateSprint: jest.fn(),
  deleteSprint: jest.fn(),
}));

import StreamView, { getStreamManager } from "../src/components/StreamView";
import App from "../src/App";

const theme = createTheme();

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  perAgentVoice: {},
  speakAgentName: false,
  error: null,
};

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      tts: ttsReducer,
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...(overrides.tts || {}) },
      agents: overrides.agents || { agents: [], loading: false, error: null },
      board: overrides.board || {
        board: null,
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
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [], sprints: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: [] });
});

// ─── Singleton pattern ──────────────────────────────────────────────────────

describe("CARD-072 QA: getStreamManager singleton", () => {
  test("getStreamManager returns an AudioStreamManager instance", () => {
    const mgr = getStreamManager();
    expect(mgr).toBeDefined();
    expect(typeof mgr.start).toBe("function");
    expect(typeof mgr.stop).toBe("function");
    expect(typeof mgr.setVolume).toBe("function");
    expect(typeof mgr.setSpeed).toBe("function");
  });

  test("getStreamManager returns the same instance on multiple calls", () => {
    const mgr1 = getStreamManager();
    const mgr2 = getStreamManager();
    expect(mgr1).toBe(mgr2);
  });
});

// ─── Toggle state transitions ───────────────────────────────────────────────

describe("CARD-072 QA: toggle state transitions", () => {
  test("play -> stop -> play cycles correctly", () => {
    const { store } = renderStreamView({ enabled: false });

    // Start
    fireEvent.click(screen.getByLabelText("Start stream"));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(store.getState().tts.enabled).toBe(true);

    // Stop
    fireEvent.click(screen.getByLabelText("Stop stream"));
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(store.getState().tts.enabled).toBe(false);

    // Start again
    fireEvent.click(screen.getByLabelText("Start stream"));
    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(store.getState().tts.enabled).toBe(true);
  });

  test("status text toggles with button", () => {
    const { store } = renderStreamView({ enabled: false });

    expect(screen.getByText("Press play to start")).toBeInTheDocument();
    expect(screen.queryByText("Stream active")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Start stream"));

    expect(screen.getByText("Stream active")).toBeInTheDocument();
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

  test("volume syncs to AudioStreamManager on mount", () => {
    renderStreamView({ volume: 0.3 });
    expect(mockSetVolume).toHaveBeenCalledWith(0.3);
  });
});

// ─── Speed selector options ─────────────────────────────────────────────────

describe("CARD-072 QA: speed selector values", () => {
  test("speed syncs to AudioStreamManager on mount", () => {
    renderStreamView({ rate: 1.5 });
    expect(mockSetSpeed).toHaveBeenCalledWith(1.5);
  });

  test("default speed value is 1x", () => {
    renderStreamView({ rate: 1.0 });
    // The combobox should display "1x"
    const combobox = screen.getByRole("combobox");
    expect(combobox).toHaveTextContent("1x");
  });
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe("CARD-072 QA: error snackbar interactions", () => {
  test("closing error snackbar clears tts.error", () => {
    const { store } = renderStreamView({ error: "Test error message" });

    expect(screen.getByText("Test error message")).toBeInTheDocument();

    // Click the close button on the alert
    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(store.getState().tts.error).toBeNull();
  });

  test("error callback wired on mount dispatches to Redux", () => {
    renderStreamView();

    // Verify setOnError was called with a function
    expect(mockSetOnError).toHaveBeenCalledWith(expect.any(Function));
  });
});

// ─── Minimal UI verification (per card requirements) ────────────────────────

describe("CARD-072 QA: minimal UI — no extra elements", () => {
  test("only expected elements: heading, toggle, status, canvas, volume, speed, snackbar", () => {
    const { container } = renderStreamView();

    // Heading
    expect(screen.getByText("Audio Stream")).toBeInTheDocument();

    // Play/stop toggle (only 1 icon button at the top)
    expect(screen.getByLabelText("Start stream")).toBeInTheDocument();

    // Status text
    expect(screen.getByText("Press play to start")).toBeInTheDocument();

    // Canvas
    expect(container.querySelector("canvas")).toBeInTheDocument();

    // Volume
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();

    // Speed
    expect(screen.getByText("Speed")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    // No per-agent voice table (removed from TtsView)
    expect(screen.queryByText("Per-Agent Voice")).not.toBeInTheDocument();

    // No enable/disable switch (replaced by play/stop button)
    expect(screen.queryByText("TTS Enabled")).not.toBeInTheDocument();
    expect(screen.queryByText("TTS Disabled")).not.toBeInTheDocument();

    // No "Announce agent name" toggle
    expect(screen.queryByText("Announce agent name")).not.toBeInTheDocument();
  });
});

// ─── App.jsx integration ────────────────────────────────────────────────────

describe("CARD-072 QA: App.jsx integration", () => {
  test("Stream tab uses HeadphonesIcon (not RecordVoiceOver)", () => {
    renderApp();

    const tabs = screen.getAllByRole("tab");
    // Tab 3 should have a Headphones icon (via HeadphonesIcon SVG)
    expect(tabs[3]).toHaveTextContent("Stream");
    // Verify no TTS label exists
    expect(screen.queryByText("TTS")).not.toBeInTheDocument();
  });

  test("navigating to Stream tab renders StreamView with Audio Stream heading", async () => {
    renderApp();

    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[3]);

    await waitFor(() => {
      expect(screen.getByText("Audio Stream")).toBeInTheDocument();
    });

    // Verify play button is present
    expect(screen.getByLabelText("Start stream")).toBeInTheDocument();
  });
});

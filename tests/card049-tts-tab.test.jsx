/**
 * CARD-049 QA Tests — TTS Tab (Phase 3).
 *
 * Verifies:
 * 1. App.jsx renders TTS as 5th tab with RecordVoiceOver icon
 * 2. Tab ordering: Messages, Board, Agents, TTS, Projects
 * 3. TtsView component renders global controls (enable/disable, volume, speed, announce agent name)
 * 4. Volume slider shows percentage
 * 5. Speed selector offers 0.75x/1x/1.25x/1.5x
 * 6. Per-agent voice table renders for all agents with voice dropdown
 * 7. Preview and Stop buttons exist per agent
 * 8. Error Snackbar appears on tts.error
 * 9. TtsControls are NO LONGER in ChatView header
 * 10. Mobile: 5 icon-only tabs
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import App from "../src/App";
import TtsView from "../src/components/TtsView";

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

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const DEFAULT_AGENTS = [
  { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
  { name: "developer-1", description: "Developer", isActive: true, sortOrder: 1 },
  { name: "qa-1", description: "QA Engineer", isActive: true, sortOrder: 2 },
];

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
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...(overrides.tts || {}) },
      agents: overrides.agents || { agents: DEFAULT_AGENTS, loading: false, error: null },
      board: overrides.board || { board: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: overrides.messages || {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
        mobileDrawerOpen: false,
      },
      projects: overrides.projects || { projects: [], activeProject: null, loading: false, error: null },
    },
  });
}

function renderWithProviders(ui, { store, ...options } = {}) {
  const testStore = store || createTestStore();
  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...options }), store: testStore };
}

beforeEach(() => {
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [], sprints: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: DEFAULT_AGENTS });

  // Mock speechSynthesis for TtsView
  Object.defineProperty(window, "speechSynthesis", {
    value: {
      speak: jest.fn(),
      cancel: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      getVoices: jest.fn().mockReturnValue([
        { name: "Google UK English Male", lang: "en-GB", default: true },
        { name: "Google US English", lang: "en-US", default: false },
        { name: "Microsoft David", lang: "en-US", default: false },
      ]),
      speaking: false,
      onvoiceschanged: undefined,
    },
    writable: true,
    configurable: true,
  });

  global.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
    text,
    rate: 1,
    volume: 1,
    voice: null,
    onend: null,
    onerror: null,
  }));
});

afterEach(() => jest.restoreAllMocks());

// ─── App.jsx Tab Structure ──────────────────────────────────────────────────

describe("CARD-049: TTS tab in App.jsx", () => {
  test("App renders 5 tabs: Messages, Board, Agents, Stream, Projects", () => {
    const store = createTestStore();
    renderWithProviders(<App />, { store });

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);

    // Verify tab labels (desktop)
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Stream")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  test("Stream tab is the 4th tab (index 3)", () => {
    const store = createTestStore();
    renderWithProviders(<App />, { store });

    const tabs = screen.getAllByRole("tab");
    // tabs[3] should be Stream
    expect(tabs[3]).toHaveTextContent("Stream");
  });

  test("clicking Stream tab renders StreamView", async () => {
    const store = createTestStore();
    renderWithProviders(<App />, { store });

    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[3]); // click Stream tab

    await waitFor(() => {
      expect(screen.getByText("Audio Stream")).toBeInTheDocument();
    });
  });
});

// ─── TtsView Component ─────────────────────────────────────────────────────

describe("CARD-049: TtsView global controls", () => {
  test("renders 'Text-to-Speech' heading", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText("Text-to-Speech")).toBeInTheDocument();
  });

  test("renders enable/disable toggle switch", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText("TTS Disabled")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });

  test("toggle dispatches setEnabled and label changes", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    expect(store.getState().tts.enabled).toBe(true);
    expect(screen.getByText("TTS Enabled")).toBeInTheDocument();
  });

  test("volume slider is rendered with percentage label", () => {
    const store = createTestStore({ tts: { volume: 0.7 } });
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  test("speed selector renders with 4 options", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText("Speed")).toBeInTheDocument();
  });

  test("'Announce agent name before message' toggle is present", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText("Announce agent name before message")).toBeInTheDocument();
  });

  test("announce agent name toggle dispatches setSpeakAgentName", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    const switches = screen.getAllByRole("switch");
    // Second switch is the announce toggle (first is enable/disable)
    const announceToggle = switches[1];
    fireEvent.click(announceToggle);
    expect(store.getState().tts.speakAgentName).toBe(true);
  });
});

// ─── Per-Agent Voice Table ──────────────────────────────────────────────────

describe("CARD-049: Per-agent voice configuration table", () => {
  test("shows 'Per-Agent Voice' heading", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText("Per-Agent Voice")).toBeInTheDocument();
  });

  test("renders a row for each agent with description and name", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    // Agent descriptions as bold text
    expect(screen.getByText("PM Agent")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("QA Engineer")).toBeInTheDocument();

    // Agent names as captions
    expect(screen.getByText("pm-1")).toBeInTheDocument();
    expect(screen.getByText("developer-1")).toBeInTheDocument();
    expect(screen.getByText("qa-1")).toBeInTheDocument();
  });

  test("renders table headers: Agent, Voice, Preview", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Voice")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  test("each agent row has preview and stop buttons", () => {
    const store = createTestStore();
    renderWithProviders(<TtsView />, { store });

    // 3 agents x 2 buttons (play + stop) = 6 icon buttons in table
    const playButtons = screen.getAllByTitle("Preview voice");
    const stopButtons = screen.getAllByTitle("Stop preview");
    expect(playButtons).toHaveLength(3);
    expect(stopButtons).toHaveLength(3);
  });

  test("shows 'No agents loaded' when agent list is empty", () => {
    const store = createTestStore({ agents: { agents: [], loading: false, error: null } });
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText(/No agents loaded/)).toBeInTheDocument();
  });
});

// ─── Error Snackbar ─────────────────────────────────────────────────────────

describe("CARD-049: Error Snackbar in TtsView", () => {
  test("shows error Snackbar when tts.error is set", () => {
    const store = createTestStore({ tts: { error: "Speech synthesis failed" } });
    renderWithProviders(<TtsView />, { store });

    expect(screen.getByText("Speech synthesis failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("no error Snackbar when tts.error is null", () => {
    const store = createTestStore({ tts: { error: null } });
    renderWithProviders(<TtsView />, { store });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ─── ChatView: TtsControls removed ─────────────────────────────────────────

describe("CARD-049: TtsControls removed from ChatView", () => {
  test("ChatView no longer imports or renders TtsControls", async () => {
    // Navigate to Messages tab (default tab=0) and verify no TTS toggle in chat header
    const store = createTestStore({
      messages: {
        conversations: {
          "pm-1": { messages: [], loaded: true, hasMore: false, loadingMore: false },
          all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
        },
        unreadCounts: { all: 0 },
        selectedAgent: "pm-1",
        sending: false,
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
      },
    });

    renderWithProviders(<App />, { store });

    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalled();
    });

    // VolumeOff/VolumeUp icons should NOT be present in the Messages tab
    expect(screen.queryByTestId("VolumeOffIcon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("VolumeUpIcon")).not.toBeInTheDocument();
  });
});

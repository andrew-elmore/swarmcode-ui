/**
 * CARD-031: TtsControls component tests + ChatView/MessagesView integration tests
 * Test Cases 30-37 from the CARD-031 test plan.
 * Author: qa-1
 * Date: 2026-02-10
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import TtsControls from "../src/components/TtsControls";
import MessagesView from "../src/components/MessagesView";

// Mock API module
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

// jsdom doesn't provide SpeechSynthesisUtterance
class MockUtterance {
  constructor(text) {
    this.text = text;
    this.voice = null;
    this.rate = 1;
    this.volume = 1;
    this.onend = null;
    this.onerror = null;
  }
}
global.SpeechSynthesisUtterance = MockUtterance;

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
    },
    preloadedState,
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

// Create a mock TtsEngine that mirrors the real API
function createMockEngine(overrides = {}) {
  return {
    enabled: false,
    speaking: false,
    rate: 1.0,
    volume: 1.0,
    voice: null,
    setEnabled: jest.fn(),
    setRate: jest.fn(),
    setVolume: jest.fn(),
    setVoice: jest.fn(),
    speak: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => []),
    ...overrides,
  };
}

const DEFAULT_AGENTS_STATE = {
  agents: [
    { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
    { name: "senior-dev-1", description: "Senior Dev", isActive: true, sortOrder: 1 },
    { name: "developer-1", description: "Developer", isActive: true, sortOrder: 2 },
    { name: "qa-1", description: "QA Agent", isActive: true, sortOrder: 3 },
    { name: "devops-1", description: "DevOps Agent", isActive: true, sortOrder: 4 },
  ],
  loading: false,
  error: null,
};

beforeEach(() => {
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [] });
  api.createCard.mockResolvedValue({ card: {} });
  api.updateCard.mockResolvedValue({ card: {} });
  api.addComment.mockResolvedValue({ comment: {} });
  api.listCards.mockResolvedValue({ cards: [] });
  api.showCard.mockResolvedValue({ card: {} });
  api.pollBoard.mockResolvedValue({ changed: false, cards: [] });
  api.sendMessage.mockResolvedValue({ success: true });
  api.pollMessages.mockResolvedValue({ messages: [] });
  api.getConversation.mockResolvedValue({ messages: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.addRecentProject.mockResolvedValue({ success: true });
  api.getAgents.mockResolvedValue({
    agents: [
      { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
      { name: "senior-dev-1", description: "Senior Dev", isActive: true, sortOrder: 1 },
      { name: "developer-1", description: "Developer", isActive: true, sortOrder: 2 },
      { name: "qa-1", description: "QA Agent", isActive: true, sortOrder: 3 },
      { name: "devops-1", description: "DevOps Agent", isActive: true, sortOrder: 4 },
    ],
  });
});

afterEach(() => jest.restoreAllMocks());

// ═══════════════════════════════════════════════════════════════════════════════
// 2.3  Component Tests: TtsControls — Test Cases 30-35
// ═══════════════════════════════════════════════════════════════════════════════
describe("TtsControls", () => {
  // TC-30: Renders toggle button when engine provided
  test("TC-30: renders toggle button with VolumeOff icon when engine provided", () => {
    const engine = createMockEngine();
    render(
      <ThemeProvider theme={theme}>
        <TtsControls engineRef={{ current: engine }} />
      </ThemeProvider>
    );
    expect(screen.getByTestId("VolumeOffIcon")).toBeInTheDocument();
  });

  // TC-31: Returns null when engine is null
  test("TC-31: returns null when engine is null", () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <TtsControls engineRef={null} />
      </ThemeProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  // TC-32: Click toggle enables TTS
  test("TC-32: click toggle enables TTS, shows VolumeUp icon", async () => {
    const user = userEvent.setup();
    const engine = createMockEngine();
    render(
      <ThemeProvider theme={theme}>
        <TtsControls engineRef={{ current: engine }} />
      </ThemeProvider>
    );

    await user.click(screen.getByTestId("VolumeOffIcon").closest("button"));
    expect(engine.setEnabled).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("VolumeUpIcon")).toBeInTheDocument();
  });

  // TC-33: Shows controls when enabled (after toggle click)
  test("TC-33: shows stop button, volume slider, speed selector when enabled", async () => {
    const user = userEvent.setup();
    const engine = createMockEngine();
    render(
      <ThemeProvider theme={theme}>
        <TtsControls engineRef={{ current: engine }} />
      </ThemeProvider>
    );

    // Enable TTS
    await user.click(screen.getByTestId("VolumeOffIcon").closest("button"));

    // Stop button (StopIcon)
    expect(screen.getByTestId("StopIcon")).toBeInTheDocument();
    // Volume slider
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
    // Speed selector — look for the "1x" default value rendered in the select
    expect(screen.getByText("1x")).toBeInTheDocument();
  });

  // TC-34: Hides controls when disabled
  test("TC-34: hides controls when disabled (only toggle visible)", () => {
    const engine = createMockEngine();
    render(
      <ThemeProvider theme={theme}>
        <TtsControls engineRef={{ current: engine }} />
      </ThemeProvider>
    );

    // Only toggle button visible, no stop/slider/speed
    expect(screen.getByTestId("VolumeOffIcon")).toBeInTheDocument();
    expect(screen.queryByTestId("StopIcon")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Volume" })).not.toBeInTheDocument();
  });

  // TC-35: Speed selector has all options
  test("TC-35: speed selector has all four speed options", async () => {
    const user = userEvent.setup();
    const engine = createMockEngine();
    render(
      <ThemeProvider theme={theme}>
        <TtsControls engineRef={{ current: engine }} />
      </ThemeProvider>
    );

    // Enable TTS to reveal speed selector
    await user.click(screen.getByTestId("VolumeOffIcon").closest("button"));

    // The speed selector shows "1x" by default. Click to open the dropdown.
    // MUI Select renders options in a listbox on click.
    const speedSelect = screen.getByText("1x");
    await user.click(speedSelect);

    // All 4 speed options should be visible in the dropdown
    await waitFor(() => {
      expect(screen.getByText("0.75x")).toBeInTheDocument();
      expect(screen.getAllByText("1x").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("1.25x")).toBeInTheDocument();
      expect(screen.getByText("1.5x")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2.4  Integration Tests: MessagesView + ChatView — Test Cases 36-37
// ═══════════════════════════════════════════════════════════════════════════════
describe("Integration: MessagesView + ChatView TTS", () => {
  beforeEach(() => {
    // Provide speechSynthesis mock for TtsEngine constructor
    if (!window.speechSynthesis) {
      Object.defineProperty(window, "speechSynthesis", {
        value: {
          getVoices: jest.fn(() => []),
          speak: jest.fn(),
          cancel: jest.fn(),
          pause: jest.fn(),
          resume: jest.fn(),
          onvoiceschanged: undefined,
        },
        writable: true,
        configurable: true,
      });
    }
  });

  // TC-36: ChatView receives ttsEngine prop — TtsControls rendered in header
  test("TC-36: ChatView renders TtsControls in header when agent is selected", async () => {
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
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
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    renderWithProviders(<MessagesView />, { store });
    await waitFor(() => expect(api.subscribeToMessages).toHaveBeenCalled());

    // TtsControls renders a VolumeOff toggle button in the ChatView header
    expect(screen.getByTestId("VolumeOffIcon")).toBeInTheDocument();
  });

  // TC-37: Existing MessagesView tests still pass (regression check)
  test("TC-37: MessagesView renders without crash and shows agent sidebar", async () => {
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
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
      },
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    renderWithProviders(<MessagesView />, { store });
    await waitFor(() => expect(api.subscribeToMessages).toHaveBeenCalled());

    // Sidebar renders
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    // Placeholder shown when no agent selected
    expect(screen.getByText("Select an agent to start chatting")).toBeInTheDocument();
  });
});

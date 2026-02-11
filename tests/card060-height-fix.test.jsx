/**
 * CARD-060 QA Tests — Fix messenger height overflow.
 *
 * Verifies:
 * 1. App.jsx main content Box has minHeight:0 (allows flex shrink)
 * 2. App.jsx main content Box has flex:1 (fills remaining space)
 * 3. App.jsx main content Box has overflow:hidden (clips overflow)
 * 4. App.jsx root Box has height:100vh (viewport constraint)
 * 5. App.jsx root Box uses column flex layout
 */

import React from "react";
import { render, screen } from "@testing-library/react";
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

const DEFAULT_AGENTS = [
  { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
  { name: "developer-1", description: "Developer", isActive: true, sortOrder: 1 },
];

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,

  error: null,
};

function createTestStore() {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: DEFAULT_TTS_STATE,
      agents: { agents: DEFAULT_AGENTS, loading: false, error: null },
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        error: null,
        mobileDrawerOpen: false,
        messages: [],
        polling: false,
        lastPoll: null,
      },
      projects: { projects: [], activeProject: null, loading: false, error: null },
    },
  });
}

function renderApp() {
  const store = createTestStore();
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
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: DEFAULT_AGENTS });
  api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
});

afterEach(() => jest.restoreAllMocks());

// ─── App layout: viewport constraint ────────────────────────────────────────

describe("CARD-060: App layout constrains content to viewport", () => {
  test("root Box has height:100vh and column flex direction", () => {
    const { container } = renderApp();

    // Root Box is the outermost div rendered by App
    const rootBox = container.firstChild;
    expect(rootBox).toBeInTheDocument();

    const styles = window.getComputedStyle(rootBox);
    expect(styles.display).toBe("flex");
    expect(styles.flexDirection).toBe("column");
    expect(styles.height).toBe("100vh");
  });

  test("main content Box has minHeight:0 to allow flex shrink", () => {
    const { container } = renderApp();

    // main content Box is the <main> element
    const mainBox = container.querySelector("main");
    expect(mainBox).toBeInTheDocument();

    const styles = window.getComputedStyle(mainBox);
    // jsdom returns "0" (without unit) for minHeight: 0
    expect(["0", "0px"]).toContain(styles.minHeight);
  });

  test("main content Box has flex:1 to fill remaining space", () => {
    const { container } = renderApp();

    const mainBox = container.querySelector("main");
    expect(mainBox).toBeInTheDocument();

    const styles = window.getComputedStyle(mainBox);
    // flex: 1 expands to flex-grow: 1
    expect(styles.flexGrow).toBe("1");
  });

  test("main content Box has overflow:hidden to clip content", () => {
    const { container } = renderApp();

    const mainBox = container.querySelector("main");
    expect(mainBox).toBeInTheDocument();

    const styles = window.getComputedStyle(mainBox);
    expect(styles.overflow).toBe("hidden");
  });

  test("AppBar is a static positioned element (not fixed/sticky)", () => {
    renderApp();

    const appBar = screen.getByRole("banner");
    expect(appBar).toBeInTheDocument();

    const styles = window.getComputedStyle(appBar);
    // position: static means AppBar participates in normal flow,
    // allowing the main Box to take remaining height
    expect(styles.position).toBe("static");
  });
});

/**
 * CARD-059 QA Tests — Fix redundant scroll containers in messenger.
 *
 * Verifies:
 * 1. MessagesView desktop sidebar Box uses overflow:"hidden" (not "auto")
 * 2. AgentSidebar List uses overflow:"auto" (it is the sole scroll container)
 * 3. Only ONE element in the sidebar hierarchy has overflow:auto
 * 4. AgentSidebar renders all active agents (scroll content works)
 * 5. Desktop sidebar Box has correct width (SIDEBAR_WIDTH = 240)
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
import AgentSidebar from "../src/components/AgentSidebar";
import MessagesView from "../src/components/MessagesView";

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

const MANY_AGENTS = Array.from({ length: 15 }, (_, i) => ({
  name: `agent-${i + 1}`,
  description: `Agent ${i + 1}`,
  isActive: true,
  sortOrder: i,
}));

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,

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
      tts: DEFAULT_TTS_STATE,
      agents: overrides.agents || { agents: MANY_AGENTS, loading: false, error: null },
      board: overrides.board || { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: overrides.messages || {
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
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
  api.getAgents.mockResolvedValue({ agents: MANY_AGENTS });
});

afterEach(() => jest.restoreAllMocks());

// ─── AgentSidebar: Sole scroll container ────────────────────────────────────

describe("CARD-059: AgentSidebar List is the sole scroll container", () => {
  test("AgentSidebar List has overflow:auto", () => {
    const store = createTestStore();
    const { container } = renderWithProviders(
      <AgentSidebar selectedAgent={null} onSelectAgent={jest.fn()} unreadCounts={{ all: 0 }} />,
      { store }
    );

    // The MUI List renders as a <ul> element
    const list = container.querySelector("ul");
    expect(list).toBeInTheDocument();
    const styles = window.getComputedStyle(list);
    expect(styles.overflow).toBe("auto");
  });

  test("AgentSidebar root Box does NOT have overflow:auto", () => {
    const store = createTestStore();
    const { container } = renderWithProviders(
      <AgentSidebar selectedAgent={null} onSelectAgent={jest.fn()} unreadCounts={{ all: 0 }} />,
      { store }
    );

    // Root Box is the first child (a div wrapping the List)
    const rootBox = container.firstChild;
    expect(rootBox).toBeInTheDocument();
    const styles = window.getComputedStyle(rootBox);
    // Root should NOT be overflow:auto — only the List inside should scroll
    expect(styles.overflow).not.toBe("auto");
  });

  test("AgentSidebar renders all 15 active agents plus All Agents", () => {
    const store = createTestStore();
    renderWithProviders(
      <AgentSidebar selectedAgent={null} onSelectAgent={jest.fn()} unreadCounts={{ all: 0 }} />,
      { store }
    );

    // "All Agents" + 15 individual agents = 16 list item buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(16);
    expect(buttons[0]).toHaveTextContent("All Agents");
  });
});

// ─── MessagesView: Desktop sidebar overflow ─────────────────────────────────

describe("CARD-059: MessagesView desktop sidebar uses overflow:hidden", () => {
  // Mock useMediaQuery to return desktop (not mobile)
  beforeEach(() => {
    // By default, jsdom viewport is wide enough to be "desktop" for md breakpoint.
    // MUI's useMediaQuery with theme.breakpoints.down("md") returns false in jsdom by default.
  });

  test("desktop sidebar Box in MessagesView has overflow:hidden (not auto)", () => {
    const store = createTestStore({
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
    });
    const { container } = renderWithProviders(<MessagesView />, { store });

    // Desktop layout: root flex container > sidebar Box > AgentSidebar
    // The sidebar Box is the first child of the root flex container
    const rootFlex = container.firstChild;
    const sidebarBox = rootFlex.firstChild;
    expect(sidebarBox).toBeInTheDocument();

    const styles = window.getComputedStyle(sidebarBox);
    expect(styles.overflow).toBe("hidden");
  });

  test("only one element in sidebar hierarchy has overflow:auto (the List)", () => {
    const store = createTestStore();
    const { container } = renderWithProviders(<MessagesView />, { store });

    // Find all elements in the sidebar area with overflow:auto
    const rootFlex = container.firstChild;
    const sidebarBox = rootFlex.firstChild;
    const allElements = sidebarBox.querySelectorAll("*");

    let overflowAutoCount = 0;
    allElements.forEach((el) => {
      const styles = window.getComputedStyle(el);
      if (styles.overflow === "auto") {
        overflowAutoCount++;
        // The only one should be the <ul> (MUI List)
        expect(el.tagName).toBe("UL");
      }
    });

    // Exactly one overflow:auto element — the List
    expect(overflowAutoCount).toBe(1);
  });

  test("desktop sidebar Box has width 240px", () => {
    const store = createTestStore();
    const { container } = renderWithProviders(<MessagesView />, { store });

    const rootFlex = container.firstChild;
    const sidebarBox = rootFlex.firstChild;
    const styles = window.getComputedStyle(sidebarBox);
    expect(styles.width).toBe("240px");
  });
});

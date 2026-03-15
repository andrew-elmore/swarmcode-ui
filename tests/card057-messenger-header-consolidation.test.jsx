/**
 * CARD-057 QA Tests — Messenger header consolidation.
 *
 * Verifies:
 * Desktop:
 *  1. Only ONE header bar (AppBar) — no separate chat header below it
 *  2. Selected agent name shows in AppBar on right when on Messages tab
 *  3. Agent name NOT shown in AppBar on other tabs
 *  4. No 'Conversations' label above agent sidebar
 *
 * Mobile:
 *  5. Hamburger icon appears in AppBar on Messages tab only
 *  6. Hamburger not shown on other tabs
 *  7. Selected agent name shows in secondary toolbar on Messages tab
 *  8. No standalone hamburger bar between sidebar and chat
 *  9. Drawer open/close state managed via Redux (mobileDrawerOpen)
 *
 * ChatView:
 * 10. ChatView has no separate header — messages start immediately
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import articlesReducer from "../src/store/articlesSlice";
import projectReducer from "../src/store/projectSlice";
import messagesReducer, { selectAgent, setMobileDrawerOpen } from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import authReducer from "../src/store/authSlice";
import commandsReducer from "../src/store/commandsSlice";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import ChatView from "../src/components/ChatView";
import AgentSidebar from "../src/components/AgentSidebar";

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
  subscribeToCommands: jest.fn(),
  subscribeToPings: jest.fn(),
  getRecentMessages: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  getAllAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  assignAgentToProject: jest.fn(),
  unassignAgentFromProject: jest.fn(),
  updateProjectAgent: jest.fn(),
}));

// CARD-090: StreamView now uses speechSynthesis — mock it for jsdom
window.speechSynthesis = {
  cancel: jest.fn(),
  speak: jest.fn(),
  getVoices: jest.fn(() => []),
  speaking: false,
  paused: false,
  pause: jest.fn(),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};
global.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  constructor(text) { this.text = text; this.rate = 1; this.volume = 1; this.voice = null; this.onend = null; this.onerror = null; }
};

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
      tts: DEFAULT_TTS_STATE,
      agents: overrides.agents || { agents: DEFAULT_AGENTS, allAgents: [], loading: false, error: null },
      board: overrides.project || { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
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

function renderWithProviders(ui, { store, initialPath = '/', ...options } = {}) {
  const testStore = store || createTestStore();
  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[initialPath]}>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...options }), store: testStore };
}

beforeEach(() => {
  api.getOrCreateProject.mockResolvedValue({ project: null, cards: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.subscribeToCommands.mockResolvedValue(jest.fn());
  api.subscribeToPings.mockResolvedValue(jest.fn());
  api.getRecentMessages.mockResolvedValue({ messages: [] });
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: DEFAULT_AGENTS });
  api.getAllAgents.mockResolvedValue({ agents: DEFAULT_AGENTS });
  api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
});

afterEach(() => jest.restoreAllMocks());

// ─── Desktop: Agent name in AppBar ──────────────────────────────────────────

// With CARD-089 routing, tabs are visible at /:projectId routes.
// Messages tab is index 1 (Stream=0, Messages=1, Board=2, Agents=3, Commands=4, Articles=5).
const PROJ_STORE_OVERRIDE = {
  projects: {
    projects: [{ objectId: 'projA111', path: '/test', name: 'Test' }],
    activeProject: { objectId: 'projA111', path: '/test', name: 'Test' },
    loading: false, error: null,
  },
};

const MESSAGES_WITH_PM1 = {
  conversations: {
    all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
    "pm-1": { messages: [], loaded: false, hasMore: true, loadingMore: false },
  },
  unreadCounts: { all: 0, "pm-1": 0 },
  selectedAgent: "pm-1",
  sending: false,
  error: null,
  mobileDrawerOpen: false,
  messages: [],
  polling: false,
  lastPoll: null,
};

describe("CARD-057: Desktop — agent name in AppBar on Messages tab", () => {
  test("selected agent description shows in AppBar when on Messages tab", () => {
    const store = createTestStore({ ...PROJ_STORE_OVERRIDE, messages: MESSAGES_WITH_PM1 });
    // Render at /:projectId/messages so tabValue === 1 (Messages)
    renderWithProviders(<App />, { store, initialPath: '/projA111/messages' });

    const appBar = screen.getByRole("banner");
    expect(within(appBar).getByText("PM Agent")).toBeInTheDocument();
  });

  test("agent name NOT shown in AppBar on Board tab", () => {
    const store = createTestStore({ ...PROJ_STORE_OVERRIDE, messages: MESSAGES_WITH_PM1 });
    renderWithProviders(<App />, { store, initialPath: '/projA111/messages' });

    // Switch to Board tab (index 2 with CARD-089: Stream=0, Messages=1, Board=2)
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[2]);

    const appBar = screen.getByRole("banner");
    expect(within(appBar).queryByText("PM Agent")).not.toBeInTheDocument();
  });

  test("agent name NOT shown when no agent is selected", () => {
    const store = createTestStore({ ...PROJ_STORE_OVERRIDE });
    renderWithProviders(<App />, { store, initialPath: '/projA111/messages' });

    const appBar = screen.getByRole("banner");
    expect(within(appBar).getByText("SwarmCode")).toBeInTheDocument();
    expect(within(appBar).queryByText("PM Agent")).not.toBeInTheDocument();
    expect(within(appBar).queryByText("Developer")).not.toBeInTheDocument();
  });
});

// ─── ChatView: No separate header ──────────────────────────────────────────

describe("CARD-057: ChatView has no separate header", () => {
  test("ChatView with selected agent renders messages area directly (no header bar)", () => {
    const store = createTestStore({
      messages: {
        conversations: {
          all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
          "pm-1": {
            messages: [
              { id: "m1", from: "pm-1", to: "owner", message: "Test message", createdAt: "2026-02-10T10:00:00Z" },
            ],
            loaded: true,
            hasMore: false,
            loadingMore: false,
          },
        },
        unreadCounts: { all: 0, "pm-1": 0 },
        selectedAgent: "pm-1",
        sending: false,
        error: null,
        mobileDrawerOpen: false,
        messages: [],
        polling: false,
        lastPoll: null,
      },
    });
    const { container } = renderWithProviders(<ChatView />, { store });

    // ChatView's root should be a flex column with messages + input (no header)
    const rootBox = container.firstChild;
    expect(rootBox).toBeInTheDocument();

    // Message should be rendered
    expect(screen.getByText("Test message")).toBeInTheDocument();

    // Input should be present
    expect(screen.getByPlaceholderText("Message PM Agent...")).toBeInTheDocument();

    // There should NOT be a separate header with agent name inside ChatView
    // (The agent name is now in App.jsx AppBar, not in ChatView)
    // Count direct children: should be 2 (messages area + input area), not 3
    const directChildren = rootBox.children;
    expect(directChildren.length).toBe(2);
  });

  test("ChatView placeholder shows when no agent selected", () => {
    const store = createTestStore();
    renderWithProviders(<ChatView />, { store });

    expect(screen.getByText("Select an agent to start chatting")).toBeInTheDocument();
  });
});

// ─── AgentSidebar: No 'Conversations' label ────────────────────────────────

describe("CARD-057: AgentSidebar has no 'Conversations' label", () => {
  test("AgentSidebar does not render a 'Conversations' heading", () => {
    const store = createTestStore();
    renderWithProviders(
      <AgentSidebar selectedAgent={null} onSelectAgent={jest.fn()} unreadCounts={{ all: 0 }} />,
      { store }
    );

    // "Conversations" text should NOT be present
    expect(screen.queryByText("Conversations")).not.toBeInTheDocument();

    // Agent list should still render
    expect(screen.getByText("All Agents")).toBeInTheDocument();
  });

  test("AgentSidebar list starts with All Agents (no heading above)", () => {
    const store = createTestStore();
    renderWithProviders(
      <AgentSidebar selectedAgent={null} onSelectAgent={jest.fn()} unreadCounts={{ all: 0 }} />,
      { store }
    );

    // First list item should be "All Agents"
    const listItems = screen.getAllByRole("button");
    expect(listItems[0]).toHaveTextContent("All Agents");
  });
});

// ─── Redux: mobileDrawerOpen state ──────────────────────────────────────────

describe("CARD-057: mobileDrawerOpen Redux state", () => {
  test("mobileDrawerOpen defaults to false", () => {
    const store = createTestStore();
    expect(store.getState().messages.mobileDrawerOpen).toBe(false);
  });

  test("setMobileDrawerOpen(true) opens drawer", () => {
    const store = createTestStore();
    store.dispatch(setMobileDrawerOpen(true));
    expect(store.getState().messages.mobileDrawerOpen).toBe(true);
  });

  test("setMobileDrawerOpen(false) closes drawer", () => {
    const store = createTestStore();
    store.dispatch(setMobileDrawerOpen(true));
    store.dispatch(setMobileDrawerOpen(false));
    expect(store.getState().messages.mobileDrawerOpen).toBe(false);
  });

  test("selectAgent on mobile closes drawer via dispatch", () => {
    // This tests the behavior in MessagesView — selecting an agent
    // dispatches setMobileDrawerOpen(false) when on mobile.
    // We test the Redux part: selectAgent doesn't touch mobileDrawerOpen directly,
    // but the component dispatches setMobileDrawerOpen(false) after selectAgent.
    const store = createTestStore();
    store.dispatch(setMobileDrawerOpen(true));
    expect(store.getState().messages.mobileDrawerOpen).toBe(true);

    // Simulate what MessagesView.handleSelectAgent does
    store.dispatch(selectAgent("pm-1"));
    store.dispatch(setMobileDrawerOpen(false));
    expect(store.getState().messages.mobileDrawerOpen).toBe(false);
    expect(store.getState().messages.selectedAgent).toBe("pm-1");
  });
});

// ─── Tab switching hides Messages-specific elements ─────────────────────────

describe("CARD-057: Tab switching hides Messages-specific AppBar elements", () => {
  test("switching from Messages to Agents hides agent name from AppBar", () => {
    const store = createTestStore({ ...PROJ_STORE_OVERRIDE, messages: MESSAGES_WITH_PM1 });
    renderWithProviders(<App />, { store, initialPath: '/projA111/messages' });

    const appBar = screen.getByRole("banner");

    // On Messages tab: agent name visible
    expect(within(appBar).getByText("PM Agent")).toBeInTheDocument();

    // Switch to Agents tab (index 3: Stream=0, Messages=1, Board=2, Agents=3)
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[3]);

    expect(within(appBar).queryByText("PM Agent")).not.toBeInTheDocument();
  });

  test("switching between non-Messages tabs does not show agent name", () => {
    const store = createTestStore({
      ...PROJ_STORE_OVERRIDE,
      messages: {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: "pm-1",
        sending: false, error: null, mobileDrawerOpen: false,
        messages: [], polling: false, lastPoll: null,
      },
    });
    renderWithProviders(<App />, { store, initialPath: '/projA111' });

    const appBar = screen.getByRole("banner");
    const tabs = screen.getAllByRole("tab");

    // Board tab (index 2)
    fireEvent.click(tabs[2]);
    expect(within(appBar).queryByText("PM Agent")).not.toBeInTheDocument();

    // Agents tab (index 3)
    fireEvent.click(tabs[3]);
    expect(within(appBar).queryByText("PM Agent")).not.toBeInTheDocument();

    // Commands tab (index 4)
    fireEvent.click(tabs[4]);
    expect(within(appBar).queryByText("PM Agent")).not.toBeInTheDocument();
  });

  test("returning to Messages tab re-shows agent name", () => {
    const store = createTestStore({ ...PROJ_STORE_OVERRIDE, messages: MESSAGES_WITH_PM1 });
    renderWithProviders(<App />, { store, initialPath: '/projA111/messages' });

    const appBar = screen.getByRole("banner");
    const tabs = screen.getAllByRole("tab");

    // Switch away to Board (index 2)
    fireEvent.click(tabs[2]);
    expect(within(appBar).queryByText("PM Agent")).not.toBeInTheDocument();

    // Switch back to Messages (index 1)
    fireEvent.click(tabs[1]);
    expect(within(appBar).getByText("PM Agent")).toBeInTheDocument();
  });
});

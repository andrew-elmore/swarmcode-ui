/**
 * Tests for UI components — render tests using React Testing Library.
 * API calls are mocked to prevent real network requests.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import articlesReducer from "../src/store/articlesSlice";
import projectReducer from "../src/store/projectSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import authReducer from "../src/store/authSlice";
import commandsReducer from "../src/store/commandsSlice";
import App from "../src/App";
import BoardView from "../src/components/BoardView";
import MessagesView from "../src/components/MessagesView";
import ChatView from "../src/components/ChatView";
import AgentSidebar from "../src/components/AgentSidebar";
import CreateCardDialog from "../src/components/CreateCardDialog";
import CardDetailDialog from "../src/components/CardDetailDialog";
import ProjectSelector from "../src/components/ProjectSelector";
import ProjectsView from "../src/components/ProjectsView";

// Mock the entire API module to prevent real fetch calls
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
  listArticles: jest.fn(),
  createArticle: jest.fn(),
  updateArticle: jest.fn(),
  deleteArticle: jest.fn(),
  searchArticles: jest.fn(),
  getArticle: jest.fn(),
}));

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

function createTestStore(preloadedState = {}) {
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
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null, queue: [], currentIndex: -1 },
      project: {
        project: { objectId: "test-board-id" },
        cards: [],
        sprints: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
      ...preloadedState,
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
  // Default mock implementations — resolve to safe defaults
  api.getOrCreateProject.mockResolvedValue({ project: null, cards: [], sprints: [] });
  api.createCard.mockResolvedValue({ card: {} });
  api.updateCard.mockResolvedValue({ card: {} });
  api.addComment.mockResolvedValue({ comment: {} });
  api.listCards.mockResolvedValue({ cards: [] });
  api.showCard.mockResolvedValue({ card: {} });
  api.sendMessage.mockResolvedValue({ success: true });
  api.getConversation.mockResolvedValue({ messages: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn()); // returns unsubscribe function
  api.subscribeToCommands.mockResolvedValue(jest.fn());
  api.subscribeToPings.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.addRecentProject.mockResolvedValue({ success: true });
  api.listArticles.mockResolvedValue({ articles: [] });
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

// ─── App Component ───────────────────────────────────────────────────────────

describe("App", () => {
  test("renders SwarmCode title in app bar", async () => {
    renderWithProviders(<App />);
    expect(screen.getByText("SwarmCode")).toBeInTheDocument();
  });

  test("renders Messages, Board, and Projects tabs", () => {
    renderWithProviders(<App />);
    expect(screen.getByRole("tab", { name: /messages/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /board/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /projects/i })).toBeInTheDocument();
  });

  test("shows MessagesView by default", () => {
    renderWithProviders(<App />);
    // Default tab is Messages → shows AgentSidebar and ChatView placeholder
    expect(screen.getByText("All Agents")).toBeInTheDocument();
    expect(screen.getByText("Select an agent to start chatting")).toBeInTheDocument();
  });

  test("shows ProjectSelector in the app bar", () => {
    renderWithProviders(<App />);
    // ProjectSelector renders an Add button with title "Add project"
    expect(screen.getByTitle("Add project")).toBeInTheDocument();
  });

  test("switches to BoardView when Board tab is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole("tab", { name: /board/i }));

    // No active project → BoardView shows "Select a project" prompt
    await waitFor(() => {
      expect(screen.getByText(/select a project/i)).toBeInTheDocument();
    });
  });

  test("switches back to MessagesView when Messages tab is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole("tab", { name: /board/i }));
    await waitFor(() => {
      expect(screen.getByText(/select a project/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /messages/i }));

    await waitFor(() => {
      expect(screen.getByText("All Agents")).toBeInTheDocument();
    });
  });

  test("switches to ProjectsView when Projects tab is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole("tab", { name: /projects/i }));

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });
  });
});

// ─── BoardView Component ─────────────────────────────────────────────────────

describe("BoardView", () => {
  test("shows 'Select a project' when no active project", () => {
    renderWithProviders(<BoardView />);
    expect(screen.getByText(/select a project/i)).toBeInTheDocument();
  });

  test("shows loading spinner when loading", () => {
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: true, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  test("shows error alert when error exists", async () => {
    api.getOrCreateProject.mockRejectedValue(new Error("Network error"));

    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  test("renders Board heading and New Card button when board loaded", async () => {
    const mockBoard = { objectId: "b1", projectHash: "abc", nextId: 1 };
    api.getOrCreateProject.mockResolvedValue({ project: mockBoard, cards: [] });

    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Board")).toBeInTheDocument();
    });
    expect(screen.getByText("New Card")).toBeInTheDocument();
  });

  test("renders all 6 Kanban columns", async () => {
    const mockBoard = { objectId: "b1", projectHash: "abc", nextId: 1 };
    api.getOrCreateProject.mockResolvedValue({ project: mockBoard, cards: [] });

    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Create")).toBeInTheDocument();
    });
    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(screen.getByText("Implement")).toBeInTheDocument();
    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("Test Review")).toBeInTheDocument();
    expect(screen.getByText("Ship")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  test("renders cards in correct columns", async () => {
    const mockBoard = { objectId: "b1", projectHash: "abc", nextId: 3 };
    const mockCards = [
      { cardId: "CARD-001", title: "Fix bug", status: "scope", priority: "high" },
      { cardId: "CARD-002", title: "Add feature", status: "implement", priority: "medium" },
    ];
    api.getOrCreateProject.mockResolvedValue({ project: mockBoard, cards: mockCards });

    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Fix bug")).toBeInTheDocument();
    });
    expect(screen.getByText("Add feature")).toBeInTheDocument();
    expect(screen.getByText("CARD-001")).toBeInTheDocument();
    expect(screen.getByText("CARD-002")).toBeInTheDocument();
  });

  test("fetches board when active project is set", async () => {
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/my/project", name: "project" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(api.getOrCreateProject).toHaveBeenCalledWith("/my/project");
    });
  });
});

// Default agents state for tests that need agent labels
const DEFAULT_AGENTS_STATE = {
  agents: [
    { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
    { name: "senior-dev-1", description: "Senior Dev", isActive: true, sortOrder: 1 },
    { name: "developer-1", description: "Developer", isActive: true, sortOrder: 2 },
    { name: "qa-1", description: "QA Agent", isActive: true, sortOrder: 3 },
    { name: "devops-1", description: "DevOps Agent", isActive: true, sortOrder: 4 },
  ],
  allAgents: [],
  loading: false,
  error: null,
};

// ─── MessagesView Component ──────────────────────────────────────────────────

describe("MessagesView", () => {
  // Helper to render MessagesView and wait for the component to settle.
  // Note: subscribeToMessages moved to App.jsx (CARD-092), so we wait for the sidebar instead.
  async function renderMessages(store) {
    const result = renderWithProviders(<MessagesView />, store ? { store } : undefined);
    await waitFor(() => {
      expect(screen.getByText("All Agents")).toBeInTheDocument();
    });
    return result;
  }

  test("renders All Agents entry in sidebar", async () => {
    await renderMessages();
    expect(screen.getByText("All Agents")).toBeInTheDocument();
  });

  test("renders agent list in sidebar", async () => {
    const store = createTestStore({
      agents: {
        agents: [
          { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
          { name: "senior-dev-1", description: "Senior Dev", isActive: true, sortOrder: 1 },
          { name: "developer-1", description: "Developer", isActive: true, sortOrder: 2 },
          { name: "qa-1", description: "QA Agent", isActive: true, sortOrder: 3 },
          { name: "devops-1", description: "DevOps Agent", isActive: true, sortOrder: 4 },
        ],
        loading: false,
        error: null,
      },
    });
    await renderMessages(store);
    expect(screen.getByText("All Agents")).toBeInTheDocument();
    expect(screen.getByText("PM Agent")).toBeInTheDocument();
    expect(screen.getByText("Senior Dev")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("QA Agent")).toBeInTheDocument();
    expect(screen.getByText("DevOps Agent")).toBeInTheDocument();
  });

  test("shows 'Select an agent to start chatting' placeholder when no agent selected", async () => {
    await renderMessages();
    expect(screen.getByText("Select an agent to start chatting")).toBeInTheDocument();
  });

  test("subscribes to LiveQuery messages on mount", async () => {
    // CARD-092: subscription moved to App.jsx — render App to test this behaviour
    renderWithProviders(<App />);
    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalled();
    });
  });

  test("shows chat view with empty state when agent is selected", async () => {
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        conversations: {
          "pm-1": { messages: [], loaded: true },
          all: { messages: [], loaded: false },
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
    await renderMessages(store);
    // "PM Agent" appears in sidebar (chat header was merged into AppBar)
    expect(screen.getByText("PM Agent")).toBeInTheDocument();
    expect(screen.getByText("No messages yet. Send a message to get started.")).toBeInTheDocument();
  });

  test("renders messages in chat view when conversation has messages", async () => {
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        conversations: {
          "pm-1": {
            messages: [
              { id: "m1", from: "pm-1", to: "owner", message: "Hello there", createdAt: "2026-01-01T00:00:00Z" },
            ],
            loaded: true,
          },
          all: { messages: [], loaded: false },
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
    await renderMessages(store);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  test("send button is disabled when input is empty", async () => {
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        conversations: {
          "pm-1": { messages: [], loaded: true },
          all: { messages: [], loaded: false },
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
    await renderMessages(store);
    // ChatView send button is an IconButton with SendIcon (no text label) — find by testid on SVG
    const sendBtns = screen.getAllByRole("button");
    // The last button in the chat area is the send icon button
    const sendBtn = sendBtns.find((btn) => btn.querySelector("[data-testid='SendIcon']"));
    expect(sendBtn).toBeTruthy();
    expect(sendBtn).toBeDisabled();
  });

  test("renders message input placeholder with agent name", async () => {
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        conversations: {
          "pm-1": { messages: [], loaded: true },
          all: { messages: [], loaded: false },
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
    await renderMessages(store);
    expect(screen.getByPlaceholderText("Message PM Agent...")).toBeInTheDocument();
  });

  // CARD-092: LiveQuery subscription moved from MessagesView to App.jsx.
  // These tests now render App to test subscription lifecycle.

  test("calls unsubscribe on unmount", async () => {
    const unsubscribeFn = jest.fn();
    api.subscribeToMessages.mockResolvedValue(unsubscribeFn);

    const { unmount } = renderWithProviders(<App />);
    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalled();
    });

    unmount();

    // Allow the cleanup to run
    await waitFor(() => {
      expect(unsubscribeFn).toHaveBeenCalled();
    });
  });

  test("dispatches appendMessage when LiveQuery delivers a message", async () => {
    let liveQueryCallback = null;
    api.subscribeToMessages.mockImplementation((projectId, cb) => {
      liveQueryCallback = cb;
      return Promise.resolve(jest.fn());
    });

    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: { objectId: "test-board-id" }, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        conversations: {
          "pm-1": { messages: [], loaded: true },
          all: { messages: [], loaded: false },
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

    renderWithProviders(<App />, { store });

    await waitFor(() => {
      expect(liveQueryCallback).toBeTruthy();
    });

    // Simulate a LiveQuery message arriving
    const incomingMsg = {
      id: "live-1",
      from: "pm-1",
      to: "owner",
      message: "Live message!",
      createdAt: "2026-02-09T00:00:00Z",
      broadcast: false,
      broadcastId: null,
    };

    // Use act to wrap the state update from LiveQuery callback
    const { act } = await import("@testing-library/react");
    await act(async () => {
      liveQueryCallback(incomingMsg);
    });

    // The message should appear in the pm-1 conversation in the store
    const state = store.getState();
    expect(state.messages.conversations["pm-1"].messages).toContainEqual(incomingMsg);
  });
});

// ─── ChatView — Lazy Loading ────────────────────────────────────────────────

describe("ChatView — lazy loading", () => {
  function buildConversations(agentOverrides = {}) {
    const convos = { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } };
    for (const [agent, override] of Object.entries(agentOverrides)) {
      const defaults = { messages: [], loaded: false, hasMore: true, loadingMore: false };
      convos[agent] = { ...defaults, ...override };
    }
    return convos;
  }

  function buildMessagesState(overrides = {}) {
    return {
      conversations: buildConversations(overrides.conversations),
      unreadCounts: { all: 0 },
      selectedAgent: overrides.selectedAgent || "developer-1",
      sending: false,
      error: null,
      messages: [],
      polling: false,
      lastPoll: null,
    };
  }

  test("shows 'Load older messages' button when hasMore=true", async () => {
    api.subscribeToMessages.mockResolvedValue(jest.fn());
    api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: buildMessagesState({
        selectedAgent: "developer-1",
        conversations: {
          "developer-1": {
            messages: [{ from: "owner", to: "developer-1", message: "Msg", createdAt: "2026-02-09T10:00:00Z" }],
            loaded: true,
            hasMore: true,
            loadingMore: false,
          },
        },
      }),
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    renderWithProviders(<MessagesView />, { store });
    await waitFor(() => expect(screen.getByText("All Agents")).toBeInTheDocument());

    expect(screen.getByText("Load older messages")).toBeInTheDocument();
  });

  test("hides 'Load older messages' button when hasMore=false", async () => {
    api.subscribeToMessages.mockResolvedValue(jest.fn());
    api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: buildMessagesState({
        selectedAgent: "developer-1",
        conversations: {
          "developer-1": {
            messages: [{ from: "owner", to: "developer-1", message: "Msg", createdAt: "2026-02-09T10:00:00Z" }],
            loaded: true,
            hasMore: false,
            loadingMore: false,
          },
        },
      }),
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    renderWithProviders(<MessagesView />, { store });
    await waitFor(() => expect(screen.getByText("All Agents")).toBeInTheDocument());

    expect(screen.queryByText("Load older messages")).not.toBeInTheDocument();
  });

  test("shows 'Loading...' text when loadingMore=true", async () => {
    api.subscribeToMessages.mockResolvedValue(jest.fn());
    api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: buildMessagesState({
        selectedAgent: "developer-1",
        conversations: {
          "developer-1": {
            messages: [{ from: "owner", to: "developer-1", message: "Msg", createdAt: "2026-02-09T10:00:00Z" }],
            loaded: true,
            hasMore: true,
            loadingMore: true,
          },
        },
      }),
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    renderWithProviders(<MessagesView />, { store });
    await waitFor(() => expect(screen.getByText("All Agents")).toBeInTheDocument());

    const loadingBtn = screen.getByText("Loading...");
    expect(loadingBtn).toBeInTheDocument();
    expect(loadingBtn.closest("button")).toBeDisabled();
  });

  test("shows empty state when no messages", async () => {
    api.subscribeToMessages.mockResolvedValue(jest.fn());
    api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
    const store = createTestStore({
      agents: DEFAULT_AGENTS_STATE,
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: buildMessagesState({
        selectedAgent: "developer-1",
        conversations: {
          "developer-1": {
            messages: [],
            loaded: true,
            hasMore: false,
            loadingMore: false,
          },
        },
      }),
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    renderWithProviders(<MessagesView />, { store });
    await waitFor(() => expect(screen.getByText("All Agents")).toBeInTheDocument());

    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });
});

// ─── ProjectSelector Component ───────────────────────────────────────────────

describe("ProjectSelector", () => {
  test("renders Add project button", () => {
    renderWithProviders(<ProjectSelector />);
    expect(screen.getByTitle("Add project")).toBeInTheDocument();
  });

  test("fetches recent projects on mount", async () => {
    renderWithProviders(<ProjectSelector />);
    await waitFor(() => {
      expect(api.getRecentProjects).toHaveBeenCalled();
    });
  });

  test("shows 'No projects' when projects list is empty", () => {
    renderWithProviders(<ProjectSelector />);
    // The "No projects" MenuItem is rendered inside the select
    expect(screen.getByText("No projects")).toBeInTheDocument();
  });

  test("opens Add Project dialog on button click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectSelector />);

    await user.click(screen.getByTitle("Add project"));

    expect(screen.getByText("Add Project")).toBeInTheDocument();
    expect(screen.getByLabelText(/project path/i)).toBeInTheDocument();
  });

  test("Add button in dialog is disabled when path is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectSelector />);

    await user.click(screen.getByTitle("Add project"));

    const addBtn = screen.getByRole("button", { name: /^add$/i });
    expect(addBtn).toBeDisabled();
  });

  test("renders project names when projects exist", () => {
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [
          { path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" },
          { path: "/proj/beta", name: "beta", lastOpened: "2026-01-01" },
        ],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectSelector />, { store });
    // Active project name should be visible in the selector display
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  test("does not render a Delete project button (delete moved to ProjectsView)", () => {
    renderWithProviders(<ProjectSelector />);
    expect(screen.queryByTitle("Delete project")).not.toBeInTheDocument();
  });
});

// ─── ProjectsView Component ─────────────────────────────────────────────────

describe("ProjectsView", () => {
  test("shows empty state when no projects exist", () => {
    renderWithProviders(<ProjectsView />);
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
  });

  test("renders Projects heading and Add Project button", () => {
    renderWithProviders(<ProjectsView />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add project/i })).toBeInTheDocument();
  });

  test("renders project list with names and paths", () => {
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [
          { path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" },
          { path: "/proj/beta", name: "beta", lastOpened: "2026-01-01" },
        ],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("/proj/alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("/proj/beta")).toBeInTheDocument();
  });

  test("active project list item has selected styling", () => {
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [
          { path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" },
          { path: "/proj/beta", name: "beta", lastOpened: "2026-01-01" },
        ],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });
    // The active project's ListItem should exist and be distinguishable
    const activeItem = screen.getByText("alpha").closest("li");
    const inactiveItem = screen.getByText("beta").closest("li");
    expect(activeItem).toBeInTheDocument();
    expect(inactiveItem).toBeInTheDocument();
    // Active item has different class than inactive (MUI applies bgcolor via className)
    expect(activeItem.className).not.toBe(inactiveItem.className);
  });

  test("renders a delete button for each project", () => {
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [
          { path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" },
          { path: "/proj/beta", name: "beta", lastOpened: "2026-01-01" },
        ],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });
    const deleteButtons = screen.getAllByTitle("Delete project");
    expect(deleteButtons).toHaveLength(2);
  });

  test("clicking delete button opens confirmation dialog for that project", async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [
          { path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" },
          { path: "/proj/beta", name: "beta", lastOpened: "2026-01-01" },
        ],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    const deleteButtons = screen.getAllByTitle("Delete project");
    // Click delete on the second project (beta)
    await user.click(deleteButtons[1]);

    expect(screen.getByText("Delete Project")).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
  });

  test("cancel closes the delete dialog", async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [{ path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" }],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    await user.click(screen.getByTitle("Delete project"));
    expect(screen.getByText("Delete Project")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText(/are you sure you want to delete/i)).not.toBeInTheDocument();
    });
  });

  test("confirming delete calls deleteProject API", async () => {
    const user = userEvent.setup();
    api.deleteProject.mockResolvedValue({ success: true });
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [{ path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" }],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    await user.click(screen.getByTitle("Delete project"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(api.deleteProject).toHaveBeenCalledWith("/proj/alpha");
    });
  });

  test("opens Add Project dialog on button click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsView />);

    await user.click(screen.getByRole("button", { name: /add project/i }));

    expect(screen.getByLabelText(/project path/i)).toBeInTheDocument();
    // Dialog should contain the Add button inside DialogActions
    expect(screen.getByRole("button", { name: /^add$/i })).toBeInTheDocument();
  });

  test("delete button shows spinner and 'Deleting...' text while deletion is in progress", async () => {
    const user = userEvent.setup();
    // Use a promise that we control to simulate a slow delete
    let resolveDelete;
    api.deleteProject.mockImplementation(() => new Promise((resolve) => { resolveDelete = resolve; }));
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [{ path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" }],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    // Open delete dialog and click Delete
    await user.click(screen.getByTitle("Delete project"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    // While deleting: button should show "Deleting..." and a spinner
    await waitFor(() => {
      expect(screen.getByText("Deleting...")).toBeInTheDocument();
    });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Both buttons (Cancel and Delete) should be disabled during deletion
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    const deleteBtn = screen.getByText("Deleting...").closest("button");
    expect(cancelBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();

    // Resolve the delete to clean up
    const { act } = await import("@testing-library/react");
    await act(async () => { resolveDelete({ success: true }); });
  });

  test("shows error Alert banner when delete fails", async () => {
    const user = userEvent.setup();
    api.deleteProject.mockRejectedValue(new Error("Server error: delete failed"));
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [{ path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" }],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    // Open delete dialog and click Delete
    await user.click(screen.getByTitle("Delete project"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    // Wait for the thunk rejection to propagate to the store and re-render
    await waitFor(() => {
      expect(store.getState().projects.error).toBeTruthy();
    });

    // The error Alert renders in the main Box (aria-hidden while Dialog is open),
    // so we query by text content instead of role
    await waitFor(() => {
      expect(screen.getByText("Server error: delete failed")).toBeInTheDocument();
    });
  });

  test("error Alert banner can be dismissed with close button", async () => {
    const user = userEvent.setup();
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [{ path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" }],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: "Previous error message",
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    // Alert should be visible (no Dialog open so aria-hidden is not set)
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Previous error message")).toBeInTheDocument();

    // Close the alert via its close button
    const closeBtn = screen.getByRole("alert").querySelector("button");
    await user.click(closeBtn);

    // Error should be cleared in store
    await waitFor(() => {
      expect(store.getState().projects.error).toBeNull();
    });
  });

  test("dialog stays open when delete fails (so user can retry)", async () => {
    const user = userEvent.setup();
    api.deleteProject.mockRejectedValue(new Error("Network failure"));
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [{ path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" }],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    // Open delete dialog and trigger failed delete
    await user.click(screen.getByTitle("Delete project"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    // Wait for the error to be set
    await waitFor(() => {
      expect(store.getState().projects.error).toBeTruthy();
    });

    // Dialog should still be open (title still visible)
    expect(screen.getByText("Delete Project")).toBeInTheDocument();
    // Delete button should be re-enabled (not in deleting state anymore)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^delete$/i })).toBeEnabled();
    });
  });

  test("dialog closes after successful delete", async () => {
    const user = userEvent.setup();
    api.deleteProject.mockResolvedValue({ success: true });
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [{ path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" }],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    // Open delete dialog and confirm
    await user.click(screen.getByTitle("Delete project"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    // Dialog should close after successful delete
    await waitFor(() => {
      expect(screen.queryByText("Delete Project")).not.toBeInTheDocument();
    });
  });

  test("clicking a project sets it as active", async () => {
    const user = userEvent.setup();
    api.addRecentProject.mockResolvedValue({ success: true });
    const store = createTestStore({
      project: { project: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [
          { path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" },
          { path: "/proj/beta", name: "beta", lastOpened: "2026-01-01" },
        ],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectsView />, { store });

    await user.click(screen.getByText("beta"));

    await waitFor(() => {
      const active = store.getState().projects.activeProject;
      expect(active.path).toBe("/proj/beta");
      expect(active.name).toBe("beta");
    });
  });
});

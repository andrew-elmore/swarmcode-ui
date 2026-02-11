/**
 * CARD-055 QA Tests — selectAgent ensureConvo fix for initial message load.
 *
 * Bug: selectAgent did NOT create a conversation slot, so ChatView's guard
 * `selectedAgent && convo && !convo.loaded` short-circuited (convo undefined),
 * and loadConversation never dispatched on page refresh.
 *
 * Fix: Added ensureConvo(state, action.payload) to selectAgent reducer (line 84).
 *
 * Verifies:
 * 1. selectAgent creates a conversation slot if none exists
 * 2. selectAgent is idempotent (doesn't destroy existing conversation)
 * 3. ChatView dispatches loadConversation when agent is selected (convo.loaded=false)
 * 4. Switching agents creates separate conversation slots
 * 5. LiveQuery appendMessage still works after fix
 * 6. Unread counts still work
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer, {
  selectAgent,
  appendMessage,
} from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
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
      agents: overrides.agents || { agents: DEFAULT_AGENTS, loading: false, error: null },
      board: overrides.board || {
        board: { projectHash: "test-hash-055" },
        cards: [],
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
      messages: overrides.messages || {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        error: null,
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
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getAgents.mockResolvedValue({ agents: DEFAULT_AGENTS });
  api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
});

afterEach(() => jest.restoreAllMocks());

// ─── Redux Slice: selectAgent creates conversation slot ─────────────────────

describe("CARD-055: selectAgent creates conversation slot via ensureConvo", () => {
  test("selectAgent creates empty conversation when no slot exists", () => {
    const store = createTestStore();

    // Before: no conversation for pm-1
    expect(store.getState().messages.conversations["pm-1"]).toBeUndefined();

    store.dispatch(selectAgent("pm-1"));

    // After: conversation slot created with loaded=false
    const convo = store.getState().messages.conversations["pm-1"];
    expect(convo).toBeDefined();
    expect(convo.messages).toEqual([]);
    expect(convo.loaded).toBe(false);
    expect(convo.hasMore).toBe(true);
    expect(convo.loadingMore).toBe(false);
  });

  test("selectAgent is idempotent — does not destroy existing messages", () => {
    const existingMessages = [
      { id: "m1", from: "pm-1", to: "owner", message: "Hello", createdAt: "2026-02-10T10:00:00Z" },
      { id: "m2", from: "owner", to: "pm-1", message: "Hi back", createdAt: "2026-02-10T10:01:00Z" },
    ];

    const store = createTestStore({
      messages: {
        conversations: {
          all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
          "pm-1": { messages: existingMessages, loaded: true, hasMore: false, loadingMore: false },
        },
        unreadCounts: { all: 0, "pm-1": 0 },
        selectedAgent: null,
        sending: false,
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
      },
    });

    store.dispatch(selectAgent("pm-1"));

    // Existing messages should be preserved
    const convo = store.getState().messages.conversations["pm-1"];
    expect(convo.messages).toHaveLength(2);
    expect(convo.messages[0].id).toBe("m1");
    expect(convo.loaded).toBe(true);
  });

  test("selectAgent sets selectedAgent in state", () => {
    const store = createTestStore();
    store.dispatch(selectAgent("developer-1"));

    expect(store.getState().messages.selectedAgent).toBe("developer-1");
  });

  test("selectAgent resets unread count for selected agent", () => {
    const store = createTestStore({
      messages: {
        conversations: {
          all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
          "pm-1": { messages: [], loaded: false, hasMore: true, loadingMore: false },
        },
        unreadCounts: { all: 0, "pm-1": 5 },
        selectedAgent: null,
        sending: false,
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
      },
    });

    store.dispatch(selectAgent("pm-1"));
    expect(store.getState().messages.unreadCounts["pm-1"]).toBe(0);
  });

  test("selectAgent initializes unreadCounts entry if not present", () => {
    const store = createTestStore();

    // Before: no unread entry for developer-1
    expect(store.getState().messages.unreadCounts["developer-1"]).toBeUndefined();

    store.dispatch(selectAgent("developer-1"));

    // After: unread count initialized to 0
    expect(store.getState().messages.unreadCounts["developer-1"]).toBe(0);
  });
});

// ─── Switching agents creates separate slots ────────────────────────────────

describe("CARD-055: Switching between agents creates separate conversation slots", () => {
  test("selecting multiple agents creates individual conversation slots", () => {
    const store = createTestStore();

    store.dispatch(selectAgent("pm-1"));
    store.dispatch(selectAgent("developer-1"));

    expect(store.getState().messages.conversations["pm-1"]).toBeDefined();
    expect(store.getState().messages.conversations["developer-1"]).toBeDefined();
    expect(store.getState().messages.selectedAgent).toBe("developer-1");
  });

  test("switching back to previously selected agent preserves its state", () => {
    const store = createTestStore();

    // Select pm-1
    store.dispatch(selectAgent("pm-1"));

    // Simulate a message arriving for pm-1
    store.dispatch(appendMessage({
      id: "m1",
      from: "pm-1",
      to: "owner",
      message: "Hello from PM",
      createdAt: "2026-02-10T10:00:00Z",
    }));

    // Switch to developer-1
    store.dispatch(selectAgent("developer-1"));

    // Switch back to pm-1
    store.dispatch(selectAgent("pm-1"));

    // pm-1 conversation should still have the message
    const convo = store.getState().messages.conversations["pm-1"];
    expect(convo.messages).toHaveLength(1);
    expect(convo.messages[0].message).toBe("Hello from PM");
  });
});

// ─── LiveQuery appendMessage still works after fix ──────────────────────────

describe("CARD-055: LiveQuery appendMessage still functions correctly", () => {
  test("appendMessage creates conversation slot if needed and adds message", () => {
    const store = createTestStore();

    // No slot for qa-1 yet
    expect(store.getState().messages.conversations["qa-1"]).toBeUndefined();

    store.dispatch(appendMessage({
      id: "m1",
      from: "qa-1",
      to: "owner",
      message: "Test results ready",
      createdAt: "2026-02-10T12:00:00Z",
    }));

    const convo = store.getState().messages.conversations["qa-1"];
    expect(convo).toBeDefined();
    expect(convo.messages).toHaveLength(1);
    expect(convo.messages[0].message).toBe("Test results ready");
  });

  test("appendMessage increments unread count for non-selected agents", () => {
    const store = createTestStore();
    store.dispatch(selectAgent("pm-1"));

    store.dispatch(appendMessage({
      id: "m1",
      from: "developer-1",
      to: "owner",
      message: "PR ready",
      createdAt: "2026-02-10T12:00:00Z",
    }));

    // developer-1 is not selected, so unread should increment
    expect(store.getState().messages.unreadCounts["developer-1"]).toBe(1);
  });

  test("appendMessage does NOT increment unread for selected agent", () => {
    const store = createTestStore();
    store.dispatch(selectAgent("pm-1"));

    store.dispatch(appendMessage({
      id: "m1",
      from: "pm-1",
      to: "owner",
      message: "Status update",
      createdAt: "2026-02-10T12:00:00Z",
    }));

    // pm-1 IS selected, so unread should stay 0
    expect(store.getState().messages.unreadCounts["pm-1"]).toBe(0);
  });

  test("appendMessage deduplicates messages by id", () => {
    const store = createTestStore();
    store.dispatch(selectAgent("pm-1"));

    const msg = {
      id: "m1",
      from: "pm-1",
      to: "owner",
      message: "Hello",
      createdAt: "2026-02-10T12:00:00Z",
    };

    store.dispatch(appendMessage(msg));
    store.dispatch(appendMessage(msg));

    expect(store.getState().messages.conversations["pm-1"].messages).toHaveLength(1);
  });
});

// ─── Integration: MessagesView triggers loadConversation ────────────────────

describe("CARD-055: MessagesView triggers loadConversation on agent select", () => {
  test("selecting agent with empty (unloaded) convo triggers getConversation API call", async () => {
    api.getConversation.mockResolvedValue({
      messages: [
        { id: "m1", from: "pm-1", to: "owner", message: "Historical msg", createdAt: "2026-02-10T09:00:00Z" },
      ],
      hasMore: false,
    });

    const store = createTestStore();
    // Pre-select an agent so ChatView renders with a conversation
    store.dispatch(selectAgent("pm-1"));

    renderWithProviders(<MessagesView />, { store });

    // CARD-092: LiveQuery subscription moved to App.jsx; MessagesView no longer subscribes.
    // loadConversation should have been called for pm-1
    await waitFor(() => {
      expect(api.getConversation).toHaveBeenCalledWith(
        "test-hash-055",
        "owner",
        "pm-1",
        expect.objectContaining({ limit: 30 })
      );
    });

    // After loading, conversation should be marked as loaded
    await waitFor(() => {
      expect(store.getState().messages.conversations["pm-1"].loaded).toBe(true);
    });
  });

  test("selecting agent with already-loaded convo renders existing messages", async () => {
    const store = createTestStore({
      messages: {
        conversations: {
          all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
          "pm-1": {
            messages: [{ id: "m1", from: "pm-1", to: "owner", message: "Existing", createdAt: "2026-02-10T09:00:00Z" }],
            loaded: true,
            hasMore: false,
            loadingMore: false,
          },
        },
        unreadCounts: { all: 0, "pm-1": 0 },
        selectedAgent: "pm-1",
        sending: false,
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
      },
    });

    renderWithProviders(<MessagesView />, { store });

    // CARD-092: LiveQuery subscription moved to App.jsx; MessagesView no longer subscribes.
    // Existing message should be displayed
    expect(screen.getByText("Existing")).toBeInTheDocument();

    // Conversation should remain loaded
    expect(store.getState().messages.conversations["pm-1"].loaded).toBe(true);
  });
});

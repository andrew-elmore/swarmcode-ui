/**
 * QA Tests for CARD-196: Scope messages to project (UI side)
 *
 * Verifies that the UI properly scopes messages to the active project:
 * - messagesSlice thunks pass projectHash from board state
 * - resetConversations clears all project-specific state
 * - appendMessage (LiveQuery) handles messages correctly
 * - loadConversation / sendMessage / loadMoreMessages use correct projectHash
 * - Project switching triggers resetConversations
 */

import { configureStore } from "@reduxjs/toolkit";
import * as api from "../src/services/api";
import boardReducer from "../src/store/boardSlice";
import messagesReducer, {
  sendMessage,
  loadConversation,
  loadMoreMessages,
  refreshConversation,
  selectAgent,
  appendMessage,
  resetConversations,
  refreshLiveQuery,
} from "../src/store/messagesSlice";

jest.mock("../src/services/api", () => ({
  getOrCreateBoard: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
}));

const PROJECT_HASH_A = "proj-hash-aaa";
const PROJECT_HASH_B = "proj-hash-bbb";

function createTestStore(projectHash = PROJECT_HASH_A, messagesState) {
  const boardState = {
    board: { projectHash },
    cards: [],
    selectedCard: null,
    loading: false,
    error: null,
    lastPoll: null,
  };
  return configureStore({
    reducer: { board: boardReducer, messages: messagesReducer },
    preloadedState: messagesState
      ? {
          board: boardState,
          messages: { ...messagesReducer(undefined, { type: "@@INIT" }), ...messagesState },
        }
      : { board: boardState },
  });
}

afterEach(() => jest.restoreAllMocks());

// ─── projectHash is passed to API calls ──────────────────────────────────────

describe("CARD-196: thunks pass projectHash from board state", () => {
  test("loadConversation passes projectHash to api.getConversation", async () => {
    api.getConversation.mockResolvedValue({ messages: [], hasMore: false });

    const store = createTestStore(PROJECT_HASH_A);
    await store.dispatch(loadConversation("developer-1"));

    expect(api.getConversation).toHaveBeenCalledWith(
      PROJECT_HASH_A,
      "owner",
      "developer-1",
      { limit: 30 }
    );
  });

  test("loadConversation uses different projectHash when board changes", async () => {
    api.getConversation.mockResolvedValue({ messages: [], hasMore: false });

    const store = createTestStore(PROJECT_HASH_B);
    await store.dispatch(loadConversation("qa-1"));

    expect(api.getConversation).toHaveBeenCalledWith(
      PROJECT_HASH_B,
      "owner",
      "qa-1",
      { limit: 30 }
    );
  });

  test("sendMessage passes projectHash to api.sendMessage", async () => {
    api.sendMessage.mockResolvedValue({ success: true, messageId: "m1" });

    const store = createTestStore(PROJECT_HASH_A);
    await store.dispatch(sendMessage({ to: "developer-1", message: "Test msg" }));

    expect(api.sendMessage).toHaveBeenCalledWith({
      projectHash: PROJECT_HASH_A,
      from: "owner",
      to: "developer-1",
      message: "Test msg",
    });
  });

  test("refreshConversation passes projectHash to api.getConversation", async () => {
    api.getConversation.mockResolvedValue({ messages: [], hasMore: false });

    const store = createTestStore(PROJECT_HASH_A);
    await store.dispatch(refreshConversation("developer-1"));

    expect(api.getConversation).toHaveBeenCalledWith(
      PROJECT_HASH_A,
      "owner",
      "developer-1",
      { limit: 30 }
    );
  });

  test("loadMoreMessages passes projectHash and before cursor", async () => {
    const existingMsgs = [
      { from: "developer-1", to: "owner", message: "Oldest", createdAt: "2026-02-23T09:00:00Z" },
      { from: "owner", to: "developer-1", message: "Newest", createdAt: "2026-02-23T10:00:00Z" },
    ];
    api.getConversation.mockResolvedValueOnce({ messages: existingMsgs, hasMore: true });

    const store = createTestStore(PROJECT_HASH_A);
    await store.dispatch(loadConversation("developer-1"));

    api.getConversation.mockResolvedValueOnce({ messages: [], hasMore: false });
    await store.dispatch(loadMoreMessages("developer-1"));

    expect(api.getConversation).toHaveBeenLastCalledWith(
      PROJECT_HASH_A,
      "owner",
      "developer-1",
      { before: "2026-02-23T09:00:00Z" }
    );
  });
});

// ─── resetConversations — project switch behavior ───────────────────────────

describe("CARD-196: resetConversations clears project-specific state", () => {
  test("resets conversations to initial state with only 'all' channel", () => {
    const store = createTestStore(PROJECT_HASH_A, {
      conversations: {
        all: { messages: [{ message: "broadcast" }], loaded: true, hasMore: false, loadingMore: false },
        "developer-1": { messages: [{ message: "hello dev" }], loaded: true, hasMore: true, loadingMore: false },
        "qa-1": { messages: [{ message: "hello qa" }], loaded: true, hasMore: false, loadingMore: false },
      },
      unreadCounts: { all: 2, "developer-1": 5, "qa-1": 1 },
      selectedAgent: "developer-1",
      error: "some error",
    });

    store.dispatch(resetConversations());
    const state = store.getState().messages;

    expect(Object.keys(state.conversations)).toEqual(["all"]);
    expect(state.conversations.all.messages).toEqual([]);
    expect(state.conversations.all.hasMore).toBe(false);
    expect(state.unreadCounts).toEqual({ all: 0 });
    expect(state.selectedAgent).toBeNull();
    expect(state.error).toBeNull();
  });

  test("preserves sending and refreshing flags during reset", () => {
    const store = createTestStore(PROJECT_HASH_A, {
      conversations: {
        all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
        "developer-1": { messages: [{ message: "msg" }], loaded: true, hasMore: false, loadingMore: false },
      },
      unreadCounts: { all: 0, "developer-1": 3 },
      selectedAgent: "developer-1",
      sending: false,
      refreshing: false,
      error: "old error",
    });

    store.dispatch(resetConversations());
    const state = store.getState().messages;

    // These should not be touched by resetConversations
    expect(state.sending).toBe(false);
    expect(state.refreshing).toBe(false);
    expect(state.mobileDrawerOpen).toBe(false);
  });

  test("after reset, selecting a new agent creates fresh conversation", () => {
    const store = createTestStore(PROJECT_HASH_A, {
      conversations: {
        all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
        "developer-1": { messages: [{ message: "stale" }], loaded: true, hasMore: false, loadingMore: false },
      },
      unreadCounts: { all: 0, "developer-1": 1 },
      selectedAgent: "developer-1",
      error: null,
    });

    // Reset (simulates project switch)
    store.dispatch(resetConversations());

    // Select an agent after reset
    store.dispatch(selectAgent("qa-1"));
    const state = store.getState().messages;

    expect(state.selectedAgent).toBe("qa-1");
    expect(state.conversations["qa-1"]).toBeDefined();
    expect(state.conversations["qa-1"].messages).toEqual([]);
    expect(state.conversations["qa-1"].loaded).toBe(false);

    // Old agent data should be gone
    expect(state.conversations["developer-1"]).toBeUndefined();
  });
});

// ─── appendMessage — LiveQuery message handling ─────────────────────────────

describe("CARD-196: appendMessage handles project-scoped messages", () => {
  test("appends incoming message to correct agent conversation", () => {
    const store = createTestStore(PROJECT_HASH_A);
    store.dispatch(selectAgent("developer-1"));

    store.dispatch(appendMessage({
      id: "msg-1",
      from: "developer-1",
      to: "owner",
      message: "Hello from dev",
      createdAt: "2026-02-23T10:00:00Z",
      broadcast: false,
    }));

    const convo = store.getState().messages.conversations["developer-1"];
    expect(convo.messages).toHaveLength(1);
    expect(convo.messages[0].message).toBe("Hello from dev");
  });

  test("does not add duplicate messages (by id)", () => {
    const store = createTestStore(PROJECT_HASH_A);
    store.dispatch(selectAgent("developer-1"));

    const msg = {
      id: "msg-dupe-1",
      from: "developer-1",
      to: "owner",
      message: "Duplicate check",
      createdAt: "2026-02-23T10:00:00Z",
      broadcast: false,
    };

    store.dispatch(appendMessage(msg));
    store.dispatch(appendMessage(msg));

    const convo = store.getState().messages.conversations["developer-1"];
    expect(convo.messages).toHaveLength(1);
  });

  test("broadcast message goes to 'all' channel AND agent conversation", () => {
    const store = createTestStore(PROJECT_HASH_A);

    store.dispatch(appendMessage({
      id: "bcast-1",
      from: "owner",
      to: "developer-1",
      message: "Broadcast to dev",
      createdAt: "2026-02-23T10:00:00Z",
      broadcast: true,
      broadcastId: "bcast_123",
    }));

    const allConvo = store.getState().messages.conversations["all"];
    const devConvo = store.getState().messages.conversations["developer-1"];

    expect(allConvo.messages).toHaveLength(1);
    expect(devConvo.messages).toHaveLength(1);
  });

  test("incoming message from non-selected agent increments unread count", () => {
    const store = createTestStore(PROJECT_HASH_A);
    store.dispatch(selectAgent("qa-1")); // qa-1 is selected

    // Message arrives from developer-1 (not selected)
    store.dispatch(appendMessage({
      id: "unread-1",
      from: "developer-1",
      to: "owner",
      message: "Unread message",
      createdAt: "2026-02-23T10:00:00Z",
      broadcast: false,
    }));

    const state = store.getState().messages;
    expect(state.unreadCounts["developer-1"]).toBe(1);
  });
});

// ─── refreshLiveQuery — triggers re-subscription ────────────────────────────

describe("CARD-196: refreshLiveQuery flag", () => {
  test("toggling refreshLiveQuery flips the flag (used by App.jsx dependency array)", () => {
    const store = createTestStore(PROJECT_HASH_A);
    const initial = store.getState().messages.liveQueryRefreshFlag;

    store.dispatch(refreshLiveQuery());
    expect(store.getState().messages.liveQueryRefreshFlag).toBe(!initial);

    store.dispatch(refreshLiveQuery());
    expect(store.getState().messages.liveQueryRefreshFlag).toBe(initial);
  });
});

// ─── loadConversation for 'all' channel skips API ───────────────────────────

describe("CARD-196: broadcast channel does not call API", () => {
  test("loadConversation('all') does not call getConversation", async () => {
    api.getConversation.mockClear();
    const store = createTestStore(PROJECT_HASH_A);
    await store.dispatch(loadConversation("all"));

    expect(api.getConversation).not.toHaveBeenCalled();
    const allConvo = store.getState().messages.conversations["all"];
    expect(allConvo.messages).toEqual([]);
    expect(allConvo.hasMore).toBe(false);
  });
});

/**
 * Tests for store/messagesSlice.js — Redux slice for messaging state.
 * API calls are mocked at the services/api module level.
 */

import { configureStore } from "@reduxjs/toolkit";
import * as api from "../src/services/api";
import messagesReducer, { sendMessage, pollMessages, loadConversation, loadMoreMessages, selectAgent, clearError, clearMessages } from "../src/store/messagesSlice";

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
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
}));

function createTestStore(preloadedState) {
  return configureStore({
    reducer: { messages: messagesReducer },
    preloadedState: preloadedState
      ? { messages: { ...messagesReducer(undefined, { type: "@@INIT" }), ...preloadedState } }
      : undefined,
  });
}

afterEach(() => jest.restoreAllMocks());

// ─── Initial State ───────────────────────────────────────────────────────────

describe("messagesSlice initial state", () => {
  test("has correct default values", () => {
    const store = createTestStore();
    const state = store.getState().messages;
    expect(state.messages).toEqual([]);
    expect(state.sending).toBe(false);
    expect(state.polling).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastPoll).toBeNull();
  });

  test("has per-agent conversation state with lazy loading fields", () => {
    const store = createTestStore();
    const state = store.getState().messages;
    expect(state.conversations).toBeDefined();
    const agents = ["pm-1", "senior-dev-1", "developer-1", "qa-1", "devops-1"];
    for (const agent of agents) {
      const convo = state.conversations[agent];
      expect(convo.messages).toEqual([]);
      expect(convo.loaded).toBe(false);
      expect(convo.hasMore).toBe(true);
      expect(convo.loadingMore).toBe(false);
    }
  });

  test("broadcast 'all' channel has hasMore=false by default", () => {
    const store = createTestStore();
    const allConvo = store.getState().messages.conversations["all"];
    expect(allConvo.hasMore).toBe(false);
    expect(allConvo.loadingMore).toBe(false);
  });
});

// ─── Synchronous Reducers ────────────────────────────────────────────────────

describe("messagesSlice reducers", () => {
  test("clearError resets error to null", () => {
    const store = createTestStore({ error: "Send failed" });
    store.dispatch(clearError());
    expect(store.getState().messages.error).toBeNull();
  });

  test("clearMessages empties the messages array", () => {
    const store = createTestStore({
      messages: [{ from: "pm-1", to: "qa-1", subject: "Hi", message: "Hello" }],
    });
    store.dispatch(clearMessages());
    expect(store.getState().messages.messages).toEqual([]);
  });
});

// ─── sendMessage ─────────────────────────────────────────────────────────────

describe("sendMessage thunk", () => {
  test("sets sending=true on pending, sending=false on fulfilled", async () => {
    api.sendMessage.mockResolvedValue({ success: true, messageId: "m1" });

    const store = createTestStore();
    await store.dispatch(sendMessage({
      from: "qa-1", to: "developer-1", subject: "Test", message: "Body",
    }));

    const state = store.getState().messages;
    expect(state.sending).toBe(false);
    expect(state.error).toBeNull();
  });

  test("sets error on rejected", async () => {
    api.sendMessage.mockRejectedValue(new Error("Cannot send a message to yourself"));

    const store = createTestStore();
    await store.dispatch(sendMessage({
      from: "qa-1", to: "qa-1", subject: "Test", message: "Body",
    }));

    expect(store.getState().messages.sending).toBe(false);
    expect(store.getState().messages.error).toBe("Cannot send a message to yourself");
  });
});

// ─── pollMessages ────────────────────────────────────────────────────────────

describe("pollMessages thunk", () => {
  test("appends new messages to existing array on fulfilled", async () => {
    const newMsgs = [
      { from: "pm-1", to: "qa-1", subject: "New", message: "New msg" },
    ];
    api.pollMessages.mockResolvedValue({ messages: newMsgs });

    const store = createTestStore({
      messages: [{ from: "dev-1", to: "qa-1", subject: "Old", message: "Old msg" }],
    });
    await store.dispatch(pollMessages());

    const msgs = store.getState().messages.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toEqual(newMsgs[0]);
    expect(store.getState().messages.lastPoll).toBeDefined();
  });

  test("does not duplicate when poll returns empty", async () => {
    api.pollMessages.mockResolvedValue({ messages: [] });

    const store = createTestStore({
      messages: [{ from: "pm-1", to: "qa-1", subject: "Existing", message: "Msg" }],
    });
    await store.dispatch(pollMessages());

    expect(store.getState().messages.messages).toHaveLength(1);
  });

  test("sets error on rejected", async () => {
    api.pollMessages.mockRejectedValue(new Error("Network timeout"));

    const store = createTestStore();
    await store.dispatch(pollMessages());

    expect(store.getState().messages.polling).toBe(false);
    expect(store.getState().messages.error).toBe("Network timeout");
  });
});

// ─── loadConversation ───────────────────────────────────────────────────────

describe("loadConversation thunk", () => {
  test("loads messages and sets loaded=true on fulfilled", async () => {
    const msgs = [
      { from: "owner", to: "developer-1", message: "Hello", createdAt: "2026-02-09T10:00:00Z" },
      { from: "developer-1", to: "owner", message: "Hi back", createdAt: "2026-02-09T10:01:00Z" },
    ];
    api.getConversation.mockResolvedValue({ messages: msgs, hasMore: false });

    const store = createTestStore();
    await store.dispatch(loadConversation("developer-1"));

    const convo = store.getState().messages.conversations["developer-1"];
    expect(convo.messages).toEqual(msgs);
    expect(convo.loaded).toBe(true);
    expect(convo.hasMore).toBe(false);
  });

  test("sets hasMore=true when more messages exist", async () => {
    const msgs = Array.from({ length: 30 }, (_, i) => ({
      from: "owner", to: "qa-1", message: `Msg ${i}`, createdAt: `2026-02-09T10:${String(i).padStart(2, "0")}:00Z`,
    }));
    api.getConversation.mockResolvedValue({ messages: msgs, hasMore: true });

    const store = createTestStore();
    await store.dispatch(loadConversation("qa-1"));

    const convo = store.getState().messages.conversations["qa-1"];
    expect(convo.messages).toHaveLength(30);
    expect(convo.hasMore).toBe(true);
    expect(convo.loaded).toBe(true);
  });

  test("returns empty messages for broadcast 'all' channel", async () => {
    api.getConversation.mockClear();
    const store = createTestStore();
    await store.dispatch(loadConversation("all"));

    const allConvo = store.getState().messages.conversations["all"];
    expect(allConvo.messages).toEqual([]);
    expect(allConvo.hasMore).toBe(false);
    // getConversation should NOT be called for broadcast
    expect(api.getConversation).not.toHaveBeenCalled();
  });

  test("sets error on rejected", async () => {
    api.getConversation.mockRejectedValue(new Error("Server error"));

    const store = createTestStore();
    await store.dispatch(loadConversation("developer-1"));

    expect(store.getState().messages.error).toBe("Server error");
  });
});

// ─── loadMoreMessages ───────────────────────────────────────────────────────

describe("loadMoreMessages thunk", () => {
  test("prepends older messages to the front of the array", async () => {
    const existingMsgs = [
      { from: "owner", to: "developer-1", message: "Recent 1", createdAt: "2026-02-09T10:05:00Z" },
      { from: "developer-1", to: "owner", message: "Recent 2", createdAt: "2026-02-09T10:06:00Z" },
    ];
    const olderMsgs = [
      { from: "owner", to: "developer-1", message: "Older 1", createdAt: "2026-02-09T10:00:00Z" },
      { from: "developer-1", to: "owner", message: "Older 2", createdAt: "2026-02-09T10:01:00Z" },
    ];

    // First load the conversation with existing messages
    api.getConversation.mockResolvedValueOnce({ messages: existingMsgs, hasMore: true });
    const store = createTestStore();
    await store.dispatch(loadConversation("developer-1"));

    // Now load more
    api.getConversation.mockResolvedValueOnce({ messages: olderMsgs, hasMore: false });
    await store.dispatch(loadMoreMessages("developer-1"));

    const convo = store.getState().messages.conversations["developer-1"];
    expect(convo.messages).toHaveLength(4);
    // Older messages should be at the front
    expect(convo.messages[0].message).toBe("Older 1");
    expect(convo.messages[1].message).toBe("Older 2");
    expect(convo.messages[2].message).toBe("Recent 1");
    expect(convo.messages[3].message).toBe("Recent 2");
  });

  test("sets loadingMore=false and updates hasMore on fulfilled", async () => {
    // First load conversation
    api.getConversation.mockResolvedValueOnce({
      messages: [{ from: "owner", to: "qa-1", message: "Msg", createdAt: "2026-02-09T10:00:00Z" }],
      hasMore: true,
    });
    const store = createTestStore();
    await store.dispatch(loadConversation("qa-1"));

    // Now load more, getting no additional messages
    api.getConversation.mockResolvedValueOnce({ messages: [], hasMore: false });
    await store.dispatch(loadMoreMessages("qa-1"));

    const convo = store.getState().messages.conversations["qa-1"];
    expect(convo.loadingMore).toBe(false);
    expect(convo.hasMore).toBe(false);
  });

  test("returns empty when conversation has no messages", async () => {
    const store = createTestStore();
    // Empty conversation — loadMoreMessages should return early
    await store.dispatch(loadMoreMessages("pm-1"));

    const convo = store.getState().messages.conversations["pm-1"];
    expect(convo.messages).toEqual([]);
    expect(convo.hasMore).toBe(false);
  });

  test("passes correct 'before' cursor to API", async () => {
    // First load conversation with messages
    const msgs = [
      { from: "developer-1", to: "owner", message: "Oldest", createdAt: "2026-02-09T09:00:00Z" },
      { from: "owner", to: "developer-1", message: "Newest", createdAt: "2026-02-09T10:00:00Z" },
    ];
    api.getConversation.mockResolvedValueOnce({ messages: msgs, hasMore: true });
    const store = createTestStore();
    await store.dispatch(loadConversation("developer-1"));

    // Now load more — should pass oldest message's timestamp
    api.getConversation.mockResolvedValueOnce({ messages: [], hasMore: false });
    await store.dispatch(loadMoreMessages("developer-1"));

    // Should pass the oldest message's createdAt as the 'before' cursor
    expect(api.getConversation).toHaveBeenLastCalledWith("owner", "developer-1", {
      before: "2026-02-09T09:00:00Z",
    });
  });

  test("sets loadingMore=false on rejected", async () => {
    // First load conversation
    api.getConversation.mockResolvedValueOnce({
      messages: [{ from: "owner", to: "developer-1", message: "Msg", createdAt: "2026-02-09T10:00:00Z" }],
      hasMore: true,
    });
    const store = createTestStore();
    await store.dispatch(loadConversation("developer-1"));

    // Now load more, but it fails
    api.getConversation.mockRejectedValueOnce(new Error("Load failed"));
    await store.dispatch(loadMoreMessages("developer-1"));

    const convo = store.getState().messages.conversations["developer-1"];
    expect(convo.loadingMore).toBe(false);
  });
});

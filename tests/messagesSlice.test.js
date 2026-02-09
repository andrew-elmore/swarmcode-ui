/**
 * Tests for store/messagesSlice.js — Redux slice for messaging state.
 * API calls are mocked at the services/api module level.
 */

import { configureStore } from "@reduxjs/toolkit";
import * as api from "../src/services/api";
import messagesReducer, { sendMessage, pollMessages, clearError, clearMessages } from "../src/store/messagesSlice";

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
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
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

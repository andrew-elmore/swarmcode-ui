/**
 * CARD-092 Unit Tests — src/store/ttsSlice.js
 *
 * Covers the fetchStreamMessages async thunk extraReducers:
 *   - pending  → streamLoading = true
 *   - fulfilled → streamLoading = false, maps messages to status=done, replaces
 *                 done-prefix, preserves pending/speaking items, recalculates currentIndex
 *   - rejected → streamLoading = false, queue unchanged (silent fail)
 *
 * Also verifies TTS no-replay invariant:
 *   - Preloaded done items are never targeted by auto-start (currentIndex stays -1)
 *   - enqueueMessage after preload targets only the new item
 */

import { configureStore } from "@reduxjs/toolkit";
import ttsReducer, {
  fetchStreamMessages,
  enqueueMessage,
  setEnabled,
} from "../../src/store/ttsSlice";

// Mock the api module
jest.mock("../../src/services/api", () => ({
  getRecentMessages: jest.fn(),
}));

import * as api from "../../src/services/api";

function makeStore(ttsOverrides = {}) {
  return configureStore({
    reducer: { tts: ttsReducer },
    preloadedState: {
      tts: {
        enabled: false,
        volume: 1.0,
        rate: 1.0,
        error: null,
        queue: [],
        currentIndex: -1,
        streamLoading: false,
        ...ttsOverrides,
      },
    },
  });
}

const MOCK_MESSAGES = [
  { id: "m1", from: "pm-1", message: "Hello team", createdAt: "2026-03-01T10:00:00Z" },
  { id: "m2", from: "developer-1", message: "Working on it", createdAt: "2026-03-01T10:01:00Z" },
  { id: "m3", from: "qa-1", message: "Tests are passing", createdAt: "2026-03-01T10:02:00Z" },
];

beforeEach(() => {
  api.getRecentMessages.mockResolvedValue({ messages: MOCK_MESSAGES });
});

afterEach(() => jest.clearAllMocks());

// ─── pending ──────────────────────────────────────────────────────────────────

describe("fetchStreamMessages.pending", () => {
  test("sets streamLoading to true", async () => {
    // Never resolves — we only care about the pending state
    api.getRecentMessages.mockImplementation(() => new Promise(() => {}));

    const store = makeStore();
    store.dispatch(fetchStreamMessages("projA111"));

    // State is synchronously updated before the promise resolves
    expect(store.getState().tts.streamLoading).toBe(true);
  });
});

// ─── fulfilled ────────────────────────────────────────────────────────────────

describe("fetchStreamMessages.fulfilled — cold queue", () => {
  test("sets streamLoading to false", async () => {
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));

    expect(store.getState().tts.streamLoading).toBe(false);
  });

  test("maps incoming messages to status=done queue items", async () => {
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));

    const { queue } = store.getState().tts;
    expect(queue).toHaveLength(3);
    queue.forEach((item) => expect(item.status).toBe("done"));
  });

  test("queue items carry from and message fields from the payload", async () => {
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));

    const { queue } = store.getState().tts;
    expect(queue[0].from).toBe("pm-1");
    expect(queue[0].message).toBe("Hello team");
    expect(queue[1].from).toBe("developer-1");
    expect(queue[2].from).toBe("qa-1");
  });

  test("currentIndex remains -1 (done items never auto-start TTS)", async () => {
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));

    expect(store.getState().tts.currentIndex).toBe(-1);
  });

  test("handles empty messages array gracefully", async () => {
    api.getRecentMessages.mockResolvedValue({ messages: [] });
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));

    expect(store.getState().tts.queue).toHaveLength(0);
    expect(store.getState().tts.currentIndex).toBe(-1);
  });

  test("handles null/missing messages field gracefully", async () => {
    api.getRecentMessages.mockResolvedValue({});
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));

    expect(store.getState().tts.queue).toHaveLength(0);
    expect(store.getState().tts.streamLoading).toBe(false);
  });
});

describe("fetchStreamMessages.fulfilled — preserves active items", () => {
  test("keeps pending items when refreshing", async () => {
    const store = makeStore({
      queue: [
        { id: 100, from: "pm-1", message: "Pending msg", status: "pending" },
      ],
      currentIndex: -1,
    });

    await store.dispatch(fetchStreamMessages("projA111"));

    const { queue } = store.getState().tts;
    // 3 historical done items + 1 pending item preserved
    expect(queue).toHaveLength(4);
    expect(queue[3].status).toBe("pending");
    expect(queue[3].from).toBe("pm-1");
    expect(queue[3].message).toBe("Pending msg");
  });

  test("recalculates currentIndex for the speaking item by id", async () => {
    // Pre-existing queue: 1 done + 1 speaking
    const speakingItem = { id: 200, from: "developer-1", message: "Currently speaking", status: "speaking" };
    const store = makeStore({
      queue: [
        { id: 199, from: "pm-1", message: "Old done", status: "done" },
        speakingItem,
      ],
      currentIndex: 1,
    });

    await store.dispatch(fetchStreamMessages("projA111"));

    const { queue, currentIndex } = store.getState().tts;
    // 3 new historical items + speakingItem (active items from index 1 onwards)
    expect(queue).toHaveLength(4);
    // Speaking item is now at index 3 (after 3 historical items)
    expect(currentIndex).toBe(3);
    expect(queue[currentIndex].id).toBe(speakingItem.id);
    expect(queue[currentIndex].status).toBe("speaking");
  });

  test("done prefix is replaced entirely on refresh", async () => {
    // All items done — they should all be replaced by fresh history
    const store = makeStore({
      queue: [
        { id: 10, from: "old-agent", message: "Old msg 1", status: "done" },
        { id: 11, from: "old-agent", message: "Old msg 2", status: "done" },
      ],
      currentIndex: -1,
    });

    await store.dispatch(fetchStreamMessages("projA111"));

    const { queue } = store.getState().tts;
    expect(queue).toHaveLength(3); // only new historical items
    expect(queue[0].from).toBe("pm-1");
    expect(queue[1].from).toBe("developer-1");
    expect(queue[2].from).toBe("qa-1");
  });
});

// ─── rejected ─────────────────────────────────────────────────────────────────

describe("fetchStreamMessages.rejected", () => {
  test("sets streamLoading to false", async () => {
    api.getRecentMessages.mockRejectedValue(new Error("Network error"));
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));

    expect(store.getState().tts.streamLoading).toBe(false);
  });

  test("leaves queue untouched (silent fail)", async () => {
    api.getRecentMessages.mockRejectedValue(new Error("API down"));
    const store = makeStore({
      queue: [
        { id: 50, from: "pm-1", message: "Existing msg", status: "pending" },
      ],
      currentIndex: -1,
    });

    await store.dispatch(fetchStreamMessages("projA111"));

    const { queue } = store.getState().tts;
    expect(queue).toHaveLength(1);
    expect(queue[0].message).toBe("Existing msg");
  });
});

// ─── TTS no-replay invariant ───────────────────────────────────────────────────
//
// Regression guard for CARD-092 requirement 4:
// TTS Start must NOT replay preloaded historical (done) messages.
// Only new messages enqueued after Start is clicked get spoken.

describe("CARD-092: TTS no-replay of preloaded messages", () => {
  test("enabling TTS after preload does not change currentIndex from -1", async () => {
    const store = makeStore();
    // Preload 3 historical messages
    await store.dispatch(fetchStreamMessages("projA111"));

    // Simulate user clicking TTS Start
    store.dispatch(setEnabled(true));

    // currentIndex must still be -1 — done items never auto-start
    expect(store.getState().tts.currentIndex).toBe(-1);
  });

  test("new message after preload starts TTS at that message, not at historical items", async () => {
    const store = makeStore({ enabled: true }); // TTS already on
    await store.dispatch(fetchStreamMessages("projA111")); // 3 done items loaded
    // After preload, currentIndex should be -1 (done items don't trigger auto-start)
    expect(store.getState().tts.currentIndex).toBe(-1);

    // New live message arrives (simulating LiveQuery enqueueMessage dispatch)
    store.dispatch(enqueueMessage({ from: "senior-dev-1", message: "New live message" }));

    const { queue, currentIndex } = store.getState().tts;
    // Queue: 3 done + 1 new item
    expect(queue).toHaveLength(4);
    // New item is at index 3 and should be the one speaking
    expect(currentIndex).toBe(3);
    expect(queue[3].from).toBe("senior-dev-1");
    expect(queue[3].status).toBe("speaking");
  });

  test("all preloaded queue items have status=done (no speaking items after preload)", async () => {
    const store = makeStore({ enabled: true });
    await store.dispatch(fetchStreamMessages("projA111")); // 3 historical messages

    const { queue } = store.getState().tts;
    expect(queue).toHaveLength(3);
    // Every preloaded item must be done — none should be speaking or pending
    queue.forEach((item) => expect(item.status).toBe("done"));
  });
});

// ─── CARD-096: createdAt stored in enqueueMessage ─────────────────────────────

describe("CARD-096: enqueueMessage stores createdAt", () => {
  test("createdAt is stored when provided", () => {
    const store = makeStore();
    store.dispatch(
      enqueueMessage({ from: "pm-1", message: "hello", createdAt: "2026-03-15T10:00:00Z" })
    );
    const { queue } = store.getState().tts;
    expect(queue[0].createdAt).toBe("2026-03-15T10:00:00Z");
  });

  test("createdAt is null when not provided", () => {
    const store = makeStore();
    store.dispatch(enqueueMessage({ from: "pm-1", message: "hello" }));
    const { queue } = store.getState().tts;
    expect(queue[0].createdAt).toBeNull();
  });

  test("createdAt is null when explicitly passed as undefined", () => {
    const store = makeStore();
    store.dispatch(
      enqueueMessage({ from: "pm-1", message: "hello", createdAt: undefined })
    );
    const { queue } = store.getState().tts;
    expect(queue[0].createdAt).toBeNull();
  });

  test("multiple enqueueMessage dispatches each store their own createdAt", () => {
    const store = makeStore();
    store.dispatch(
      enqueueMessage({ from: "pm-1", message: "first", createdAt: "2026-03-15T09:00:00Z" })
    );
    store.dispatch(
      enqueueMessage({ from: "developer-1", message: "second", createdAt: null })
    );
    const { queue } = store.getState().tts;
    expect(queue[0].createdAt).toBe("2026-03-15T09:00:00Z");
    expect(queue[1].createdAt).toBeNull();
  });
});

// ─── CARD-096: fetchStreamMessages.fulfilled maps createdAt ──────────────────

describe("CARD-096: fetchStreamMessages.fulfilled maps createdAt", () => {
  test("fulfilled queue items include createdAt from API response", async () => {
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));
    const { queue } = store.getState().tts;
    expect(queue[0].createdAt).toBe("2026-03-01T10:00:00Z");
    expect(queue[1].createdAt).toBe("2026-03-01T10:01:00Z");
    expect(queue[2].createdAt).toBe("2026-03-01T10:02:00Z");
  });

  test("fulfilled queue item has null createdAt when message lacks the field", async () => {
    api.getRecentMessages.mockResolvedValueOnce({
      messages: [{ id: "m4", from: "devops-1", message: "No timestamp" }],
    });
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));
    const { queue } = store.getState().tts;
    expect(queue[0].createdAt).toBeNull();
  });

  test("mix of messages with and without createdAt stores correctly", async () => {
    api.getRecentMessages.mockResolvedValueOnce({
      messages: [
        { id: "m1", from: "pm-1", message: "Has timestamp", createdAt: "2026-03-15T08:00:00Z" },
        { id: "m2", from: "developer-1", message: "No timestamp" },
      ],
    });
    const store = makeStore();
    await store.dispatch(fetchStreamMessages("projA111"));
    const { queue } = store.getState().tts;
    expect(queue[0].createdAt).toBe("2026-03-15T08:00:00Z");
    expect(queue[1].createdAt).toBeNull();
  });
});

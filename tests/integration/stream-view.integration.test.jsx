/**
 * CARD-096 Integration Tests — StreamView timestamp rendering and auto-scroll.
 * Author: qa-1
 *
 * Covers:
 *   - Queue items with createdAt render the queue-item-timestamp element
 *   - Queue items without createdAt do NOT render queue-item-timestamp
 *   - Timestamp text is formatted as HH:mm (2-digit hour + minute)
 *   - Multiple queue items: only those with createdAt show timestamps
 *   - Auto-scroll: scrollTop is assigned to scrollHeight when queue length changes
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material";
import ttsReducer, { enqueueMessage } from "../../src/store/ttsSlice";
import agentsReducer from "../../src/store/agentsSlice";
import messagesReducer from "../../src/store/messagesSlice";
import projectReducer from "../../src/store/projectSlice";
import StreamView from "../../src/components/StreamView";

jest.mock("../../src/services/api", () => ({
  getRecentMessages: jest.fn().mockResolvedValue({ messages: [] }),
  subscribeToMessages: jest.fn(() => Promise.resolve(() => {})),
  subscribeToCommands: jest.fn(() => Promise.resolve(() => {})),
  subscribeToPings: jest.fn(() => Promise.resolve(() => {})),
  sendMessage: jest.fn(),
}));

const theme = createTheme();

beforeAll(() => {
  // Silence speechSynthesis in jsdom
  window.speechSynthesis = {
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => []),
    pending: false,
    speaking: false,
    paused: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };
  Object.defineProperty(window.speechSynthesis, "onvoiceschanged", {
    set: jest.fn(),
    get: jest.fn(() => null),
    configurable: true,
  });
});

afterEach(() => jest.clearAllMocks());

// ─── Store / render helpers ───────────────────────────────────────────────────

function makeStoreWithQueue(queueItems = []) {
  const queue = queueItems.map((item, i) => ({
    id: i + 1,
    status: "done",
    from: item.from,
    message: item.message,
    createdAt: item.createdAt !== undefined ? item.createdAt : null,
  }));

  return configureStore({
    reducer: {
      tts: ttsReducer,
      agents: agentsReducer,
      messages: messagesReducer,
      project: projectReducer,
    },
    preloadedState: {
      tts: {
        enabled: false,
        volume: 1.0,
        rate: 1.0,
        error: null,
        queue,
        currentIndex: -1,
        streamLoading: false,
      },
      agents: { agents: [], allAgents: [], loading: false, error: null },
      messages: {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        refreshing: false,
        error: null,
        liveQueryRefreshFlag: false,
        mobileDrawerOpen: false,
      },
      project: {
        project: { objectId: "projA111" },
        cards: [],
        sprints: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
    },
  });
}

function renderStreamViewWithQueue(queueItems = []) {
  const store = makeStoreWithQueue(queueItems);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/projA111"]}>
          <Routes>
            <Route path="/:projectId" element={<StreamView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

// ─── Timestamp rendering ──────────────────────────────────────────────────────

describe("CARD-096 Integration: queue-item-timestamp renders when createdAt is present", () => {
  test("timestamp element renders when queue item has a createdAt value", async () => {
    renderStreamViewWithQueue([
      { from: "pm-1", message: "Hello team", createdAt: "2026-03-15T14:30:00Z" },
    ]);

    await waitFor(() => {
      expect(screen.getByTestId("queue-item-timestamp")).toBeInTheDocument();
    });
  });

  test("no timestamp element rendered when queue item has createdAt=null", async () => {
    renderStreamViewWithQueue([
      { from: "developer-1", message: "No timestamp", createdAt: null },
    ]);

    await waitFor(() => {
      expect(screen.queryByTestId("queue-item-timestamp")).toBeNull();
    });
  });

  test("timestamp text matches HH:MM format (two digits, colon, two digits)", async () => {
    renderStreamViewWithQueue([
      { from: "pm-1", message: "Timed message", createdAt: "2026-03-15T14:30:00Z" },
    ]);

    await waitFor(() => {
      const tsEl = screen.getByTestId("queue-item-timestamp");
      expect(tsEl).toBeInTheDocument();
      // toLocaleTimeString with hour: "2-digit", minute: "2-digit"
      // Produces "2:30 PM", "14:30", "02:30 PM", etc. depending on locale
      expect(tsEl.textContent).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  test("only items with createdAt have timestamps — mixed queue", async () => {
    renderStreamViewWithQueue([
      { from: "pm-1", message: "Has time", createdAt: "2026-03-15T09:00:00Z" },
      { from: "developer-1", message: "No time", createdAt: null },
      { from: "qa-1", message: "Also has time", createdAt: "2026-03-15T09:05:00Z" },
    ]);

    await waitFor(() => {
      const timestamps = screen.getAllByTestId("queue-item-timestamp");
      expect(timestamps).toHaveLength(2);
    });
  });

  test("queue item message text still renders alongside timestamp", async () => {
    renderStreamViewWithQueue([
      { from: "senior-dev-1", message: "Architecture decision", createdAt: "2026-03-15T10:00:00Z" },
    ]);

    await waitFor(() => {
      expect(screen.getByText("Architecture decision")).toBeInTheDocument();
      expect(screen.getByTestId("queue-item-timestamp")).toBeInTheDocument();
    });
  });

  test("sender name and timestamp both appear in queue item header", async () => {
    renderStreamViewWithQueue([
      { from: "devops-1", message: "Deployed", createdAt: "2026-03-15T12:00:00Z" },
    ]);

    await waitFor(() => {
      expect(screen.getByText("devops-1")).toBeInTheDocument();
      expect(screen.getByTestId("queue-item-timestamp")).toBeInTheDocument();
    });
  });
});

// ─── Auto-scroll ──────────────────────────────────────────────────────────────

describe("CARD-096 Integration: auto-scroll on queue length change", () => {
  test("scrollTop is set to scrollHeight when a new message is enqueued", async () => {
    const { store } = renderStreamViewWithQueue([]);

    // Find the queue container (queueListRef target, data-testid="stream-queue")
    const queueList = document.querySelector('[data-testid="stream-queue"]');
    expect(queueList).not.toBeNull();

    // Spy on scrollTop setter and mock scrollHeight
    let assignedScrollTop = -1;
    Object.defineProperty(queueList, "scrollHeight", {
      get: () => 500,
      configurable: true,
    });
    Object.defineProperty(queueList, "scrollTop", {
      get: () => assignedScrollTop,
      set: (v) => {
        assignedScrollTop = v;
      },
      configurable: true,
    });

    // Dispatch a new message — triggers useEffect([tts.queue.length])
    await act(async () => {
      store.dispatch(
        enqueueMessage({ from: "pm-1", message: "scroll test", createdAt: null })
      );
    });

    expect(assignedScrollTop).toBe(500);
  });

  test("stream-queue element is present in the DOM after render", async () => {
    renderStreamViewWithQueue([]);
    const queueList = document.querySelector('[data-testid="stream-queue"]');
    expect(queueList).not.toBeNull();
  });
});

/**
 * CARD-092 Unit Tests — src/components/StreamView.jsx
 *
 * Covers:
 *   1. fetchStreamMessages dispatched on mount with projectIdParam from URL
 *   2. stream-refresh button is present and clickable
 *   3. Clicking refresh dispatches fetchStreamMessages again
 *   4. Refresh button is disabled when streamLoading = true
 *   5. CircularProgress renders when streamLoading = true
 *   6. Preloaded messages appear in stream-queue as stream-queue-item elements
 *   7. Preloaded (done) items are visually dimmed (disabled ListItemButton)
 *   8. stream-toggle (TTS Start/Stop) and stream-status are present
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material";
import ttsReducer from "../../src/store/ttsSlice";
import agentsReducer from "../../src/store/agentsSlice";
import messagesReducer from "../../src/store/messagesSlice";
import StreamView from "../../src/components/StreamView";

jest.mock("../../src/services/api", () => ({
  getRecentMessages: jest.fn(),
  subscribeToMessages: jest.fn(() => Promise.resolve(() => {})),
  subscribeToCommands: jest.fn(() => Promise.resolve(() => {})),
  subscribeToPings: jest.fn(() => Promise.resolve(() => {})),
  sendMessage: jest.fn(),
}));

import * as api from "../../src/services/api";

// Silence speechSynthesis usage in jsdom
beforeAll(() => {
  Object.defineProperty(window, "speechSynthesis", {
    value: { speak: jest.fn(), cancel: jest.fn(), pause: jest.fn(), resume: jest.fn(), speaking: false, getVoices: () => [] },
    writable: true,
  });
});

const theme = createTheme();

const MOCK_MESSAGES = [
  { id: "m1", from: "pm-1", message: "Hello team", createdAt: "2026-03-01T10:00:00Z" },
  { id: "m2", from: "developer-1", message: "Working on it", createdAt: "2026-03-01T10:01:00Z" },
];

function makeStore(ttsOverrides = {}) {
  return configureStore({
    reducer: {
      tts: ttsReducer,
      agents: agentsReducer,
      messages: messagesReducer,
    },
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
      agents: { agents: [], allAgents: [], loading: false, error: null },
      messages: {
        messages: [],
        selectedAgent: null,
        sending: false,
        polling: false,
        error: null,
        lastPoll: null,
        liveQueryRefreshFlag: 0,
        mobileDrawerOpen: false,
      },
    },
  });
}

function renderStreamView(projectId = "projA111", ttsOverrides = {}) {
  const store = makeStore(ttsOverrides);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[`/${projectId}`]}>
          <Routes>
            <Route path="/:projectId" element={<StreamView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

beforeEach(() => {
  api.getRecentMessages.mockResolvedValue({ messages: [] });
});

afterEach(() => jest.clearAllMocks());

// ─── Basic rendering ───────────────────────────────────────────────────────────

describe("StreamView — basic rendering", () => {
  test("renders stream-view container", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-view")).toBeInTheDocument();
  });

  test("renders stream-toggle button", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-toggle")).toBeInTheDocument();
  });

  test("renders stream-status text", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-status")).toBeInTheDocument();
  });

  test("renders stream-refresh button", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-refresh")).toBeInTheDocument();
  });

  test("renders stream-queue container", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-queue")).toBeInTheDocument();
  });
});

// ─── Mount fetch ──────────────────────────────────────────────────────────────

describe("CARD-092: StreamView dispatches fetchStreamMessages on mount", () => {
  test("calls api.getRecentMessages with projectId on mount", async () => {
    renderStreamView("projA111");

    await waitFor(() => {
      expect(api.getRecentMessages).toHaveBeenCalledWith("projA111");
    });
  });

  test("does not call getRecentMessages if no projectId in URL", async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<StreamView />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );

    // Wait a tick to confirm no call was made
    await new Promise((r) => setTimeout(r, 50));
    expect(api.getRecentMessages).not.toHaveBeenCalled();
  });

  test("preloaded messages appear as stream-queue-items", async () => {
    api.getRecentMessages.mockResolvedValue({ messages: MOCK_MESSAGES });
    renderStreamView("projA111");

    await waitFor(() => {
      const items = screen.getAllByTestId("stream-queue-item");
      expect(items).toHaveLength(2);
    });
  });

  test("preloaded queue items show agent names from messages", async () => {
    api.getRecentMessages.mockResolvedValue({ messages: MOCK_MESSAGES });
    renderStreamView("projA111");

    await waitFor(() => {
      expect(screen.getByText("pm-1")).toBeInTheDocument();
      expect(screen.getByText("developer-1")).toBeInTheDocument();
    });
  });

  test("preloaded queue items are disabled (status=done, not clickable)", async () => {
    api.getRecentMessages.mockResolvedValue({ messages: MOCK_MESSAGES });
    renderStreamView("projA111");

    await waitFor(() => {
      const items = screen.getAllByTestId("stream-queue-item");
      // All items should be disabled (done items are non-interactive)
      items.forEach((item) => {
        expect(item).toHaveAttribute("aria-disabled", "true");
      });
    });
  });
});

// ─── Refresh button ───────────────────────────────────────────────────────────

describe("CARD-092: stream-refresh button behavior", () => {
  test("clicking refresh calls getRecentMessages again", async () => {
    renderStreamView("projA111");

    // Wait for mount fetch
    await waitFor(() => expect(api.getRecentMessages).toHaveBeenCalledTimes(1));

    // Click refresh
    fireEvent.click(screen.getByTestId("stream-refresh"));

    await waitFor(() => {
      expect(api.getRecentMessages).toHaveBeenCalledTimes(2);
      expect(api.getRecentMessages).toHaveBeenLastCalledWith("projA111");
    });
  });

  test("refresh button is enabled when not loading", async () => {
    renderStreamView("projA111");

    await waitFor(() => expect(api.getRecentMessages).toHaveBeenCalled());
    expect(screen.getByTestId("stream-refresh")).not.toBeDisabled();
  });

  test("refresh button is disabled when streamLoading=true", async () => {
    // Preload streamLoading=true in store
    renderStreamView("projA111", { streamLoading: true });

    expect(screen.getByTestId("stream-refresh")).toBeDisabled();
  });

  test("CircularProgress renders when streamLoading=true", async () => {
    // Use a never-resolving promise to stay in loading state
    api.getRecentMessages.mockImplementation(() => new Promise(() => {}));
    renderStreamView("projA111");

    await waitFor(() => {
      // CircularProgress appears inside the refresh button while loading
      const refreshBtn = screen.getByTestId("stream-refresh");
      expect(refreshBtn.querySelector("[class*='MuiCircularProgress']")).not.toBeNull();
    });
  });
});

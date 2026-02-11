/**
 * CARD-051 QA Tests — TTS speaks message content only, no agent name prefix.
 *
 * Updated for CARD-090: Now tests that enqueueMessage is dispatched with
 * raw msg.message (no prefix), using browser speechSynthesis via Redux queue.
 * Author: developer-1
 * Updated: 2026-02-11 (CARD-090: replaced synthesizeSpeech with enqueueMessage)
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";

// Mock API
let capturedOnMessage = null;

jest.mock("../src/services/api", () => ({
  subscribeToMessages: jest.fn((cb) => {
    capturedOnMessage = cb;
    return Promise.resolve(jest.fn());
  }),
}));

import MessagesView from "../src/components/MessagesView";

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
};

function createTestStore(ttsOverrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...ttsOverrides },
      agents: {
        agents: [
          { name: "pm-1", description: "PM Agent", voice: "en_US-amy-medium", isActive: true, sortOrder: 0 },
          { name: "developer-1", description: "Developer", voice: "en_US-joe-medium", isActive: true, sortOrder: 1 },
        ],
        loading: false,
        error: null,
      },
      board: { board: null, cards: [], loading: false, error: null, sprints: [], sprintFilter: "" },
    },
  });
}

function renderWithProviders(ui, store) {
  const testStore = store || createTestStore();
  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper }), store: testStore };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnMessage = null;
});

describe("CARD-051: TTS speaks message only, no agent name prefix", () => {
  test("enqueueMessage receives only message content when TTS is enabled", async () => {
    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-1",
        from: "developer-1",
        to: "owner",
        message: "Bug fix complete",
        createdAt: "2026-02-10T12:01:00Z",
        broadcast: false,
      });
    });

    // CARD-090: Message should be enqueued with raw message content (no prefix)
    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].message).toBe("Bug fix complete");
    expect(queue[0].from).toBe("developer-1");
  });

  test("agent name prefix is NOT prepended to enqueued message", async () => {
    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-2",
        from: "pm-1",
        to: "owner",
        message: "Task assigned to developer-1",
        createdAt: "2026-02-10T12:02:00Z",
        broadcast: false,
      });
    });

    const { queue } = store.getState().tts;
    expect(queue.length).toBe(1);
    expect(queue[0].message).toBe("Task assigned to developer-1");
    expect(queue[0].message).not.toMatch(/^pm-1 says:/);
    expect(queue[0].message).not.toMatch(/^PM Agent says:/);
  });

  test("owner messages are NOT enqueued (only incoming agent messages)", async () => {
    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-3",
        from: "owner",
        to: "pm-1",
        message: "This is from the owner",
        createdAt: "2026-02-10T12:03:00Z",
        broadcast: false,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(store.getState().tts.queue.length).toBe(0);
  });

  test("TTS does not enqueue when TTS is disabled", async () => {
    const store = createTestStore({ enabled: false });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-4",
        from: "pm-1",
        to: "owner",
        message: "Should not be spoken",
        createdAt: "2026-02-10T12:04:00Z",
        broadcast: false,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(store.getState().tts.queue.length).toBe(0);
  });
});

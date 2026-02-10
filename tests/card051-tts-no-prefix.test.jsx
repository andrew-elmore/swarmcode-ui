/**
 * CARD-051 QA Tests — TTS should speak message content only, no agent name prefix.
 *
 * Verifies that the LiveQuery callback in MessagesView.jsx calls
 * engine.speak(msg.message) — NOT engine.speak(`${label} says: ${msg.message}`).
 */

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import TtsEngine from "../src/utils/ttsEngine";
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

// Spy on TtsEngine.prototype.speak to capture what text is spoken
let speakSpy;

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const DEFAULT_TTS_STATE = { enabled: false, volume: 1.0, rate: 1.0, perAgentVoice: {}, speakAgentName: false, error: null };

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
          { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
          { name: "developer-1", description: "Developer", isActive: true, sortOrder: 1 },
        ],
        loading: false,
        error: null,
      },
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
  speakSpy = jest.spyOn(TtsEngine.prototype, "speak");
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getAgents.mockResolvedValue({
    agents: [
      { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
      { name: "developer-1", description: "Developer", isActive: true, sortOrder: 1 },
    ],
  });
});

afterEach(() => jest.restoreAllMocks());

describe("CARD-051: TTS speaks message only, no agent name prefix", () => {
  test("TTS speak receives only message content when engine is enabled", async () => {
    let liveQueryCallback = null;
    api.subscribeToMessages.mockImplementation((cb) => {
      liveQueryCallback = cb;
      return Promise.resolve(jest.fn());
    });

    // Create store with TTS enabled so the engine.enabled check passes
    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => {
      expect(liveQueryCallback).not.toBeNull();
    });

    speakSpy.mockClear();

    const { act } = await import("@testing-library/react");
    await act(async () => {
      liveQueryCallback({
        id: "msg-1",
        from: "developer-1",
        to: "owner",
        message: "Bug fix complete",
        createdAt: "2026-02-10T12:01:00Z",
        broadcast: false,
      });
    });

    // speak should have been called with raw message only
    expect(speakSpy).toHaveBeenCalledWith("Bug fix complete");
    // Verify it was NOT called with any agent name prefix
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("says:")
    );
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("developer-1")
    );
  });

  test("agent name prefix is NOT prepended to spoken text", async () => {
    let liveQueryCallback = null;
    api.subscribeToMessages.mockImplementation((cb) => {
      liveQueryCallback = cb;
      return Promise.resolve(jest.fn());
    });

    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => {
      expect(liveQueryCallback).not.toBeNull();
    });

    speakSpy.mockClear();

    const { act } = await import("@testing-library/react");
    await act(async () => {
      liveQueryCallback({
        id: "msg-2",
        from: "pm-1",
        to: "owner",
        message: "Task assigned to developer-1",
        createdAt: "2026-02-10T12:02:00Z",
        broadcast: false,
      });
    });

    // Spoken text should be the raw message, not "pm-1 says: Task assigned..."
    expect(speakSpy).toHaveBeenCalledTimes(1);
    const spokenText = speakSpy.mock.calls[0][0];
    expect(spokenText).toBe("Task assigned to developer-1");
    expect(spokenText).not.toMatch(/^pm-1 says:/);
    expect(spokenText).not.toMatch(/^PM Agent says:/);
  });

  test("owner messages are NOT spoken (only incoming agent messages)", async () => {
    let liveQueryCallback = null;
    api.subscribeToMessages.mockImplementation((cb) => {
      liveQueryCallback = cb;
      return Promise.resolve(jest.fn());
    });

    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => {
      expect(liveQueryCallback).not.toBeNull();
    });

    speakSpy.mockClear();

    const { act } = await import("@testing-library/react");
    await act(async () => {
      liveQueryCallback({
        id: "msg-3",
        from: "owner",
        to: "pm-1",
        message: "This is from the owner",
        createdAt: "2026-02-10T12:03:00Z",
        broadcast: false,
      });
    });

    // Owner messages should NOT be spoken
    expect(speakSpy).not.toHaveBeenCalled();
  });

  test("TTS does not speak when engine is disabled", async () => {
    let liveQueryCallback = null;
    api.subscribeToMessages.mockImplementation((cb) => {
      liveQueryCallback = cb;
      return Promise.resolve(jest.fn());
    });

    // TTS disabled (default)
    const store = createTestStore({ enabled: false });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => {
      expect(liveQueryCallback).not.toBeNull();
    });

    speakSpy.mockClear();

    const { act } = await import("@testing-library/react");
    await act(async () => {
      liveQueryCallback({
        id: "msg-4",
        from: "pm-1",
        to: "owner",
        message: "Should not be spoken",
        createdAt: "2026-02-10T12:04:00Z",
        broadcast: false,
      });
    });

    // When disabled, speak should not be called at all
    expect(speakSpy).not.toHaveBeenCalled();
  });
});

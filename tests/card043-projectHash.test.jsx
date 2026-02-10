/**
 * CARD-043 QA Tests — Verify projectHash availability fixes.
 *
 * Bug 1: App.jsx now dispatches fetchBoard on startup so projectHash
 *         is available for all tabs (not just Board/Agents).
 * Bug 2: sendMessage thunk passes projectHash from board state to API.
 *         (Agent-side fix in main.py is verified via API call assertions.)
 */

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer, { sendMessage, loadConversation, loadMoreMessages } from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import App from "../src/App";

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

function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, perAgentVoice: {}, speakAgentName: false, error: null },
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
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [] });
  api.createCard.mockResolvedValue({ card: {} });
  api.updateCard.mockResolvedValue({ card: {} });
  api.addComment.mockResolvedValue({ comment: {} });
  api.listCards.mockResolvedValue({ cards: [] });
  api.showCard.mockResolvedValue({ card: {} });
  api.pollBoard.mockResolvedValue({ changed: false, cards: [] });
  api.sendMessage.mockResolvedValue({ success: true });
  api.pollMessages.mockResolvedValue({ messages: [] });
  api.getConversation.mockResolvedValue({ messages: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.addRecentProject.mockResolvedValue({ success: true });
  api.getAgents.mockResolvedValue({
    agents: [
      { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
      { name: "developer-1", description: "Developer", isActive: true, sortOrder: 1 },
    ],
  });
});

afterEach(() => jest.restoreAllMocks());

// ─── Bug 1: App dispatches fetchBoard on startup ──────────────────────────

describe("CARD-043 Bug 1: App.jsx dispatches fetchBoard on startup", () => {
  test("calls getOrCreateBoard when activeProject is set (Messages tab default)", async () => {
    const mockBoard = { objectId: "b1", projectHash: "hash-123", nextId: 1 };
    api.getOrCreateBoard.mockResolvedValue({ board: mockBoard, cards: [] });

    const store = createTestStore({
      projects: {
        projects: [{ path: "/test/project", name: "project" }],
        activeProject: { path: "/test/project", name: "project" },
        loading: false,
        error: null,
      },
    });

    renderWithProviders(<App />, { store });

    // App.jsx useEffect should dispatch fetchBoard with activeProject.path
    await waitFor(() => {
      expect(api.getOrCreateBoard).toHaveBeenCalledWith("/test/project");
    });

    // After fetchBoard resolves, board.board.projectHash should be set in store
    await waitFor(() => {
      const boardState = store.getState().board;
      expect(boardState.board).not.toBeNull();
      expect(boardState.board.projectHash).toBe("hash-123");
    });
  });

  test("does NOT call getOrCreateBoard when no activeProject", async () => {
    api.getOrCreateBoard.mockClear();

    const store = createTestStore({
      projects: {
        projects: [],
        activeProject: null,
        loading: false,
        error: null,
      },
    });

    renderWithProviders(<App />, { store });

    // Give effects time to run
    await new Promise((r) => setTimeout(r, 100));

    // getOrCreateBoard should NOT have been called (no active project)
    expect(api.getOrCreateBoard).not.toHaveBeenCalled();
  });

  test("projectHash is available in store before messaging thunks fire", async () => {
    const mockBoard = { objectId: "b1", projectHash: "hash-xyz", nextId: 1 };
    api.getOrCreateBoard.mockResolvedValue({ board: mockBoard, cards: [] });

    const store = createTestStore({
      projects: {
        projects: [{ path: "/my/proj", name: "proj" }],
        activeProject: { path: "/my/proj", name: "proj" },
        loading: false,
        error: null,
      },
    });

    renderWithProviders(<App />, { store });

    // Wait for board to load
    await waitFor(() => {
      expect(store.getState().board.board?.projectHash).toBe("hash-xyz");
    });

    // Now simulate sending a message — it should read projectHash from board state
    api.sendMessage.mockResolvedValue({ success: true });
    await store.dispatch(sendMessage({ to: "developer-1", message: "Test msg" }));

    expect(api.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ projectHash: "hash-xyz" })
    );
  });
});

// ─── Bug 2: sendMessage thunk passes projectHash ──────────────────────────

describe("CARD-043 Bug 2: sendMessage passes projectHash from board state", () => {
  const PROJECT_HASH = "card043-test-hash";

  function createStoreWithBoard() {
    return createTestStore({
      board: {
        board: { projectHash: PROJECT_HASH },
        cards: [],
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
    });
  }

  test("sendMessage includes projectHash in API call", async () => {
    api.sendMessage.mockResolvedValue({ success: true });
    const store = createStoreWithBoard();

    await store.dispatch(sendMessage({ to: "pm-1", message: "Hello PM" }));

    expect(api.sendMessage).toHaveBeenCalledWith({
      projectHash: PROJECT_HASH,
      from: "owner",
      to: "pm-1",
      message: "Hello PM",
    });
  });

  test("loadConversation includes projectHash in API call", async () => {
    api.getConversation.mockResolvedValue({ messages: [], hasMore: false });
    const store = createStoreWithBoard();

    await store.dispatch(loadConversation("developer-1"));

    expect(api.getConversation).toHaveBeenCalledWith(
      PROJECT_HASH,
      "owner",
      "developer-1",
      { limit: 30 }
    );
  });

  test("loadMoreMessages includes projectHash in API call", async () => {
    const msgs = [
      { from: "owner", to: "developer-1", message: "Msg", createdAt: "2026-02-09T10:00:00Z" },
    ];
    api.getConversation.mockResolvedValueOnce({ messages: msgs, hasMore: true });

    const store = createStoreWithBoard();
    await store.dispatch(loadConversation("developer-1"));

    api.getConversation.mockResolvedValueOnce({ messages: [], hasMore: false });
    await store.dispatch(loadMoreMessages("developer-1"));

    // Second call should include projectHash and before cursor
    expect(api.getConversation).toHaveBeenLastCalledWith(
      PROJECT_HASH,
      "owner",
      "developer-1",
      { before: "2026-02-09T10:00:00Z" }
    );
  });

  test("sendMessage passes undefined projectHash when board not loaded", async () => {
    api.sendMessage.mockResolvedValue({ success: true });

    // Store with no board loaded
    const store = createTestStore({
      board: {
        board: null,
        cards: [],
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
    });

    await store.dispatch(sendMessage({ to: "pm-1", message: "No board" }));

    // Should still call API but with undefined projectHash
    expect(api.sendMessage).toHaveBeenCalledWith({
      projectHash: undefined,
      from: "owner",
      to: "pm-1",
      message: "No board",
    });
  });
});

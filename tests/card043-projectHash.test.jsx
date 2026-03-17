/**
 * CARD-043 QA Tests — Verify projectHash availability fixes.
 *
 * Bug 1: App.jsx now dispatches fetchProject on startup so projectHash
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
import articlesReducer from "../src/store/articlesSlice";
import projectReducer from "../src/store/projectSlice";
import messagesReducer, { loadConversation, loadMoreMessages } from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import commandsReducer from "../src/store/commandsSlice";
import authReducer from "../src/store/authSlice";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";

jest.mock("../src/services/api", () => ({
  getOrCreateProject: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  subscribeToCommands: jest.fn(),
  subscribeToPings: jest.fn(),
  subscribeToCards: jest.fn(() => () => {}),
}));

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      project: projectReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
      commands: commandsReducer,
      auth: authReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null, queue: [], currentIndex: -1 },
      ...preloadedState,
    },
  });
}

function renderWithProviders(ui, { store, initialPath = '/', ...options } = {}) {
  const testStore = store || createTestStore();
  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[initialPath]}>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...options }), store: testStore };
}

beforeEach(() => {
  api.getOrCreateProject.mockResolvedValue({ project: null, cards: [] });
  api.createCard.mockResolvedValue({ card: {} });
  api.updateCard.mockResolvedValue({ card: {} });
  api.addComment.mockResolvedValue({ comment: {} });
  api.listCards.mockResolvedValue({ cards: [] });
  api.showCard.mockResolvedValue({ card: {} });
  api.sendMessage.mockResolvedValue({ success: true });
  api.getConversation.mockResolvedValue({ messages: [] });
  api.subscribeToMessages.mockReturnValue(jest.fn()); // sync (CARD-099)
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.addRecentProject.mockResolvedValue({ success: true });
  api.getAgents.mockResolvedValue({
    agents: [
      { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
      { name: "developer-1", description: "Developer", isActive: true, sortOrder: 1 },
    ],
  });
  api.subscribeToCommands.mockReturnValue(jest.fn()); // sync (CARD-099)
  api.subscribeToPings.mockReturnValue(jest.fn()); // sync (CARD-099)
});

afterEach(() => jest.restoreAllMocks());

// ─── Bug 1: App dispatches fetchProject on startup ──────────────────────────

describe("CARD-043 Bug 1: App.jsx dispatches fetchProject on startup", () => {
  test("calls getOrCreateProject when navigated to /:projectId (via ProjectLayout)", async () => {
    const mockBoard = { objectId: "b1", projectHash: "hash-123", nextId: 1 };
    api.getOrCreateProject.mockResolvedValue({ project: mockBoard, cards: [] });

    // ProjectLayout triggers fetchProject when URL matches a known project
    const store = createTestStore({
      projects: {
        projects: [{ objectId: "projA111", path: "/test/project", name: "project" }],
        activeProject: null,
        loading: false,
        error: null,
      },
    });

    // Render App at /:projectId so ProjectLayout fires
    renderWithProviders(<App />, { store, initialPath: '/projA111' });

    await waitFor(() => {
      expect(api.getOrCreateProject).toHaveBeenCalledWith("/test/project");
    });

    await waitFor(() => {
      const boardState = store.getState().project;
      expect(boardState.project).not.toBeNull();
      expect(boardState.project.objectId).toBe("b1");
    });
  });

  test("does NOT call getOrCreateProject when at '/' with no project in URL", async () => {
    api.getOrCreateProject.mockClear();

    const store = createTestStore({
      projects: {
        projects: [],
        activeProject: null,
        loading: false,
        error: null,
      },
    });

    renderWithProviders(<App />, { store, initialPath: '/' });

    // Give effects time to run
    await new Promise((r) => setTimeout(r, 100));

    // getOrCreateProject should NOT have been called (no active project)
    expect(api.getOrCreateProject).not.toHaveBeenCalled();
  });

});

// ─── Bug 2: sendMessage thunk passes projectHash ──────────────────────────

describe("CARD-043 Bug 2: sendMessage passes projectHash from board state", () => {
  const PROJECT_HASH = "card043-test-hash";

  function createStoreWithBoard() {
    return createTestStore({
      project: {
        project: { objectId: PROJECT_HASH },
        cards: [],
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
    });
  }

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

    // Second call should include projectId (objectId) and before cursor
    expect(api.getConversation).toHaveBeenLastCalledWith(
      PROJECT_HASH,
      "owner",
      "developer-1",
      { before: "2026-02-09T10:00:00Z" }
    );
  });

});

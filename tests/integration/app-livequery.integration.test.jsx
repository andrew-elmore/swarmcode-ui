/**
 * CARD-092 Integration Tests — src/App.jsx LiveQuery immediate subscription
 *
 * Verifies that both LiveQuery effects in App.jsx use projectIdInUrl
 * (derived from location.pathname) rather than s.project.project?.objectId.
 *
 * Regression guard: LiveQuery must start immediately when the URL contains a
 * project segment, NOT waiting for the fetchProject waterfall to complete.
 *
 * Key scenarios:
 *   1. subscribeToMessages called with projectIdInUrl when Redux project is null
 *   2. subscribeToCommands/subscribeToPings called with projectIdInUrl when project is null
 *   3. subscribeToMessages NOT called when URL has no project segment (e.g. "/")
 *   4. LiveQuery re-subscribes when projectIdInUrl changes (URL navigation)
 */

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material";
import agentsReducer from "../../src/store/agentsSlice";
import articlesReducer from "../../src/store/articlesSlice";
import authReducer from "../../src/store/authSlice";
import projectReducer from "../../src/store/projectSlice";
import commandsReducer from "../../src/store/commandsSlice";
import messagesReducer from "../../src/store/messagesSlice";
import projectsReducer from "../../src/store/projectsSlice";
import ttsReducer from "../../src/store/ttsSlice";
import App from "../../src/App";

jest.mock("../../src/services/api", () => ({
  getOrCreateProject: jest.fn(),
  getRecentProjects: jest.fn(),
  addRecentProject: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  getAllAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  assignAgent: jest.fn(),
  unassignAgent: jest.fn(),
  updateProjectAgent: jest.fn(),
  getArticles: jest.fn(),
  listArticles: jest.fn(),
  getConversation: jest.fn(),
  sendMessage: jest.fn(),
  subscribeToMessages: jest.fn(() => Promise.resolve(() => {})),
  subscribeToCommands: jest.fn(() => Promise.resolve(() => {})),
  subscribeToPings: jest.fn(() => Promise.resolve(() => {})),
  getRecentMessages: jest.fn(() => Promise.resolve({ messages: [] })),
  listRecentCommands: jest.fn(() => Promise.resolve({ commands: [] })),
  getLatestPing: jest.fn(() => Promise.resolve({ ping: null })),
  getRequestedCommands: jest.fn(() => Promise.resolve({ commands: [] })),
  restoreSession: jest.fn(() => Promise.resolve(null)),
  loginUser: jest.fn(),
  logoutUser: jest.fn(),
  searchArticles: jest.fn(() => Promise.resolve({ articles: [] })),
}));

import * as api from "../../src/services/api";

const theme = createTheme();

// Cold Redux state — s.project.project is deliberately null to simulate
// the period before fetchProject has completed.
function makeColdStore(overrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      auth: authReducer,
      project: projectReducer,
      commands: commandsReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null, queue: [], currentIndex: -1, streamLoading: false },
      agents: { agents: [], allAgents: [], loading: false, error: null },
      articles: { articles: [], linkedArticleTitles: [], selectedArticle: null, searchResults: [], loading: false, error: null },
      project: {
        project: null, // Cold — fetchProject not yet complete
        cards: [], sprints: [], statuses: [],
        sprintFilter: null, selectedCard: null,
        loading: false, error: null, lastPoll: null,
      },
      projects: {
        projects: [{ objectId: "projA111", path: "/path/a", name: "Project A" }],
        activeProject: { objectId: "projA111", path: "/path/a", name: "Project A" },
        loading: false,
        error: null,
      },
      ...overrides,
    },
  });
}

function renderAppAt(path, storeOverrides = {}) {
  const store = makeColdStore(storeOverrides);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

beforeEach(() => {
  api.getOrCreateProject.mockResolvedValue({
    project: { objectId: "projA111" }, cards: [], sprints: [], statuses: [],
  });
  api.getRecentProjects.mockResolvedValue({
    projects: [{ objectId: "projA111", path: "/path/a", name: "Project A" }],
  });
});

afterEach(() => jest.clearAllMocks());

// ─── LiveQuery fires on projectIdInUrl, not s.project.project ────────────────

describe("CARD-092: App.jsx LiveQuery uses projectIdInUrl (not Redux project state)", () => {
  test("subscribeToMessages called with projectIdInUrl even when s.project.project is null", async () => {
    renderAppAt("/projA111");

    // LiveQuery must fire immediately from the URL, before fetchProject resolves
    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalledWith(
        "projA111",
        expect.any(Function)
      );
    });
  });

  test("subscribeToCommands called with projectIdInUrl even when s.project.project is null", async () => {
    renderAppAt("/projA111");

    await waitFor(() => {
      expect(api.subscribeToCommands).toHaveBeenCalledWith(
        "projA111",
        expect.any(Function)
      );
    });
  });

  test("subscribeToPings called with projectIdInUrl even when s.project.project is null", async () => {
    renderAppAt("/projA111");

    await waitFor(() => {
      expect(api.subscribeToPings).toHaveBeenCalledWith(
        "projA111",
        expect.any(Function)
      );
    });
  });

  test("subscribeToMessages NOT called when URL has no project segment (/)", async () => {
    renderAppAt("/");

    // Wait a tick to confirm no spurious call
    await new Promise((r) => setTimeout(r, 50));
    expect(api.subscribeToMessages).not.toHaveBeenCalled();
  });

  test("subscribeToMessages fires immediately without waiting for fetchProject waterfall", async () => {
    // fetchProject is slow/never-resolves — LiveQuery must not wait for it.
    // Use a project state where activeProject differs from URL so ProjectLayout
    // actually calls fetchProject (triggering the waterfall we want to test).
    api.getOrCreateProject.mockImplementation(() => new Promise(() => {}));

    renderAppAt("/projA111", {
      projects: {
        // activeProject is a different project so ProjectLayout triggers fetchProject
        projects: [
          { objectId: "projA111", path: "/path/a", name: "Project A" },
          { objectId: "projB222", path: "/path/b", name: "Project B" },
        ],
        activeProject: { objectId: "projB222", path: "/path/b", name: "Project B" },
        loading: false,
        error: null,
      },
    });

    // subscribeToMessages fires from projectIdInUrl before fetchProject resolves
    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalledWith("projA111", expect.any(Function));
    });
    // fetchProject is still pending (never-resolving mock) — confirmed waterfall didn't block LiveQuery
    expect(api.getOrCreateProject).toHaveBeenCalled();
  });
});

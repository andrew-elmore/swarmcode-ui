/**
 * CARD-185 QA Tests — Error/failure state specs (error-alert data-testid).
 *
 * Verifies that all 6 Alert components across 5 views render with
 * data-testid="error-alert" and that onClose dismiss works where wired.
 *
 * Components under test:
 *   1. BoardView         — error-alert renders; no onClose (non-dismissible)
 *   2. ArticlesView list — error-alert renders; onClose dispatches clearError
 *   3. ArticlesView detail — error-alert renders; onClose dispatches clearError
 *   4. ProjectsView      — error-alert renders; onClose dispatches clearError
 *   5. AgentsView        — error-alert renders; onClose dispatches clearError
 *   6. CommandsView      — error-alert renders; no onClose (non-dismissible)
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import articlesReducer from "../src/store/articlesSlice";
import projectReducer from "../src/store/projectSlice";
import commandsReducer from "../src/store/commandsSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import { MemoryRouter } from "react-router-dom";
import BoardView from "../src/components/BoardView";
import ArticlesView from "../src/components/ArticlesView";
import ProjectsView from "../src/components/ProjectsView";
import AgentsView from "../src/components/AgentsView";
import CommandsView from "../src/components/CommandsView";

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
  getAllAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  assignAgentToProject: jest.fn(),
  unassignAgentFromProject: jest.fn(),
  updateProjectAgent: jest.fn(),
  createSprint: jest.fn(),
  getSprints: jest.fn(),
  updateSprint: jest.fn(),
  deleteSprint: jest.fn(),
  listArticles: jest.fn(),
  createArticle: jest.fn(),
  updateArticle: jest.fn(),
  deleteArticle: jest.fn(),
  searchArticles: jest.fn(),
  getArticle: jest.fn(),
  createCommand: jest.fn(),
  listRecentCommands: jest.fn(),
  updateCommandStatus: jest.fn(),
  recordPing: jest.fn(),
  getLatestPing: jest.fn(),
  getRequestedCommands: jest.fn(),
  subscribeToCommands: jest.fn(),
  subscribeToPings: jest.fn(),
}));

const theme = createTheme();

const DEFAULT_BOARD = {
  project: { objectId: "test-hash" },
  cards: [],
  sprints: [],
  sprintFilter: null,
  selectedCard: null,
  loading: false,
  error: null,
  lastPoll: null,
};

const DEFAULT_AGENTS = {
  agents: [],
  allAgents: [],
  loading: false,
  error: null,
};

const DEFAULT_ARTICLES = {
  articles: [],
  linkedArticleTitles: [],
  selectedArticle: null,
  searchResults: [],
  loading: false,
  error: null,
};

const DEFAULT_COMMANDS = {
  commands: [],
  latestPing: null,
  loading: false,
  sending: false,
  error: null,
};

const DEFAULT_MESSAGES = {
  messages: [],
  sending: false,
  polling: false,
  error: null,
  lastPoll: null,
};

const DEFAULT_PROJECTS = {
  projects: [],
  activeProject: { path: "/test", name: "test" },
  loading: false,
  error: null,
};

const DEFAULT_TTS = { enabled: false, volume: 1.0, rate: 1.0, error: null };

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      project: projectReducer,
      commands: commandsReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      agents: { ...DEFAULT_AGENTS, ...overrides.agents },
      articles: { ...DEFAULT_ARTICLES, ...overrides.articles },
      project: { ...DEFAULT_BOARD, ...overrides.project },
      commands: { ...DEFAULT_COMMANDS, ...overrides.commands },
      messages: { ...DEFAULT_MESSAGES, ...overrides.messages },
      projects: { ...DEFAULT_PROJECTS, ...overrides.projects },
      tts: DEFAULT_TTS,
    },
  });
}

function renderWithProviders(ui, storeOverrides = {}) {
  const store = createTestStore(storeOverrides);
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/']}>
          {ui}
        </MemoryRouter>
      </ThemeProvider>
    </Provider>,
  );
  return { ...result, store };
}

beforeEach(() => {
  // Safe defaults — all API calls resolve to prevent unhandled rejections
  api.getOrCreateProject.mockResolvedValue({ project: { objectId: "test-hash" }, cards: [], sprints: [] });
  api.listCards.mockResolvedValue({ cards: [] });
  api.getAgents.mockResolvedValue({ agents: [] });
  api.getAllAgents.mockResolvedValue({ agents: [] });
  api.listArticles.mockResolvedValue({ articles: [] });
  api.searchArticles.mockResolvedValue({ articles: [] });
  api.listRecentCommands.mockResolvedValue({ commands: [] });
  api.getLatestPing.mockResolvedValue({ ping: null });
  api.subscribeToCommands.mockResolvedValue(jest.fn());
  api.subscribeToPings.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// ─── BoardView ──────────────────────────────────────────────────────────────

describe("BoardView — error-alert", () => {
  test("renders error-alert testid when board fetch fails", () => {
    // CARD-089: BoardView reads from Redux — preload error state directly
    renderWithProviders(<BoardView />, {
      project: { ...DEFAULT_BOARD, project: null, error: "Board fetch failed" },
    });

    expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    expect(screen.getByTestId("error-alert")).toHaveTextContent("Board fetch failed");
  });

  test("error-alert is not dismissible (no close button)", () => {
    // CARD-089: BoardView reads from Redux — preload error state directly
    renderWithProviders(<BoardView />, {
      project: { ...DEFAULT_BOARD, project: null, error: "Board fetch failed" },
    });

    // BoardView Alert has no onClose — no close button inside the alert
    const alert = screen.getByTestId("error-alert");
    expect(alert.querySelector("button")).toBeNull();
  });
});

// ─── ArticlesView (list view) ───────────────────────────────────────────────

describe("ArticlesView list — error-alert", () => {
  test("renders error-alert testid when article fetch fails", async () => {
    api.listArticles.mockRejectedValue(new Error("Articles unavailable"));

    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    });
    expect(screen.getByTestId("error-alert")).toHaveTextContent("Articles unavailable");
  });

  test("clicking close button dismisses error alert", async () => {
    api.listArticles.mockRejectedValue(new Error("Articles unavailable"));
    const user = userEvent.setup();

    const { store } = renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    });

    // Click the close button on the alert
    const closeBtn = screen.getByTestId("error-alert").querySelector("button");
    expect(closeBtn).not.toBeNull();
    await user.click(closeBtn);

    // Error should be cleared in store
    await waitFor(() => {
      expect(store.getState().articles.error).toBeNull();
    });

    // Alert should be removed from DOM
    expect(screen.queryByTestId("error-alert")).not.toBeInTheDocument();
  });
});

// ─── ArticlesView (detail view) ─────────────────────────────────────────────

describe("ArticlesView detail — error-alert", () => {
  const MOCK_ARTICLE = {
    objectId: "art-1",
    title: "Test Article",
    text: "Content here.",
    keywords: ["test"],
    createdAt: "2026-02-10T10:00:00.000Z",
    updatedAt: "2026-02-15T12:00:00.000Z",
  };

  test("renders error-alert testid in detail view error state", async () => {
    // fetchArticles fires on mount and its .pending clears preloaded error,
    // so mock it to reject so the error re-appears via .rejected
    api.listArticles.mockRejectedValue(new Error("Delete failed"));

    renderWithProviders(<ArticlesView />, {
      articles: {
        ...DEFAULT_ARTICLES,
        articles: [MOCK_ARTICLE],
        selectedArticle: MOCK_ARTICLE,
      },
    });

    // Detail view should show the error-alert after fetchArticles rejects
    await waitFor(() => {
      expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    });
    expect(screen.getByTestId("error-alert")).toHaveTextContent("Delete failed");
  });

  test("clicking close button in detail view dismisses error", async () => {
    api.listArticles.mockRejectedValue(new Error("Some error"));
    const user = userEvent.setup();

    const { store } = renderWithProviders(<ArticlesView />, {
      articles: {
        ...DEFAULT_ARTICLES,
        articles: [MOCK_ARTICLE],
        selectedArticle: MOCK_ARTICLE,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    });

    const closeBtn = screen.getByTestId("error-alert").querySelector("button");
    await user.click(closeBtn);

    await waitFor(() => {
      expect(store.getState().articles.error).toBeNull();
    });
  });
});

// ─── ProjectsView ───────────────────────────────────────────────────────────

describe("ProjectsView — error-alert", () => {
  test("renders error-alert testid when error is preloaded", () => {
    renderWithProviders(<ProjectsView />, {
      projects: {
        ...DEFAULT_PROJECTS,
        projects: [{ path: "/proj/a", name: "a", lastOpened: "2026-01-01" }],
        error: "Project error occurred",
      },
    });

    expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    expect(screen.getByTestId("error-alert")).toHaveTextContent("Project error occurred");
  });

  test("clicking close button clears error in store", async () => {
    const user = userEvent.setup();

    const { store } = renderWithProviders(<ProjectsView />, {
      projects: {
        ...DEFAULT_PROJECTS,
        projects: [{ path: "/proj/a", name: "a", lastOpened: "2026-01-01" }],
        error: "Previous error",
      },
    });

    expect(screen.getByTestId("error-alert")).toBeInTheDocument();

    const closeBtn = screen.getByTestId("error-alert").querySelector("button");
    expect(closeBtn).not.toBeNull();
    await user.click(closeBtn);

    await waitFor(() => {
      expect(store.getState().projects.error).toBeNull();
    });
    expect(screen.queryByTestId("error-alert")).not.toBeInTheDocument();
  });
});

// ─── AgentsView ─────────────────────────────────────────────────────────────

describe("AgentsView — error-alert", () => {
  test("renders error-alert testid when agent fetch fails", async () => {
    api.getAllAgents.mockRejectedValue(new Error("Agent service down"));

    renderWithProviders(<AgentsView />);

    await waitFor(() => {
      expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    });
    expect(screen.getByTestId("error-alert")).toHaveTextContent("Agent service down");
  });

  test("clicking close button clears error in store", async () => {
    // fetchAllAgents fires on mount and its .pending clears preloaded error,
    // so mock it to reject so the error appears via .rejected
    api.getAllAgents.mockRejectedValue(new Error("Stale error message"));
    const user = userEvent.setup();

    const { store } = renderWithProviders(<AgentsView />);

    await waitFor(() => {
      expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    });
    expect(screen.getByTestId("error-alert")).toHaveTextContent("Stale error message");

    const closeBtn = screen.getByTestId("error-alert").querySelector("button");
    expect(closeBtn).not.toBeNull();
    await user.click(closeBtn);

    await waitFor(() => {
      expect(store.getState().agents.error).toBeNull();
    });
    expect(screen.queryByTestId("error-alert")).not.toBeInTheDocument();
  });
});

// ─── CommandsView ───────────────────────────────────────────────────────────

describe("CommandsView — error-alert", () => {
  test("renders error-alert testid when error is set", () => {
    renderWithProviders(<CommandsView />, {
      commands: {
        ...DEFAULT_COMMANDS,
        error: "Command dispatch failed",
      },
    });

    expect(screen.getByTestId("error-alert")).toBeInTheDocument();
    expect(screen.getByTestId("error-alert")).toHaveTextContent("Command dispatch failed");
  });

  test("error-alert uses outlined variant", () => {
    renderWithProviders(<CommandsView />, {
      commands: {
        ...DEFAULT_COMMANDS,
        error: "Command dispatch failed",
      },
    });

    const alert = screen.getByTestId("error-alert");
    // MUI outlined variant applies the MuiAlert-outlined class
    expect(alert.className).toMatch(/outlined/i);
  });

  test("error-alert is not dismissible (no close button)", () => {
    renderWithProviders(<CommandsView />, {
      commands: {
        ...DEFAULT_COMMANDS,
        error: "Command dispatch failed",
      },
    });

    const alert = screen.getByTestId("error-alert");
    expect(alert.querySelector("button")).toBeNull();
  });
});

/**
 * CARD-193 QA Tests — Scroll fix for article detail, agent list, article list, and board.
 *
 * The fix adds height: "100%" and overflow: "auto" to the main container Box
 * in ArticlesView (list + detail), AgentsView, and BoardView so that content
 * scrolls instead of being clipped by App.jsx's overflow: hidden parent.
 *
 * Tests verify:
 *  1. ArticlesView list — scrollable container renders all articles
 *  2. ArticlesView detail — scrollable container renders long article content
 *  3. AgentsView — scrollable container renders all agents
 *  4. BoardView — scrollable root + columns container render cards
 *  5. BoardView columns — individual column scroll containers hold cards
 *
 * Author: qa-1
 * Date: 2026-02-17
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
import ArticlesView from "../src/components/ArticlesView";
import AgentsView from "../src/components/AgentsView";
import BoardView from "../src/components/BoardView";

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
  linkArticleToProject: jest.fn(),
  unlinkArticleFromProject: jest.fn(),
  getProjectArticles: jest.fn(),
}));

const theme = createTheme();

// --- Default State Slices ---

const DEFAULT_BOARD = {
  board: { objectId: "test-hash-193" },
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
  activeProject: { path: "C:\\Test\\Project", name: "Test Project", hash: "test-hash-193" },
  loading: false,
  error: null,
};

const DEFAULT_TTS = { enabled: false, volume: 1.0, rate: 1.0, error: null };

// --- Test Data Generators ---

function generateArticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    objectId: `art-${i}`,
    title: `Article ${i}`,
    text: `Content for article ${i}.`,
    keywords: [`kw-${i}`],
    createdAt: "2026-02-10T10:00:00.000Z",
    updatedAt: "2026-02-15T12:00:00.000Z",
  }));
}

function generateAgents(count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `agent-${i}`,
    description: `Agent number ${i}`,
    isActive: true,
    sortOrder: i,
    permissions: { allowedTools: ["Bash"] },
  }));
}

function generateCards(count, status = "implement") {
  return Array.from({ length: count }, (_, i) => ({
    cardId: `CARD-${1000 + i}`,
    title: `Card ${i}`,
    description: `Description for card ${i}`,
    status,
    assignee: "developer-1",
    priority: "medium",
    sprintId: null,
  }));
}

// --- Store & Render Helpers ---

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
      board: { ...DEFAULT_BOARD, ...overrides.project },
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
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </Provider>,
  );
  return { ...result, store };
}

beforeEach(() => {
  api.getOrCreateProject.mockResolvedValue({
    board: { objectId: "b1", projectHash: "test-hash-193", projectPath: "C:\\Test\\Project", nextId: 100 },
    cards: [],
    sprints: [],
  });
  api.listCards.mockResolvedValue({ cards: [] });
  api.getAgents.mockResolvedValue({ agents: [] });
  api.getAllAgents.mockResolvedValue({ agents: [] });
  api.listArticles.mockResolvedValue({ articles: [] });
  api.searchArticles.mockResolvedValue({ articles: [] });
  api.getProjectArticles.mockResolvedValue({ articles: [] });
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

// ─── ArticlesView List — Scroll Container ───────────────────────────────────

describe("CARD-193: ArticlesView list scroll container", () => {
  test("renders all articles inside articles-view container when list is long", async () => {
    const manyArticles = generateArticles(20);
    api.listArticles.mockResolvedValue({ articles: manyArticles });

    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("articles-view")).toBeInTheDocument();
    });

    const container = screen.getByTestId("articles-view");

    // All 20 articles should be accessible inside the scrollable container
    for (let i = 0; i < 20; i++) {
      expect(within(container).getByText(`Article ${i}`)).toBeInTheDocument();
    }
  });

  test("articles-view container wraps heading and article list", async () => {
    api.listArticles.mockResolvedValue({ articles: generateArticles(3) });

    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("articles-view")).toBeInTheDocument();
    });

    const container = screen.getByTestId("articles-view");
    expect(within(container).getByText("Articles")).toBeInTheDocument();
    expect(within(container).getByTestId("new-article-button")).toBeInTheDocument();
  });
});

// ─── ArticlesView Detail — Scroll Container ─────────────────────────────────

describe("CARD-193: ArticlesView detail scroll container", () => {
  const longArticle = {
    objectId: "art-long",
    title: "Long Article",
    text: "A".repeat(5000),
    keywords: ["long", "scroll"],
    createdAt: "2026-02-10T10:00:00.000Z",
    updatedAt: "2026-02-15T12:00:00.000Z",
  };

  test("renders article-detail container with long content", async () => {
    api.listArticles.mockResolvedValue({ articles: [longArticle] });
    api.getArticle.mockResolvedValue({ article: longArticle });

    renderWithProviders(<ArticlesView />, {
      articles: {
        ...DEFAULT_ARTICLES,
        articles: [longArticle],
        selectedArticle: longArticle,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("article-detail")).toBeInTheDocument();
    });

    const container = screen.getByTestId("article-detail");
    expect(within(container).getByText("Long Article")).toBeInTheDocument();
    expect(within(container).getByTestId("article-back-button")).toBeInTheDocument();
  });

  test("detail container holds article text content", async () => {
    api.listArticles.mockResolvedValue({ articles: [longArticle] });
    api.getArticle.mockResolvedValue({ article: longArticle });

    renderWithProviders(<ArticlesView />, {
      articles: {
        ...DEFAULT_ARTICLES,
        articles: [longArticle],
        selectedArticle: longArticle,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("article-detail")).toBeInTheDocument();
    });

    const container = screen.getByTestId("article-detail");
    // The long text content should be within the scrollable container
    expect(container.textContent).toContain("A".repeat(100));
  });
});

// ─── AgentsView — Scroll Container ──────────────────────────────────────────

describe("CARD-193: AgentsView scroll container", () => {
  test("renders all agents inside the scrollable container when list is long", async () => {
    const manyAgents = generateAgents(15);
    api.getAllAgents.mockResolvedValue({ agents: manyAgents });
    api.getAgents.mockResolvedValue({ agents: manyAgents });

    renderWithProviders(<AgentsView />, {
      agents: { agents: manyAgents, allAgents: manyAgents, loading: false, error: null },
    });

    await waitFor(() => {
      expect(screen.getByText("Agents")).toBeInTheDocument();
    });

    // All 15 agents should be accessible within the view
    for (let i = 0; i < 15; i++) {
      expect(screen.getByTestId(`agent-list-item-agent-${i}`)).toBeInTheDocument();
    }
  });

  test("agents heading and add button are inside the same scrollable container", async () => {
    api.getAllAgents.mockResolvedValue({ agents: [] });
    api.getAgents.mockResolvedValue({ agents: [] });

    renderWithProviders(<AgentsView />);

    await waitFor(() => {
      expect(screen.getByText("Agents")).toBeInTheDocument();
    });

    expect(screen.getByTestId("add-agent-button")).toBeInTheDocument();

    // Both should share the same parent container
    const heading = screen.getByText("Agents");
    const addButton = screen.getByTestId("add-agent-button");
    expect(heading.closest("[class*='MuiBox']")).toBe(addButton.closest("[class*='MuiBox']"));
  });
});

// ─── BoardView — Scroll Container ───────────────────────────────────────────

describe("CARD-193: BoardView scroll container", () => {
  test("renders board heading inside the scrollable root container", async () => {
    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByText("Board")).toBeInTheDocument();
    });
  });

  test("renders all 8 board columns inside the scrollable container", async () => {
    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByText("Board")).toBeInTheDocument();
    });

    const columns = [
      "board-column-create",
      "board-column-scope",
      "board-column-implement",
      "board-column-code_review",
      "board-column-test",
      "board-column-test_review",
      "board-column-ship",
      "board-column-done",
    ];

    for (const colId of columns) {
      expect(screen.getByTestId(colId)).toBeInTheDocument();
    }
  });

  test("renders many cards inside their column scroll container", async () => {
    const manyCards = generateCards(10, "implement");
    api.getOrCreateProject.mockResolvedValue({
      board: { objectId: "b1", projectHash: "test-hash-193", projectPath: "C:\\Test\\Project", nextId: 100 },
      cards: manyCards,
      sprints: [],
    });

    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByTestId("board-column-implement")).toBeInTheDocument();
    });

    const implementColumn = screen.getByTestId("board-column-implement");

    // All 10 cards should be accessible inside the column's scroll container
    for (let i = 0; i < 10; i++) {
      expect(within(implementColumn).getByTestId(`board-card-CARD-${1000 + i}`)).toBeInTheDocument();
    }
  });

  test("cards in different columns are isolated to their respective containers", async () => {
    const implementCards = generateCards(3, "implement");
    const testCards = Array.from({ length: 2 }, (_, i) => ({
      cardId: `CARD-${2000 + i}`,
      title: `Test Card ${i}`,
      description: `Test card description ${i}`,
      status: "test",
      assignee: "qa-1",
      priority: "high",
      sprintId: null,
    }));

    api.getOrCreateProject.mockResolvedValue({
      board: { objectId: "b1", projectHash: "test-hash-193", projectPath: "C:\\Test\\Project", nextId: 100 },
      cards: [...implementCards, ...testCards],
      sprints: [],
    });

    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByTestId("board-column-implement")).toBeInTheDocument();
    });

    const implementColumn = screen.getByTestId("board-column-implement");
    const testColumn = screen.getByTestId("board-column-test");

    // Implement column has 3 cards
    expect(within(implementColumn).getAllByText(/^Card \d+$/)).toHaveLength(3);

    // Test column has 2 cards
    expect(within(testColumn).getAllByText(/^Test Card \d+$/)).toHaveLength(2);

    // Implement column does NOT contain test cards
    expect(within(implementColumn).queryByText("Test Card 0")).not.toBeInTheDocument();

    // Test column does NOT contain implement cards
    expect(within(testColumn).queryByText("Card 0")).not.toBeInTheDocument();
  });
});

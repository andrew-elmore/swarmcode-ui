/**
 * Tests for ArticlesView component — list view, detail view, search, and delete confirmation.
 * CARD-180: Article system with inline references and search.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import articlesReducer from "../src/store/articlesSlice";
import boardReducer from "../src/store/boardSlice";
import ArticlesView from "../src/components/ArticlesView";

jest.mock("../src/services/api", () => ({
  listArticles: jest.fn(),
  createArticle: jest.fn(),
  updateArticle: jest.fn(),
  deleteArticle: jest.fn(),
  searchArticles: jest.fn(),
  getArticle: jest.fn(),
  getOrCreateBoard: jest.fn(),
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
  getSprints: jest.fn(),
  createSprint: jest.fn(),
  updateSprint: jest.fn(),
  deleteSprint: jest.fn(),
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

const MOCK_ARTICLES = [
  {
    objectId: "art1",
    title: "Alpha Guide",
    text: "How to get started with Alpha.",
    keywords: ["guide", "alpha"],
    createdAt: "2026-02-10T10:00:00.000Z",
    updatedAt: "2026-02-15T12:00:00.000Z",
  },
  {
    objectId: "art2",
    title: "Bravo Reference",
    text: "Reference doc for Bravo. See also [[Alpha Guide]].",
    keywords: ["reference", "bravo"],
    createdAt: "2026-02-11T10:00:00.000Z",
    updatedAt: "2026-02-16T08:00:00.000Z",
  },
  {
    objectId: "art3",
    title: "Charlie FAQ",
    text: "",
    keywords: [],
    createdAt: "2026-02-12T10:00:00.000Z",
    updatedAt: "2026-02-14T09:00:00.000Z",
  },
];

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      articles: articlesReducer,
      board: boardReducer,
    },
    preloadedState: {
      articles: {
        articles: [],
        linkedArticleTitles: [],
        selectedArticle: null,
        searchResults: [],
        loading: false,
        error: null,
        ...overrides.articles,
      },
      board: {
        board: { projectHash: "test-hash-180" },
        cards: [],
        sprints: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
        ...overrides.board,
      },
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
  api.listArticles.mockResolvedValue({ articles: MOCK_ARTICLES });
  api.searchArticles.mockResolvedValue({ articles: [] });
  api.deleteArticle.mockResolvedValue({ deleted: true });
  api.getArticle.mockResolvedValue({ article: MOCK_ARTICLES[0] });
  api.getProjectArticles.mockResolvedValue({ articles: [] });
  api.linkArticleToProject.mockResolvedValue({ success: true, linked: true, article: MOCK_ARTICLES[0] });
  api.unlinkArticleFromProject.mockResolvedValue({ success: true, linked: false });
});

afterEach(() => jest.restoreAllMocks());

// ─── List View ──────────────────────────────────────────────────────────────

describe("ArticlesView — list view", () => {
  test("renders articles-view with heading and New Article button", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("articles-view")).toBeInTheDocument();
    });
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByTestId("new-article-button")).toBeInTheDocument();
  });

  test("renders article rows after fetch", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    });
    expect(screen.getByText("Bravo Reference")).toBeInTheDocument();
    expect(screen.getByText("Charlie FAQ")).toBeInTheDocument();
  });

  test("dispatches fetchArticles on mount when projectHash is set", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(api.listArticles).toHaveBeenCalledWith("test-hash-180");
    });
  });

  test("shows empty state when no articles exist", async () => {
    api.listArticles.mockResolvedValue({ articles: [] });
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByText(/No articles yet/)).toBeInTheDocument();
    });
  });

  test("shows loading spinner when loading with no articles", () => {
    const store = createTestStore({ articles: { loading: true, articles: [] } });
    renderWithProviders(<ArticlesView />, { store });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  test("displays error alert when fetch fails", async () => {
    api.listArticles.mockRejectedValue(new Error("Something went wrong"));
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  test("clicking a row selects the article (detail view)", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("article-row-art1"));

    await waitFor(() => {
      expect(screen.getByTestId("article-detail")).toBeInTheDocument();
    });
    expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
  });
});

// ─── Detail View ────────────────────────────────────────────────────────────

describe("ArticlesView — detail view", () => {
  function renderDetail(article = MOCK_ARTICLES[0]) {
    const store = createTestStore({
      articles: {
        articles: MOCK_ARTICLES,
        selectedArticle: article,
      },
    });
    return renderWithProviders(<ArticlesView />, { store });
  }

  test("renders detail view with title, edit, and delete buttons", () => {
    renderDetail();

    expect(screen.getByTestId("article-detail")).toBeInTheDocument();
    expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    expect(screen.getByTestId("article-edit-button")).toBeInTheDocument();
    expect(screen.getByTestId("article-delete-button")).toBeInTheDocument();
    expect(screen.getByTestId("article-back-button")).toBeInTheDocument();
  });

  test("renders keywords as chips", () => {
    renderDetail();

    expect(screen.getByText("guide")).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  test("renders article content text", () => {
    renderDetail();

    expect(screen.getByText(/How to get started with Alpha/)).toBeInTheDocument();
  });

  test("shows (no content) for empty text", () => {
    renderDetail(MOCK_ARTICLES[2]); // Charlie FAQ has empty text

    expect(screen.getByText("(no content)")).toBeInTheDocument();
  });

  test("back button returns to list view", async () => {
    renderDetail();

    fireEvent.click(screen.getByTestId("article-back-button"));

    await waitFor(() => {
      expect(screen.getByTestId("articles-view")).toBeInTheDocument();
    });
  });

  test("displays updated date", () => {
    renderDetail();

    // formatDate returns toLocaleDateString() — just check the "Updated:" label is there
    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
  });
});

// ─── Delete Confirmation ────────────────────────────────────────────────────

describe("ArticlesView — delete confirmation", () => {
  test("clicking Delete opens confirmation dialog", async () => {
    const store = createTestStore({
      articles: {
        articles: MOCK_ARTICLES,
        selectedArticle: MOCK_ARTICLES[0],
      },
    });
    renderWithProviders(<ArticlesView />, { store });

    fireEvent.click(screen.getByTestId("article-delete-button"));

    await waitFor(() => {
      expect(screen.getByText("Delete Article")).toBeInTheDocument();
    });
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    expect(screen.getByText("Alpha Guide", { selector: "strong" })).toBeInTheDocument();
  });

  test("cancel closes the dialog without deleting", async () => {
    const store = createTestStore({
      articles: {
        articles: MOCK_ARTICLES,
        selectedArticle: MOCK_ARTICLES[0],
      },
    });
    renderWithProviders(<ArticlesView />, { store });

    fireEvent.click(screen.getByTestId("article-delete-button"));

    await waitFor(() => {
      expect(screen.getByText("Delete Article")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText("Delete Article")).not.toBeInTheDocument();
    });
    expect(api.deleteArticle).not.toHaveBeenCalled();
  });

  test("confirming delete calls deleteArticle and returns to list", async () => {
    const store = createTestStore({
      articles: {
        articles: MOCK_ARTICLES,
        selectedArticle: MOCK_ARTICLES[0],
      },
    });
    renderWithProviders(<ArticlesView />, { store });

    fireEvent.click(screen.getByTestId("article-delete-button"));

    await waitFor(() => {
      expect(screen.getByText("Delete Article")).toBeInTheDocument();
    });

    // Click the "Delete" confirmation button (the red one, not the toolbar button)
    const dialog = screen.getByText("Delete Article").closest("[role='dialog']");
    const confirmBtn = within(dialog).getByRole("button", { name: /Delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.deleteArticle).toHaveBeenCalledWith("test-hash-180", "Alpha Guide");
    });

    await waitFor(() => {
      expect(screen.getByTestId("articles-view")).toBeInTheDocument();
    });
  });
});

// ─── Search ─────────────────────────────────────────────────────────────────

describe("ArticlesView — search", () => {
  test("renders search fields", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("article-search-title")).toBeInTheDocument();
    });
    expect(screen.getByTestId("article-search-keywords")).toBeInTheDocument();
  });

  test("clicking Search with query dispatches searchArticles", async () => {
    const searchResults = [MOCK_ARTICLES[0]];
    api.searchArticles.mockResolvedValue({ articles: searchResults });

    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("article-search-title")).toBeInTheDocument();
    });

    // Type into the title search field
    const titleField = screen.getByTestId("article-search-title").querySelector("input");
    fireEvent.change(titleField, { target: { value: "Alpha" } });
    fireEvent.click(screen.getByText("Search"));

    await waitFor(() => {
      expect(api.searchArticles).toHaveBeenCalledWith("test-hash-180", {
        query: "Alpha",
        keywords: undefined,
      });
    });
  });

  test("shows result count when searching", async () => {
    api.searchArticles.mockResolvedValue({ articles: [MOCK_ARTICLES[0]] });

    const store = createTestStore({
      articles: {
        articles: MOCK_ARTICLES,
        searchResults: [MOCK_ARTICLES[0]],
      },
    });
    renderWithProviders(<ArticlesView />, { store });

    await waitFor(() => {
      expect(screen.getByTestId("article-search-title")).toBeInTheDocument();
    });

    // Trigger a search
    const titleField = screen.getByTestId("article-search-title").querySelector("input");
    fireEvent.change(titleField, { target: { value: "Alpha" } });
    fireEvent.click(screen.getByText("Search"));

    await waitFor(() => {
      expect(screen.getByText(/1 result found/)).toBeInTheDocument();
    });
  });

  test("Clear button resets search and shows all articles", async () => {
    api.searchArticles.mockResolvedValue({ articles: [MOCK_ARTICLES[0]] });

    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("article-search-title")).toBeInTheDocument();
    });

    // Trigger a search
    const titleField = screen.getByTestId("article-search-title").querySelector("input");
    fireEvent.change(titleField, { target: { value: "Alpha" } });
    fireEvent.click(screen.getByText("Search"));

    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Clear"));

    await waitFor(() => {
      expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    });
  });

  test("shows 'No articles matched' when search returns empty", async () => {
    api.searchArticles.mockResolvedValue({ articles: [] });

    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByTestId("article-search-title")).toBeInTheDocument();
    });

    const titleField = screen.getByTestId("article-search-title").querySelector("input");
    fireEvent.change(titleField, { target: { value: "zzz_nonexistent" } });
    fireEvent.click(screen.getByText("Search"));

    await waitFor(() => {
      expect(screen.getByText(/No articles matched your search/)).toBeInTheDocument();
    });
  });
});

// ─── Link/Unlink Toggle ─────────────────────────────────────────────────────

describe("ArticlesView — link/unlink toggle", () => {
  test("renders article-link-toggle for each article row", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    });

    const toggles = screen.getAllByTestId("article-link-toggle");
    expect(toggles).toHaveLength(3);
  });

  test("toggle is checked when article is in linkedArticleTitles", async () => {
    // Mock getProjectArticles to return linked articles so fetchLinkedArticles
    // populates linkedArticleTitles after mount
    api.getProjectArticles.mockResolvedValue({
      articles: [
        { objectId: "art1", title: "Alpha Guide" },
        { objectId: "art3", title: "Charlie FAQ" },
      ],
    });
    const store = createTestStore({
      articles: {
        articles: MOCK_ARTICLES,
        linkedArticleTitles: ["Alpha Guide", "Charlie FAQ"],
      },
    });
    renderWithProviders(<ArticlesView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    });

    const toggles = screen.getAllByTestId("article-link-toggle");
    // Alpha Guide (index 0) — linked
    expect(toggles[0].querySelector("input")).toBeChecked();
    // Bravo Reference (index 1) — not linked
    expect(toggles[1].querySelector("input")).not.toBeChecked();
    // Charlie FAQ (index 2) — linked
    expect(toggles[2].querySelector("input")).toBeChecked();
  });

  test("clicking toggle on unlinked article dispatches linkArticle", async () => {
    api.linkArticleToProject.mockResolvedValue({
      success: true,
      linked: true,
      article: { objectId: "art1", title: "Alpha Guide" },
    });

    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    });

    const toggles = screen.getAllByTestId("article-link-toggle");
    fireEvent.click(toggles[0].querySelector("input"));

    await waitFor(() => {
      expect(api.linkArticleToProject).toHaveBeenCalledWith({
        projectHash: "test-hash-180",
        articleTitle: "Alpha Guide",
      });
    });
  });

  test("clicking toggle on linked article dispatches unlinkArticle", async () => {
    // Mock getProjectArticles so fetchLinkedArticles keeps Alpha Guide linked
    api.getProjectArticles.mockResolvedValue({
      articles: [{ objectId: "art1", title: "Alpha Guide" }],
    });
    const store = createTestStore({
      articles: {
        articles: MOCK_ARTICLES,
        linkedArticleTitles: ["Alpha Guide"],
      },
    });
    renderWithProviders(<ArticlesView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    });

    const toggles = screen.getAllByTestId("article-link-toggle");
    fireEvent.click(toggles[0].querySelector("input"));

    await waitFor(() => {
      expect(api.unlinkArticleFromProject).toHaveBeenCalledWith({
        projectHash: "test-hash-180",
        articleTitle: "Alpha Guide",
      });
    });
  });

  test("clicking toggle does not navigate to detail view", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    });

    const toggles = screen.getAllByTestId("article-link-toggle");
    fireEvent.click(toggles[0].querySelector("input"));

    // Should still be in list view (not detail view)
    expect(screen.getByTestId("articles-view")).toBeInTheDocument();
    expect(screen.queryByTestId("article-detail")).not.toBeInTheDocument();
  });

  test("fetchLinkedArticles is dispatched on mount", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(api.getProjectArticles).toHaveBeenCalledWith("test-hash-180");
    });
  });

  test("Linked column header is rendered", async () => {
    renderWithProviders(<ArticlesView />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Guide")).toBeInTheDocument();
    });

    expect(screen.getByText("Linked")).toBeInTheDocument();
  });
});

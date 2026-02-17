/**
 * Tests for store/articlesSlice.js — Redux slice for articles state management.
 * CARD-180: Article system with inline references and search.
 * API calls are mocked at the services/api module level.
 */

import { configureStore } from "@reduxjs/toolkit";
import * as api from "../src/services/api";
import articlesReducer, {
  fetchArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  searchArticles,
  getArticle,
  clearError,
  setSelectedArticle,
  clearSearch,
} from "../src/store/articlesSlice";

jest.mock("../src/services/api", () => ({
  listArticles: jest.fn(),
  createArticle: jest.fn(),
  updateArticle: jest.fn(),
  deleteArticle: jest.fn(),
  searchArticles: jest.fn(),
  getArticle: jest.fn(),
}));

function createTestStore(preloadedArticles) {
  return configureStore({
    reducer: { articles: articlesReducer },
    preloadedState: preloadedArticles
      ? { articles: { ...articlesReducer(undefined, { type: "@@INIT" }), ...preloadedArticles } }
      : undefined,
  });
}

afterEach(() => jest.restoreAllMocks());

// ─── Initial State ──────────────────────────────────────────────────────────

describe("articlesSlice initial state", () => {
  test("has correct default values", () => {
    const store = createTestStore();
    const state = store.getState().articles;
    expect(state.articles).toEqual([]);
    expect(state.selectedArticle).toBeNull();
    expect(state.searchResults).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});

// ─── Synchronous Reducers ───────────────────────────────────────────────────

describe("articlesSlice reducers", () => {
  test("clearError resets error to null", () => {
    const store = createTestStore({ error: "Something failed" });
    store.dispatch(clearError());
    expect(store.getState().articles.error).toBeNull();
  });

  test("setSelectedArticle sets the selected article", () => {
    const article = { objectId: "a1", title: "Test" };
    const store = createTestStore();
    store.dispatch(setSelectedArticle(article));
    expect(store.getState().articles.selectedArticle).toEqual(article);
  });

  test("setSelectedArticle to null clears selection", () => {
    const store = createTestStore({ selectedArticle: { objectId: "a1", title: "Test" } });
    store.dispatch(setSelectedArticle(null));
    expect(store.getState().articles.selectedArticle).toBeNull();
  });

  test("clearSearch resets searchResults to empty array", () => {
    const store = createTestStore({ searchResults: [{ objectId: "a1", title: "Found" }] });
    store.dispatch(clearSearch());
    expect(store.getState().articles.searchResults).toEqual([]);
  });
});

// ─── fetchArticles ──────────────────────────────────────────────────────────

describe("fetchArticles thunk", () => {
  test("sets loading on pending, populates articles on fulfilled", async () => {
    const mockArticles = [
      { objectId: "a1", title: "Alpha" },
      { objectId: "a2", title: "Bravo" },
    ];
    api.listArticles.mockResolvedValue({ articles: mockArticles });

    const store = createTestStore();
    await store.dispatch(fetchArticles("hash123"));

    const state = store.getState().articles;
    expect(state.loading).toBe(false);
    expect(state.articles).toEqual(mockArticles);
    expect(state.error).toBeNull();
  });

  test("sets error on rejected", async () => {
    api.listArticles.mockRejectedValue(new Error("Network error"));

    const store = createTestStore();
    await store.dispatch(fetchArticles("hash123"));

    const state = store.getState().articles;
    expect(state.loading).toBe(false);
    expect(state.error).toBe("Network error");
  });
});

// ─── createArticle ──────────────────────────────────────────────────────────

describe("createArticle thunk", () => {
  test("appends new article and sorts alphabetically by title", async () => {
    const newArticle = { objectId: "a3", title: "Bravo" };
    api.createArticle.mockResolvedValue({ article: newArticle });

    const store = createTestStore({
      articles: [
        { objectId: "a1", title: "Alpha" },
        { objectId: "a2", title: "Charlie" },
      ],
    });
    await store.dispatch(createArticle({ projectHash: "h1", title: "Bravo" }));

    const titles = store.getState().articles.articles.map((a) => a.title);
    expect(titles).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  test("sets error on rejected", async () => {
    api.createArticle.mockRejectedValue(new Error("Article with title 'X' already exists"));

    const store = createTestStore();
    await store.dispatch(createArticle({ projectHash: "h1", title: "X" }));

    expect(store.getState().articles.error).toBe("Article with title 'X' already exists");
  });
});

// ─── updateArticle ──────────────────────────────────────────────────────────

describe("updateArticle thunk", () => {
  test("updates article in-place by objectId and re-sorts", async () => {
    const updated = { objectId: "a1", title: "Zeta", text: "New text" };
    api.updateArticle.mockResolvedValue({ article: updated, changes: "title, text updated" });

    const store = createTestStore({
      articles: [
        { objectId: "a1", title: "Alpha", text: "Old text" },
        { objectId: "a2", title: "Bravo", text: "" },
      ],
    });
    await store.dispatch(updateArticle({ projectHash: "h1", title: "Alpha", newTitle: "Zeta", text: "New text" }));

    const articles = store.getState().articles.articles;
    expect(articles[0].title).toBe("Bravo");
    expect(articles[1].title).toBe("Zeta");
    expect(articles[1].text).toBe("New text");
  });

  test("updates selectedArticle if it matches the updated article", async () => {
    const updated = { objectId: "a1", title: "Alpha", text: "Edited" };
    api.updateArticle.mockResolvedValue({ article: updated });

    const store = createTestStore({
      articles: [{ objectId: "a1", title: "Alpha", text: "Original" }],
      selectedArticle: { objectId: "a1", title: "Alpha", text: "Original" },
    });
    await store.dispatch(updateArticle({ projectHash: "h1", title: "Alpha", text: "Edited" }));

    expect(store.getState().articles.selectedArticle.text).toBe("Edited");
  });

  test("does not update selectedArticle if objectId differs", async () => {
    const updated = { objectId: "a2", title: "Bravo", text: "Changed" };
    api.updateArticle.mockResolvedValue({ article: updated });

    const store = createTestStore({
      articles: [{ objectId: "a2", title: "Bravo", text: "Old" }],
      selectedArticle: { objectId: "a1", title: "Alpha", text: "Untouched" },
    });
    await store.dispatch(updateArticle({ projectHash: "h1", title: "Bravo", text: "Changed" }));

    expect(store.getState().articles.selectedArticle.text).toBe("Untouched");
  });

  test("sets error on rejected", async () => {
    api.updateArticle.mockRejectedValue(new Error("No changes specified"));

    const store = createTestStore();
    await store.dispatch(updateArticle({ projectHash: "h1", title: "Alpha" }));

    expect(store.getState().articles.error).toBe("No changes specified");
  });
});

// ─── deleteArticle ──────────────────────────────────────────────────────────

describe("deleteArticle thunk", () => {
  test("removes article from list by title", async () => {
    api.deleteArticle.mockResolvedValue({ deleted: true });

    const store = createTestStore({
      articles: [
        { objectId: "a1", title: "Alpha" },
        { objectId: "a2", title: "Bravo" },
      ],
    });
    await store.dispatch(deleteArticle({ projectHash: "h1", title: "Alpha" }));

    const articles = store.getState().articles.articles;
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Bravo");
  });

  test("clears selectedArticle if it matches deleted title", async () => {
    api.deleteArticle.mockResolvedValue({ deleted: true });

    const store = createTestStore({
      articles: [{ objectId: "a1", title: "Alpha" }],
      selectedArticle: { objectId: "a1", title: "Alpha" },
    });
    await store.dispatch(deleteArticle({ projectHash: "h1", title: "Alpha" }));

    expect(store.getState().articles.selectedArticle).toBeNull();
  });

  test("does not clear selectedArticle if titles differ", async () => {
    api.deleteArticle.mockResolvedValue({ deleted: true });

    const store = createTestStore({
      articles: [
        { objectId: "a1", title: "Alpha" },
        { objectId: "a2", title: "Bravo" },
      ],
      selectedArticle: { objectId: "a2", title: "Bravo" },
    });
    await store.dispatch(deleteArticle({ projectHash: "h1", title: "Alpha" }));

    expect(store.getState().articles.selectedArticle.title).toBe("Bravo");
  });

  test("sets error on rejected", async () => {
    api.deleteArticle.mockRejectedValue(new Error("Article 'X' not found"));

    const store = createTestStore();
    await store.dispatch(deleteArticle({ projectHash: "h1", title: "X" }));

    expect(store.getState().articles.error).toBe("Article 'X' not found");
  });
});

// ─── searchArticles ─────────────────────────────────────────────────────────

describe("searchArticles thunk", () => {
  test("sets loading on pending, populates searchResults on fulfilled", async () => {
    const results = [{ objectId: "a1", title: "API Auth" }];
    api.searchArticles.mockResolvedValue({ articles: results });

    const store = createTestStore();
    await store.dispatch(searchArticles({ projectHash: "h1", query: "API" }));

    const state = store.getState().articles;
    expect(state.loading).toBe(false);
    expect(state.searchResults).toEqual(results);
    expect(state.error).toBeNull();
  });

  test("sets error on rejected", async () => {
    api.searchArticles.mockRejectedValue(new Error("At least one of query or keywords is required"));

    const store = createTestStore();
    await store.dispatch(searchArticles({ projectHash: "h1" }));

    const state = store.getState().articles;
    expect(state.loading).toBe(false);
    expect(state.error).toBe("At least one of query or keywords is required");
  });
});

// ─── getArticle ─────────────────────────────────────────────────────────────

describe("getArticle thunk", () => {
  test("sets selectedArticle on fulfilled", async () => {
    const article = { objectId: "a1", title: "Found Article", text: "Body" };
    api.getArticle.mockResolvedValue({ article });

    const store = createTestStore();
    await store.dispatch(getArticle({ projectHash: "h1", title: "Found Article" }));

    expect(store.getState().articles.selectedArticle).toEqual(article);
  });

  test("sets error on rejected", async () => {
    api.getArticle.mockRejectedValue(new Error("Article 'Ghost' not found"));

    const store = createTestStore();
    await store.dispatch(getArticle({ projectHash: "h1", title: "Ghost" }));

    expect(store.getState().articles.error).toBe("Article 'Ghost' not found");
  });
});

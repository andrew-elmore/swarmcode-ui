/**
 * Tests for store/projectSlice.js — Redux slice for board state management.
 * API calls are mocked at the services/api module level.
 */

import { configureStore } from "@reduxjs/toolkit";
import * as api from "../src/services/api";
import projectReducer, { fetchProject, createCard, updateCard, addComment, fetchCards, fetchCard, clearError, clearSelectedCard } from "../src/store/projectSlice";

jest.mock("../src/services/api", () => ({
  getOrCreateProject: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
}));

function createTestStore(preloadedState) {
  return configureStore({
    reducer: { project: projectReducer },
    preloadedState: preloadedState
      ? { project: { ...projectReducer(undefined, { type: "@@INIT" }), ...preloadedState } }
      : undefined,
  });
}

afterEach(() => jest.restoreAllMocks());

// ─── Initial State ───────────────────────────────────────────────────────────

describe("projectSlice initial state", () => {
  test("has correct default values", () => {
    const store = createTestStore();
    const state = store.getState().project;
    expect(state.project).toBeNull();
    expect(state.cards).toEqual([]);
    expect(state.selectedCard).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastPoll).toBeNull();
  });
});

// ─── Synchronous Reducers ────────────────────────────────────────────────────

describe("projectSlice reducers", () => {
  test("clearError resets error to null", () => {
    const store = createTestStore({ error: "Some error" });
    store.dispatch(clearError());
    expect(store.getState().project.error).toBeNull();
  });

  test("clearSelectedCard resets selectedCard to null", () => {
    const store = createTestStore({ selectedCard: { cardId: "CARD-001" } });
    store.dispatch(clearSelectedCard());
    expect(store.getState().project.selectedCard).toBeNull();
  });
});

// ─── fetchProject ──────────────────────────────────────────────────────────────

describe("fetchProject thunk", () => {
  test("sets loading on pending, populates board and cards on fulfilled", async () => {
    const mockBoard = { objectId: "b1", nextId: 3 };
    const mockCards = [{ cardId: "CARD-001", title: "Test" }];
    api.getOrCreateProject.mockResolvedValue({ project: mockBoard, cards: mockCards });

    const store = createTestStore();
    await store.dispatch(fetchProject("C:\\test\\project"));

    const state = store.getState().project;
    expect(state.loading).toBe(false);
    expect(state.project).toEqual(mockBoard);
    expect(state.cards).toEqual(mockCards);
    expect(state.lastPoll).toBeDefined();
    expect(state.error).toBeNull();
  });

  test("sets error on rejected", async () => {
    api.getOrCreateProject.mockRejectedValue(new Error("Network error"));

    const store = createTestStore();
    await store.dispatch(fetchProject("C:\\bad\\path"));

    const state = store.getState().project;
    expect(state.loading).toBe(false);
    expect(state.error).toBe("Network error");
  });
});

// ─── createCard ──────────────────────────────────────────────────────────────

describe("createCard thunk", () => {
  test("appends new card to cards array on fulfilled", async () => {
    const newCard = { cardId: "CARD-002", title: "New Card", status: "scope" };
    api.createCard.mockResolvedValue({ card: newCard });

    const store = createTestStore({
      cards: [{ cardId: "CARD-001", title: "Existing" }],
    });
    await store.dispatch(createCard({ projectId: "abc", title: "New Card", author: "qa-1" }));

    const cards = store.getState().project.cards;
    expect(cards).toHaveLength(2);
    expect(cards[1]).toEqual(newCard);
  });

  test("sets error on rejected", async () => {
    api.createCard.mockRejectedValue(new Error("Title is required"));

    const store = createTestStore();
    await store.dispatch(createCard({ projectId: "abc", author: "qa-1" }));

    expect(store.getState().project.error).toBe("Title is required");
  });
});

// ─── updateCard ──────────────────────────────────────────────────────────────

describe("updateCard thunk", () => {
  test("updates card in array by cardId on fulfilled", async () => {
    const updatedCard = { cardId: "CARD-001", title: "Test", status: "done" };
    api.updateCard.mockResolvedValue({ card: updatedCard, changes: "status: scope -> done" });

    const store = createTestStore({
      cards: [{ cardId: "CARD-001", title: "Test", status: "scope" }],
    });
    await store.dispatch(updateCard({ projectId: "abc", cardId: "CARD-001", status: "done", author: "qa-1" }));

    expect(store.getState().project.cards[0].status).toBe("done");
  });

  test("updates selectedCard if it matches", async () => {
    const updatedCard = { cardId: "CARD-001", title: "Test", status: "done" };
    api.updateCard.mockResolvedValue({ card: updatedCard });

    const store = createTestStore({
      cards: [{ cardId: "CARD-001", title: "Test", status: "scope" }],
      selectedCard: { cardId: "CARD-001", title: "Test", status: "scope" },
    });
    await store.dispatch(updateCard({ projectId: "abc", cardId: "CARD-001", status: "done", author: "qa-1" }));

    expect(store.getState().project.selectedCard.status).toBe("done");
  });

  test("sets error on rejected", async () => {
    api.updateCard.mockRejectedValue(new Error("No changes specified"));

    const store = createTestStore();
    await store.dispatch(updateCard({ projectId: "abc", cardId: "CARD-001", author: "qa-1" }));

    expect(store.getState().project.error).toBe("No changes specified");
  });
});

// ─── addComment ──────────────────────────────────────────────────────────────

describe("addComment thunk", () => {
  test("appends comment to selectedCard on fulfilled", async () => {
    const newComment = { objectId: "c1", author: "qa-1", message: "Test" };
    api.addComment.mockResolvedValue({ comment: newComment });

    const store = createTestStore({
      selectedCard: { cardId: "CARD-001", comments: [] },
    });
    await store.dispatch(addComment({ projectId: "abc", cardId: "CARD-001", message: "Test", author: "qa-1" }));

    expect(store.getState().project.selectedCard.comments).toHaveLength(1);
    expect(store.getState().project.selectedCard.comments[0]).toEqual(newComment);
  });

  test("sets error on rejected", async () => {
    api.addComment.mockRejectedValue(new Error("message is required"));

    const store = createTestStore();
    await store.dispatch(addComment({ projectId: "abc", cardId: "CARD-001", message: "", author: "qa-1" }));

    expect(store.getState().project.error).toBe("message is required");
  });
});

// ─── fetchCards ──────────────────────────────────────────────────────────────

// CARD-231: fetchCards thunk forwards sprint param to api.listCards
describe("fetchCards thunk", () => {
  test("replaces cards array on fulfilled", async () => {
    const cards = [{ cardId: "CARD-001" }, { cardId: "CARD-002" }];
    api.listCards.mockResolvedValue({ cards });

    const store = createTestStore({ cards: [{ cardId: "OLD" }] });
    await store.dispatch(fetchCards({ projectId: "abc" }));

    expect(store.getState().project.cards).toEqual(cards);
  });

  test("passes sprint param to api.listCards when sprint is provided", async () => {
    const cards = [{ cardId: "CARD-005", sprint: "Sprint 1" }];
    api.listCards.mockResolvedValue({ cards });

    const store = createTestStore();
    await store.dispatch(fetchCards({ projectId: "abc", sprint: "Sprint 1" }));

    expect(api.listCards).toHaveBeenCalledWith("abc", undefined, "Sprint 1");
    expect(store.getState().project.cards).toEqual(cards);
  });

  test("passes undefined sprint to api.listCards when sprint is not provided", async () => {
    api.listCards.mockResolvedValue({ cards: [] });

    const store = createTestStore();
    await store.dispatch(fetchCards({ projectId: "abc" }));

    expect(api.listCards).toHaveBeenCalledWith("abc", undefined, undefined);
  });

  test("passes status and sprint together to api.listCards", async () => {
    api.listCards.mockResolvedValue({ cards: [] });

    const store = createTestStore();
    await store.dispatch(fetchCards({ projectId: "abc", status: "implement", sprint: "Sprint 2" }));

    expect(api.listCards).toHaveBeenCalledWith("abc", "implement", "Sprint 2");
  });

  test("sprint filter result replaces cards array", async () => {
    const allCards = [{ cardId: "CARD-001" }, { cardId: "CARD-002" }];
    const sprintCards = [{ cardId: "CARD-002", sprint: "Sprint 1" }];

    api.listCards.mockResolvedValue({ cards: allCards });
    const store = createTestStore();
    await store.dispatch(fetchCards({ projectId: "abc" }));
    expect(store.getState().project.cards).toEqual(allCards);

    api.listCards.mockResolvedValue({ cards: sprintCards });
    await store.dispatch(fetchCards({ projectId: "abc", sprint: "Sprint 1" }));
    expect(store.getState().project.cards).toEqual(sprintCards);
  });
});

// ─── fetchCard ───────────────────────────────────────────────────────────────

describe("fetchCard thunk", () => {
  test("sets selectedCard on fulfilled", async () => {
    const card = { cardId: "CARD-001", title: "Test", comments: [] };
    api.showCard.mockResolvedValue({ card });

    const store = createTestStore();
    await store.dispatch(fetchCard({ projectId: "abc", cardId: "CARD-001" }));

    expect(store.getState().project.selectedCard).toEqual(card);
  });
});


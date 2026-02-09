/**
 * Tests for store/boardSlice.js — Redux slice for board state management.
 * API calls are mocked at the services/api module level.
 */

import { configureStore } from "@reduxjs/toolkit";
import * as api from "../src/services/api";
import boardReducer, { fetchBoard, createCard, updateCard, addComment, fetchCards, fetchCard, pollBoard, clearError, clearSelectedCard } from "../src/store/boardSlice";

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
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
}));

function createTestStore(preloadedState) {
  return configureStore({
    reducer: { board: boardReducer },
    preloadedState: preloadedState
      ? { board: { ...boardReducer(undefined, { type: "@@INIT" }), ...preloadedState } }
      : undefined,
  });
}

afterEach(() => jest.restoreAllMocks());

// ─── Initial State ───────────────────────────────────────────────────────────

describe("boardSlice initial state", () => {
  test("has correct default values", () => {
    const store = createTestStore();
    const state = store.getState().board;
    expect(state.board).toBeNull();
    expect(state.cards).toEqual([]);
    expect(state.selectedCard).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastPoll).toBeNull();
  });
});

// ─── Synchronous Reducers ────────────────────────────────────────────────────

describe("boardSlice reducers", () => {
  test("clearError resets error to null", () => {
    const store = createTestStore({ error: "Some error" });
    store.dispatch(clearError());
    expect(store.getState().board.error).toBeNull();
  });

  test("clearSelectedCard resets selectedCard to null", () => {
    const store = createTestStore({ selectedCard: { cardId: "CARD-001" } });
    store.dispatch(clearSelectedCard());
    expect(store.getState().board.selectedCard).toBeNull();
  });
});

// ─── fetchBoard ──────────────────────────────────────────────────────────────

describe("fetchBoard thunk", () => {
  test("sets loading on pending, populates board and cards on fulfilled", async () => {
    const mockBoard = { objectId: "b1", projectHash: "abc", nextId: 3 };
    const mockCards = [{ cardId: "CARD-001", title: "Test" }];
    api.getOrCreateBoard.mockResolvedValue({ board: mockBoard, cards: mockCards });

    const store = createTestStore();
    await store.dispatch(fetchBoard("C:\\test\\project"));

    const state = store.getState().board;
    expect(state.loading).toBe(false);
    expect(state.board).toEqual(mockBoard);
    expect(state.cards).toEqual(mockCards);
    expect(state.lastPoll).toBeDefined();
    expect(state.error).toBeNull();
  });

  test("sets error on rejected", async () => {
    api.getOrCreateBoard.mockRejectedValue(new Error("Network error"));

    const store = createTestStore();
    await store.dispatch(fetchBoard("C:\\bad\\path"));

    const state = store.getState().board;
    expect(state.loading).toBe(false);
    expect(state.error).toBe("Network error");
  });
});

// ─── createCard ──────────────────────────────────────────────────────────────

describe("createCard thunk", () => {
  test("appends new card to cards array on fulfilled", async () => {
    const newCard = { cardId: "CARD-002", title: "New Card", status: "todo" };
    api.createCard.mockResolvedValue({ card: newCard });

    const store = createTestStore({
      cards: [{ cardId: "CARD-001", title: "Existing" }],
    });
    await store.dispatch(createCard({ projectHash: "abc", title: "New Card", author: "qa-1" }));

    const cards = store.getState().board.cards;
    expect(cards).toHaveLength(2);
    expect(cards[1]).toEqual(newCard);
  });

  test("sets error on rejected", async () => {
    api.createCard.mockRejectedValue(new Error("Title is required"));

    const store = createTestStore();
    await store.dispatch(createCard({ projectHash: "abc", author: "qa-1" }));

    expect(store.getState().board.error).toBe("Title is required");
  });
});

// ─── updateCard ──────────────────────────────────────────────────────────────

describe("updateCard thunk", () => {
  test("updates card in array by cardId on fulfilled", async () => {
    const updatedCard = { cardId: "CARD-001", title: "Test", status: "done" };
    api.updateCard.mockResolvedValue({ card: updatedCard, changes: "status: todo -> done" });

    const store = createTestStore({
      cards: [{ cardId: "CARD-001", title: "Test", status: "todo" }],
    });
    await store.dispatch(updateCard({ projectHash: "abc", cardId: "CARD-001", status: "done", author: "qa-1" }));

    expect(store.getState().board.cards[0].status).toBe("done");
  });

  test("updates selectedCard if it matches", async () => {
    const updatedCard = { cardId: "CARD-001", title: "Test", status: "done" };
    api.updateCard.mockResolvedValue({ card: updatedCard });

    const store = createTestStore({
      cards: [{ cardId: "CARD-001", title: "Test", status: "todo" }],
      selectedCard: { cardId: "CARD-001", title: "Test", status: "todo" },
    });
    await store.dispatch(updateCard({ projectHash: "abc", cardId: "CARD-001", status: "done", author: "qa-1" }));

    expect(store.getState().board.selectedCard.status).toBe("done");
  });

  test("sets error on rejected", async () => {
    api.updateCard.mockRejectedValue(new Error("No changes specified"));

    const store = createTestStore();
    await store.dispatch(updateCard({ projectHash: "abc", cardId: "CARD-001", author: "qa-1" }));

    expect(store.getState().board.error).toBe("No changes specified");
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
    await store.dispatch(addComment({ projectHash: "abc", cardId: "CARD-001", message: "Test", author: "qa-1" }));

    expect(store.getState().board.selectedCard.comments).toHaveLength(1);
    expect(store.getState().board.selectedCard.comments[0]).toEqual(newComment);
  });

  test("sets error on rejected", async () => {
    api.addComment.mockRejectedValue(new Error("message is required"));

    const store = createTestStore();
    await store.dispatch(addComment({ projectHash: "abc", cardId: "CARD-001", message: "", author: "qa-1" }));

    expect(store.getState().board.error).toBe("message is required");
  });
});

// ─── fetchCards ──────────────────────────────────────────────────────────────

describe("fetchCards thunk", () => {
  test("replaces cards array on fulfilled", async () => {
    const cards = [{ cardId: "CARD-001" }, { cardId: "CARD-002" }];
    api.listCards.mockResolvedValue({ cards });

    const store = createTestStore({ cards: [{ cardId: "OLD" }] });
    await store.dispatch(fetchCards({ projectHash: "abc" }));

    expect(store.getState().board.cards).toEqual(cards);
  });
});

// ─── fetchCard ───────────────────────────────────────────────────────────────

describe("fetchCard thunk", () => {
  test("sets selectedCard on fulfilled", async () => {
    const card = { cardId: "CARD-001", title: "Test", comments: [] };
    api.showCard.mockResolvedValue({ card });

    const store = createTestStore();
    await store.dispatch(fetchCard({ projectHash: "abc", cardId: "CARD-001" }));

    expect(store.getState().board.selectedCard).toEqual(card);
  });
});

// ─── pollBoard ───────────────────────────────────────────────────────────────

describe("pollBoard thunk", () => {
  test("updates cards when changed is true", async () => {
    const newCards = [{ cardId: "CARD-001", status: "done" }];
    api.pollBoard.mockResolvedValue({ changed: true, cards: newCards });

    const store = createTestStore({ cards: [{ cardId: "CARD-001", status: "todo" }] });
    await store.dispatch(pollBoard({ projectHash: "abc", since: "2026-01-01T00:00:00Z" }));

    expect(store.getState().board.cards).toEqual(newCards);
    expect(store.getState().board.lastPoll).toBeDefined();
  });

  test("does not update cards when changed is false", async () => {
    api.pollBoard.mockResolvedValue({ changed: false, cards: [] });

    const originalCards = [{ cardId: "CARD-001", status: "todo" }];
    const store = createTestStore({ cards: originalCards });
    await store.dispatch(pollBoard({ projectHash: "abc", since: "2099-01-01T00:00:00Z" }));

    expect(store.getState().board.cards).toEqual(originalCards);
  });
});

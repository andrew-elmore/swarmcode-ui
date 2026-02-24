/**
 * CARD-203 QA Tests: UI boardId Migration
 *
 * Verifies that all 16 migrated source files correctly use boardId
 * instead of projectHash. Tests cover:
 *   1. api.js — all cloud function calls pass boardId (not projectHash)
 *   2. api.js — LiveQuery subscriptions use Board Pointer (not projectHash string)
 *   3. Redux slices — thunks read board?.objectId and pass boardId to api
 *   4. Source verification — zero projectHash references in src/
 *   5. E2E full-flow — complete dispatch chains use board.objectId
 *
 * Note: Section 1 & 2 test the real api.js against the Parse mock.
 * Section 3 & 5 spy on api.js functions to test Redux slice behaviour.
 */

import Parse from "parse";
import * as api from "../src/services/api";
import { configureStore } from "@reduxjs/toolkit";
import boardReducer, {
  fetchCards,
  fetchCard,
  createCard,
  updateCard,
  addComment,
  createSprint,
  updateSprint,
  deleteSprint,
} from "../src/store/boardSlice";
import messagesReducer, {
  sendMessage,
  loadConversation,
  loadMoreMessages,
} from "../src/store/messagesSlice";
import articlesReducer, {
  fetchArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  searchArticles,
  getArticle,
  fetchLinkedArticles,
  linkArticle,
  unlinkArticle,
} from "../src/store/articlesSlice";
import commandsReducer, {
  fetchRecentCommands,
  createCommand,
  fetchLatestPing,
} from "../src/store/commandsSlice";
import agentsReducer, {
  fetchAgents,
  assignAgent,
  unassignAgent,
  updateProjectAgent,
} from "../src/store/agentsSlice";

const TEST_BOARD_ID = "board-abc123";

// parseMock.cjs is a singleton shared across all test files in the same worker.
// Reset Parse mocks before each test to avoid cross-file contamination.
beforeEach(() => {
  Parse.Cloud.run.mockReset();
  Parse.Query.mockClear();
  Parse.Object.extend.mockClear();
});

// Restore all spies after each test so Redux tests don't leak into api tests
afterEach(() => jest.restoreAllMocks());

// ─── Helper: create a Redux store with board.objectId set ────────────────────

function createStoreWithBoard(preloadedOverrides = {}) {
  return configureStore({
    reducer: {
      board: boardReducer,
      messages: messagesReducer,
      articles: articlesReducer,
      commands: commandsReducer,
      agents: agentsReducer,
    },
    preloadedState: {
      board: {
        board: { objectId: TEST_BOARD_ID },
        cards: [],
        sprints: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
        ...(preloadedOverrides.board || {}),
      },
      messages: {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        refreshing: false,
        liveQueryRefreshFlag: false,
        error: null,
        mobileDrawerOpen: false,
        ...(preloadedOverrides.messages || {}),
      },
    },
  });
}

// ─── 1. api.js — cloud functions pass boardId, never projectHash ─────────────
//
// These tests call the REAL api.js functions.  Parse.Cloud.run is intercepted
// by the Parse mock (parseMock.cjs via jest moduleNameMapper).

describe("api.js: all cloud functions pass boardId (not projectHash)", () => {
  test("sendMessage passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.sendMessage({ boardId: TEST_BOARD_ID, from: "qa-1", to: "developer-1", message: "test" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getConversation passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ messages: [] });
    await api.getConversation(TEST_BOARD_ID, "owner", "pm-1");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("createCard passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ card: {} });
    await api.createCard({ boardId: TEST_BOARD_ID, title: "T", author: "qa-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("updateCard passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ card: {} });
    await api.updateCard({ boardId: TEST_BOARD_ID, cardId: "CARD-001", status: "done", author: "qa-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("addComment passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ comment: {} });
    await api.addComment({ boardId: TEST_BOARD_ID, cardId: "CARD-001", message: "c", author: "qa-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("listCards passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ cards: [] });
    await api.listCards(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("showCard passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ card: {} });
    await api.showCard(TEST_BOARD_ID, "CARD-001");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getAgents passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ agents: [] });
    await api.getAgents(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("assignAgentToProject passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.assignAgentToProject({ boardId: TEST_BOARD_ID, agentName: "pm-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("unassignAgentFromProject passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.unassignAgentFromProject({ boardId: TEST_BOARD_ID, agentName: "pm-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("updateProjectAgent passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ projectAgent: {} });
    await api.updateProjectAgent({ boardId: TEST_BOARD_ID, agentName: "pm-1", isActive: false });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("createSprint passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.createSprint({ boardId: TEST_BOARD_ID, name: "Sprint 1", order: 1 });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getSprints passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ sprints: [] });
    await api.getSprints(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("updateSprint passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.updateSprint({ boardId: TEST_BOARD_ID, sprintId: "sp1", name: "X" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("deleteSprint passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.deleteSprint(TEST_BOARD_ID, "sp1");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  // CARD-218: articles are global — no boardId in CRUD params
  test("createArticle sends title without boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ article: {} });
    await api.createArticle({ title: "T" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.title).toBe("T");
    expect(params.boardId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("getArticle sends title without boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ article: {} });
    await api.getArticle("T");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.title).toBe("T");
    expect(params.boardId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("updateArticle sends fields without boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ article: {} });
    await api.updateArticle({ title: "T", text: "X" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.title).toBe("T");
    expect(params.text).toBe("X");
    expect(params.boardId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("deleteArticle sends title without boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.deleteArticle("T");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.title).toBe("T");
    expect(params.boardId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("listArticles sends no board params", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ articles: [] });
    await api.listArticles();
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("searchArticles sends query without boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ articles: [] });
    await api.searchArticles({ query: "test" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.query).toBe("test");
    expect(params.boardId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("linkArticleToProject passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.linkArticleToProject({ boardId: TEST_BOARD_ID, articleTitle: "T" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("unlinkArticleFromProject passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.unlinkArticleFromProject({ boardId: TEST_BOARD_ID, articleTitle: "T" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getProjectArticles passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ articles: [] });
    await api.getProjectArticles(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("createCommand passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.createCommand(TEST_BOARD_ID, "stop_all");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("listRecentCommands passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ commands: [] });
    await api.listRecentCommands(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getLatestPing passes boardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ ping: null });
    await api.getLatestPing(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.boardId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("global agent ops (createAgent, updateAgent, deleteAgent, getAllAgents) do NOT pass boardId", async () => {
    Parse.Cloud.run.mockResolvedValue({ agent: {} });

    await api.createAgent({ name: "test-1" });
    expect(Parse.Cloud.run.mock.calls[0][1].boardId).toBeUndefined();

    await api.updateAgent({ name: "test-1", description: "updated" });
    expect(Parse.Cloud.run.mock.calls[1][1].boardId).toBeUndefined();

    await api.deleteAgent("test-1");
    expect(Parse.Cloud.run.mock.calls[2][1].boardId).toBeUndefined();

    Parse.Cloud.run.mockResolvedValueOnce({ agents: [] });
    await api.getAllAgents();
    expect(Parse.Cloud.run.mock.calls[3][1]).toEqual({});
  });
});

// ─── 2. api.js — LiveQuery subscriptions use Board Pointer ───────────────────
//
// subscribeToCommands and subscribeToPings must filter by board Pointer, NOT
// by projectHash string.  The Board class is resolved via Parse.Object.extend.

describe("api.js: LiveQuery subscriptions use Board Pointer", () => {

  test("subscribeToCommands creates Board Pointer query via equalTo('board', ...)", async () => {
    const mockSub = { on: jest.fn(), unsubscribe: jest.fn() };
    let capturedQuery = null;

    Parse.Query.mockImplementationOnce(function () {
      this.equalTo = jest.fn(function (field, value) {
        capturedQuery = { field, value };
        return this;
      });
      this.subscribe = jest.fn().mockResolvedValue(mockSub);
    });

    Parse.Object.extend.mockReturnValueOnce({
      createWithoutData: jest.fn((id) => ({ id, className: "Board" })),
    });

    await api.subscribeToCommands(TEST_BOARD_ID, jest.fn());

    expect(capturedQuery).not.toBeNull();
    expect(capturedQuery.field).toBe("board");
    expect(capturedQuery.value.id).toBe(TEST_BOARD_ID);
  });

  test("subscribeToPings creates Board Pointer query via equalTo('board', ...)", async () => {
    const mockSub = { on: jest.fn(), unsubscribe: jest.fn() };
    let capturedQuery = null;

    Parse.Query.mockImplementationOnce(function () {
      this.equalTo = jest.fn(function (field, value) {
        capturedQuery = { field, value };
        return this;
      });
      this.subscribe = jest.fn().mockResolvedValue(mockSub);
    });

    Parse.Object.extend.mockReturnValueOnce({
      createWithoutData: jest.fn((id) => ({ id, className: "Board" })),
    });

    await api.subscribeToPings(TEST_BOARD_ID, jest.fn());

    expect(capturedQuery).not.toBeNull();
    expect(capturedQuery.field).toBe("board");
    expect(capturedQuery.value.id).toBe(TEST_BOARD_ID);
  });

  test("subscribeToMessages filters LiveQuery by board (board-scoped since CARD-214)", async () => {
    const mockSub = { on: jest.fn(), unsubscribe: jest.fn() };
    const equalToSpy = jest.fn();

    Parse.Query.mockImplementationOnce(function () {
      this.equalTo = equalToSpy;
      this.subscribe = jest.fn().mockResolvedValue(mockSub);
    });

    await api.subscribeToMessages(TEST_BOARD_ID, jest.fn());

    // Messages LiveQuery is board-scoped since CARD-214 — equalTo("board", ...) must be called
    expect(equalToSpy).toHaveBeenCalledWith("board", expect.anything());
  });
});

// ─── 3. Redux slices — thunks pass boardId to api functions ─────────────────
//
// These tests spy on the real api.js so we can assert what boardId was passed
// without needing to inspect Parse internals.

describe("messagesSlice: thunks read board?.objectId from state", () => {
  test("sendMessage reads boardId from board.board.objectId", async () => {
    jest.spyOn(api, "sendMessage").mockResolvedValue({ success: true, messageId: "m1" });
    const store = createStoreWithBoard();

    await store.dispatch(sendMessage({ to: "developer-1", message: "Hello" }));

    expect(api.sendMessage).toHaveBeenCalledWith({
      boardId: TEST_BOARD_ID,
      from: "owner",
      to: "developer-1",
      message: "Hello",
    });
  });

  test("sendMessage passes undefined boardId when board is null", async () => {
    jest.spyOn(api, "sendMessage").mockResolvedValue({ success: true });
    const store = createStoreWithBoard({ board: { board: null } });

    await store.dispatch(sendMessage({ to: "pm-1", message: "Hi" }));

    const { boardId } = api.sendMessage.mock.calls[0][0];
    expect(boardId).toBeUndefined();
  });

  test("loadConversation reads boardId from board.board.objectId", async () => {
    jest.spyOn(api, "getConversation").mockResolvedValue({ messages: [], hasMore: false });
    const store = createStoreWithBoard();

    await store.dispatch(loadConversation("developer-1"));

    expect(api.getConversation).toHaveBeenCalledWith(
      TEST_BOARD_ID, "owner", "developer-1", { limit: 30 }
    );
  });

  test("loadMoreMessages reads boardId from board.board.objectId", async () => {
    jest.spyOn(api, "getConversation")
      .mockResolvedValueOnce({
        messages: [{ from: "owner", to: "dev", message: "Msg", createdAt: "2026-01-01T00:00:00Z" }],
        hasMore: true,
      })
      .mockResolvedValueOnce({ messages: [], hasMore: false });

    const store = createStoreWithBoard();
    await store.dispatch(loadConversation("dev"));
    await store.dispatch(loadMoreMessages("dev"));

    expect(api.getConversation).toHaveBeenLastCalledWith(
      TEST_BOARD_ID, "owner", "dev", { before: "2026-01-01T00:00:00Z" }
    );
  });
});

describe("boardSlice: thunks pass boardId to API", () => {
  test("fetchCards passes boardId", async () => {
    jest.spyOn(api, "listCards").mockResolvedValue({ cards: [] });
    const store = createStoreWithBoard();

    await store.dispatch(fetchCards({ boardId: TEST_BOARD_ID, status: "scope" }));

    expect(api.listCards).toHaveBeenCalledWith(TEST_BOARD_ID, "scope");
  });

  test("fetchCard passes boardId", async () => {
    jest.spyOn(api, "showCard").mockResolvedValue({ card: { cardId: "CARD-001" } });
    const store = createStoreWithBoard();

    await store.dispatch(fetchCard({ boardId: TEST_BOARD_ID, cardId: "CARD-001" }));

    expect(api.showCard).toHaveBeenCalledWith(TEST_BOARD_ID, "CARD-001");
  });

  test("createCard passes boardId through cardData", async () => {
    jest.spyOn(api, "createCard").mockResolvedValue({ card: { cardId: "CARD-002" } });
    const store = createStoreWithBoard();

    await store.dispatch(createCard({ boardId: TEST_BOARD_ID, title: "Test", author: "qa-1" }));

    expect(api.createCard).toHaveBeenCalledWith({
      boardId: TEST_BOARD_ID,
      title: "Test",
      author: "qa-1",
    });
  });

  test("updateCard passes boardId through cardData", async () => {
    jest.spyOn(api, "updateCard").mockResolvedValue({ card: { cardId: "CARD-001", status: "done" } });
    const store = createStoreWithBoard();

    await store.dispatch(updateCard({ boardId: TEST_BOARD_ID, cardId: "CARD-001", status: "done", author: "qa-1" }));

    expect(api.updateCard).toHaveBeenCalledWith({
      boardId: TEST_BOARD_ID,
      cardId: "CARD-001",
      status: "done",
      author: "qa-1",
    });
  });

  test("addComment passes boardId through commentData", async () => {
    jest.spyOn(api, "addComment").mockResolvedValue({ comment: { objectId: "c1" } });
    const store = createStoreWithBoard({
      board: { selectedCard: { cardId: "CARD-001", comments: [] } },
    });

    await store.dispatch(addComment({ boardId: TEST_BOARD_ID, cardId: "CARD-001", message: "test", author: "qa-1" }));

    expect(api.addComment).toHaveBeenCalledWith({
      boardId: TEST_BOARD_ID,
      cardId: "CARD-001",
      message: "test",
      author: "qa-1",
    });
  });

  test("createSprint passes boardId", async () => {
    const sprint = { objectId: "sp1", name: "Sprint 1", order: 1 };
    jest.spyOn(api, "createSprint").mockResolvedValue(sprint);
    const store = createStoreWithBoard();

    await store.dispatch(createSprint({ boardId: TEST_BOARD_ID, name: "Sprint 1", order: 1 }));

    expect(api.createSprint).toHaveBeenCalledWith({ boardId: TEST_BOARD_ID, name: "Sprint 1", order: 1 });
  });

  test("updateSprint passes boardId", async () => {
    const sprint = { objectId: "sp1", name: "Renamed", order: 2 };
    jest.spyOn(api, "updateSprint").mockResolvedValue(sprint);
    const store = createStoreWithBoard();

    await store.dispatch(updateSprint({ boardId: TEST_BOARD_ID, sprintId: "sp1", name: "Renamed" }));

    expect(api.updateSprint).toHaveBeenCalledWith({ boardId: TEST_BOARD_ID, sprintId: "sp1", name: "Renamed" });
  });

  test("deleteSprint passes boardId", async () => {
    jest.spyOn(api, "deleteSprint").mockResolvedValue({ sprintId: "sp1" });
    const store = createStoreWithBoard();

    await store.dispatch(deleteSprint({ boardId: TEST_BOARD_ID, sprintId: "sp1" }));

    expect(api.deleteSprint).toHaveBeenCalledWith(TEST_BOARD_ID, "sp1");
  });
});

// CARD-218: articles are global — thunks no longer pass boardId to CRUD/list API calls
describe("articlesSlice: article CRUD thunks are global (no boardId)", () => {
  test("fetchArticles calls listArticles with no args", async () => {
    jest.spyOn(api, "listArticles").mockResolvedValue({ articles: [] });
    const store = createStoreWithBoard();
    await store.dispatch(fetchArticles());
    expect(api.listArticles).toHaveBeenCalledWith();
  });

  test("createArticle passes title without boardId", async () => {
    jest.spyOn(api, "createArticle").mockResolvedValue({ article: { objectId: "a1", title: "T" } });
    const store = createStoreWithBoard();
    await store.dispatch(createArticle({ title: "T" }));
    expect(api.createArticle).toHaveBeenCalledWith({ title: "T" });
  });

  test("updateArticle passes fields without boardId", async () => {
    jest.spyOn(api, "updateArticle").mockResolvedValue({ article: { objectId: "a1", title: "T", text: "X" } });
    const store = createStoreWithBoard();
    await store.dispatch(updateArticle({ title: "T", text: "X" }));
    expect(api.updateArticle).toHaveBeenCalledWith({ title: "T", text: "X" });
  });

  test("deleteArticle passes title only (no boardId)", async () => {
    jest.spyOn(api, "deleteArticle").mockResolvedValue({});
    const store = createStoreWithBoard();
    await store.dispatch(deleteArticle({ title: "T" }));
    expect(api.deleteArticle).toHaveBeenCalledWith("T");
  });

  test("searchArticles passes query without boardId", async () => {
    jest.spyOn(api, "searchArticles").mockResolvedValue({ articles: [] });
    const store = createStoreWithBoard();
    await store.dispatch(searchArticles({ query: "test" }));
    expect(api.searchArticles).toHaveBeenCalledWith({ query: "test", keywords: undefined });
  });

  test("getArticle passes title only (no boardId)", async () => {
    jest.spyOn(api, "getArticle").mockResolvedValue({ article: { objectId: "a1", title: "T" } });
    const store = createStoreWithBoard();
    await store.dispatch(getArticle({ title: "T" }));
    expect(api.getArticle).toHaveBeenCalledWith("T");
  });

  test("fetchLinkedArticles passes boardId", async () => {
    jest.spyOn(api, "getProjectArticles").mockResolvedValue({ articles: [] });
    const store = createStoreWithBoard();
    await store.dispatch(fetchLinkedArticles(TEST_BOARD_ID));
    expect(api.getProjectArticles).toHaveBeenCalledWith(TEST_BOARD_ID);
  });

  test("linkArticle passes boardId", async () => {
    jest.spyOn(api, "linkArticleToProject").mockResolvedValue({
      success: true,
      linked: true,
      article: { objectId: "a1", title: "T" },
    });
    const store = createStoreWithBoard();
    await store.dispatch(linkArticle({ boardId: TEST_BOARD_ID, articleTitle: "T" }));
    expect(api.linkArticleToProject).toHaveBeenCalledWith({ boardId: TEST_BOARD_ID, articleTitle: "T" });
  });

  test("unlinkArticle passes boardId", async () => {
    jest.spyOn(api, "unlinkArticleFromProject").mockResolvedValue({ success: true });
    const store = createStoreWithBoard();
    await store.dispatch(unlinkArticle({ boardId: TEST_BOARD_ID, articleTitle: "T" }));
    expect(api.unlinkArticleFromProject).toHaveBeenCalledWith({ boardId: TEST_BOARD_ID, articleTitle: "T" });
  });
});

describe("commandsSlice: thunks pass boardId to API", () => {
  test("fetchRecentCommands passes boardId", async () => {
    jest.spyOn(api, "listRecentCommands").mockResolvedValue({ commands: [] });
    const store = createStoreWithBoard();
    await store.dispatch(fetchRecentCommands(TEST_BOARD_ID));
    expect(api.listRecentCommands).toHaveBeenCalledWith(TEST_BOARD_ID);
  });

  test("createCommand passes boardId", async () => {
    jest.spyOn(api, "createCommand").mockResolvedValue({
      objectId: "cmd1",
      action: "stop_all",
      status: "requested",
    });
    const store = createStoreWithBoard();
    await store.dispatch(createCommand({ boardId: TEST_BOARD_ID, action: "stop_all" }));
    expect(api.createCommand).toHaveBeenCalledWith(TEST_BOARD_ID, "stop_all");
  });

  test("fetchLatestPing passes boardId", async () => {
    jest.spyOn(api, "getLatestPing").mockResolvedValue({ ping: null });
    const store = createStoreWithBoard();
    await store.dispatch(fetchLatestPing(TEST_BOARD_ID));
    expect(api.getLatestPing).toHaveBeenCalledWith(TEST_BOARD_ID);
  });
});

describe("agentsSlice: project-scoped thunks pass boardId to API", () => {
  test("fetchAgents passes boardId", async () => {
    jest.spyOn(api, "getAgents").mockResolvedValue({ agents: [] });
    const store = createStoreWithBoard();
    await store.dispatch(fetchAgents(TEST_BOARD_ID));
    expect(api.getAgents).toHaveBeenCalledWith(TEST_BOARD_ID);
  });

  test("assignAgent passes boardId", async () => {
    jest.spyOn(api, "assignAgentToProject").mockResolvedValue({
      success: true,
      projectAgent: { agentName: "pm-1", boardId: TEST_BOARD_ID, isActive: true, sortOrder: 0 },
    });
    const store = createStoreWithBoard();
    await store.dispatch(assignAgent({ boardId: TEST_BOARD_ID, agentName: "pm-1" }));
    expect(api.assignAgentToProject).toHaveBeenCalledWith({ boardId: TEST_BOARD_ID, agentName: "pm-1" });
  });

  test("unassignAgent passes boardId", async () => {
    jest.spyOn(api, "unassignAgentFromProject").mockResolvedValue({ success: true });
    const store = createStoreWithBoard();
    await store.dispatch(unassignAgent({ boardId: TEST_BOARD_ID, agentName: "pm-1" }));
    expect(api.unassignAgentFromProject).toHaveBeenCalledWith({ boardId: TEST_BOARD_ID, agentName: "pm-1" });
  });

  test("updateProjectAgent passes boardId", async () => {
    jest.spyOn(api, "updateProjectAgent").mockResolvedValue({
      projectAgent: { agentName: "pm-1", isActive: false, sortOrder: 0 },
    });
    const store = createStoreWithBoard();
    await store.dispatch(updateProjectAgent({ boardId: TEST_BOARD_ID, agentName: "pm-1", isActive: false }));
    expect(api.updateProjectAgent).toHaveBeenCalledWith({
      boardId: TEST_BOARD_ID,
      agentName: "pm-1",
      isActive: false,
    });
  });
});

// ─── 4. Source verification: zero projectHash in src/ ────────────────────────

describe("source code verification: no projectHash in src/", () => {
  const fs = require("fs");
  const path = require("path");
  const srcDir = path.resolve(__dirname, "../src");

  function getAllJsFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllJsFiles(fullPath));
      } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  test("no source file in src/ contains 'projectHash'", () => {
    const files = getAllJsFiles(srcDir);
    const violations = [];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("projectHash")) {
        violations.push(path.relative(srcDir, file));
      }
    }
    expect(violations).toEqual([]);
  });

  test("api.js does not reference projectHash anywhere", () => {
    const content = fs.readFileSync(path.resolve(srcDir, "services/api.js"), "utf8");
    expect(content).not.toContain("projectHash");
  });

  test("all Redux slices do not reference projectHash", () => {
    const slices = [
      "store/boardSlice.js",
      "store/messagesSlice.js",
      "store/articlesSlice.js",
      "store/commandsSlice.js",
      "store/agentsSlice.js",
    ];
    for (const relPath of slices) {
      const fullPath = path.resolve(srcDir, relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        expect(content).not.toContain("projectHash");
      }
    }
  });
});

// ─── 5. E2E full-flow: complete dispatch chains use board.objectId ────────────
//
// These tests simulate real user workflows: board loaded → operations performed.
// All operations should use board.objectId (not board.projectHash) as boardId.

describe("E2E: board loaded → card operations use board.objectId as boardId", () => {
  test("full flow: fetchCards after board load uses objectId", async () => {
    jest.spyOn(api, "getOrCreateBoard").mockResolvedValue({
      board: { objectId: TEST_BOARD_ID, nextId: 1 },
      cards: [],
      sprints: [],
    });
    jest.spyOn(api, "listCards").mockResolvedValue({
      cards: [{ cardId: "CARD-001", title: "Test", status: "create" }],
    });

    const { fetchBoard } = await import("../src/store/boardSlice");
    const store = configureStore({
      reducer: { board: boardReducer },
    });

    // Simulate: user opens project, board loads
    await store.dispatch(fetchBoard("C:\\test\\project"));
    const boardId = store.getState().board.board?.objectId;
    expect(boardId).toBe(TEST_BOARD_ID);

    // Then: cards are refreshed using the loaded board's objectId
    await store.dispatch(fetchCards({ boardId, status: "create" }));
    expect(api.listCards).toHaveBeenCalledWith(TEST_BOARD_ID, "create");
  });

  test("full flow: messages sent after board load use objectId", async () => {
    jest.spyOn(api, "sendMessage").mockResolvedValue({ success: true, messageId: "m-001" });

    // Board already loaded in store
    const store = createStoreWithBoard();
    expect(store.getState().board.board.objectId).toBe(TEST_BOARD_ID);

    // User sends a message — slice reads board.objectId from state
    await store.dispatch(sendMessage({ to: "developer-1", message: "Ready for review" }));

    expect(api.sendMessage).toHaveBeenCalledWith({
      boardId: TEST_BOARD_ID,
      from: "owner",
      to: "developer-1",
      message: "Ready for review",
    });
  });

  // CARD-218: articles are global — fetchArticles takes no boardId
  test("full flow: articles fetched globally without boardId", async () => {
    jest.spyOn(api, "listArticles").mockResolvedValue({
      articles: [{ objectId: "a1", title: "Guide" }],
    });

    const store = createStoreWithBoard();

    await store.dispatch(fetchArticles());

    expect(api.listArticles).toHaveBeenCalledWith();
    expect(store.getState().articles.articles).toHaveLength(1);
  });

  test("full flow: commands fetched after board load use objectId", async () => {
    jest.spyOn(api, "listRecentCommands").mockResolvedValue({
      commands: [{ objectId: "cmd1", action: "stop_all", status: "fulfilled" }],
    });

    const store = createStoreWithBoard();
    const boardId = store.getState().board.board.objectId;

    await store.dispatch(fetchRecentCommands(boardId));

    expect(api.listRecentCommands).toHaveBeenCalledWith(TEST_BOARD_ID);
    expect(store.getState().commands.commands).toHaveLength(1);
  });

  test("full flow: agents assigned using objectId, not projectHash", async () => {
    jest.spyOn(api, "assignAgentToProject").mockResolvedValue({
      success: true,
      projectAgent: { agentName: "developer-1", isActive: true, sortOrder: 1 },
    });

    const store = createStoreWithBoard();
    const boardId = store.getState().board.board.objectId;

    await store.dispatch(assignAgent({ boardId, agentName: "developer-1" }));

    const callArg = api.assignAgentToProject.mock.calls[0][0];
    expect(callArg.boardId).toBe(TEST_BOARD_ID);
    expect(callArg.boardId).not.toBe(undefined);
    // Critically: no projectHash should be present
    expect(callArg.projectHash).toBeUndefined();
  });
});

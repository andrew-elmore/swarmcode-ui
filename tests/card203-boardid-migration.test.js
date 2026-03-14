/**
 * CARD-203 QA Tests: UI projectId Migration
 *
 * Verifies that all 16 migrated source files correctly use projectId
 * instead of projectHash. Tests cover:
 *   1. api.js — all cloud function calls pass projectId (not projectHash)
 *   2. api.js — LiveQuery subscriptions use Board Pointer (not projectHash string)
 *   3. Redux slices — thunks read board?.objectId and pass projectId to api
 *   4. Source verification — zero projectHash references in src/
 *   5. E2E full-flow — complete dispatch chains use board.objectId
 *
 * Note: Section 1 & 2 test the real api.js against the Parse mock.
 * Section 3 & 5 spy on api.js functions to test Redux slice behaviour.
 */

import Parse from "parse";
import * as api from "../src/services/api";
import { configureStore } from "@reduxjs/toolkit";
import projectReducer, {
  fetchCards,
  fetchCard,
  createCard,
  updateCard,
  addComment,
  createSprint,
  updateSprint,
  deleteSprint,
} from "../src/store/projectSlice";
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
      project: projectReducer,
      messages: messagesReducer,
      articles: articlesReducer,
      commands: commandsReducer,
      agents: agentsReducer,
    },
    preloadedState: {
      project: {
        project: { objectId: TEST_BOARD_ID },
        cards: [],
        sprints: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
        ...(preloadedOverrides.project || {}),
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

// ─── 1. api.js — cloud functions pass projectId, never projectHash ─────────────
//
// These tests call the REAL api.js functions.  Parse.Cloud.run is intercepted
// by the Parse mock (parseMock.cjs via jest moduleNameMapper).

describe("api.js: all cloud functions pass projectId (not projectHash)", () => {
  test("sendMessage passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.sendMessage({ projectId: TEST_BOARD_ID, from: "qa-1", to: "developer-1", message: "test" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getConversation passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ messages: [] });
    await api.getConversation(TEST_BOARD_ID, "owner", "pm-1");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("createCard passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ card: {} });
    await api.createCard({ projectId: TEST_BOARD_ID, title: "T", author: "qa-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("updateCard passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ card: {} });
    await api.updateCard({ projectId: TEST_BOARD_ID, cardId: "CARD-001", status: "done", author: "qa-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("addComment passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ comment: {} });
    await api.addComment({ projectId: TEST_BOARD_ID, cardId: "CARD-001", message: "c", author: "qa-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("listCards passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ cards: [] });
    await api.listCards(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("showCard passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ card: {} });
    await api.showCard(TEST_BOARD_ID, "CARD-001");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getAgents passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ agents: [] });
    await api.getAgents(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("assignAgentToProject passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.assignAgentToProject({ projectId: TEST_BOARD_ID, agentName: "pm-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("unassignAgentFromProject passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.unassignAgentFromProject({ projectId: TEST_BOARD_ID, agentName: "pm-1" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("updateProjectAgent passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ projectAgent: {} });
    await api.updateProjectAgent({ projectId: TEST_BOARD_ID, agentName: "pm-1", isActive: false });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("createSprint passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.createSprint({ projectId: TEST_BOARD_ID, name: "Sprint 1", order: 1 });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getSprints passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ sprints: [] });
    await api.getSprints(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("updateSprint passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.updateSprint({ projectId: TEST_BOARD_ID, sprintId: "sp1", name: "X" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("deleteSprint passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.deleteSprint(TEST_BOARD_ID, "sp1");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  // CARD-218: articles are global — no projectId in CRUD params
  test("createArticle sends title without projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ article: {} });
    await api.createArticle({ title: "T" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.title).toBe("T");
    expect(params.projectId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("getArticle sends title without projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ article: {} });
    await api.getArticle("T");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.title).toBe("T");
    expect(params.projectId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("updateArticle sends fields without projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ article: {} });
    await api.updateArticle({ title: "T", text: "X" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.title).toBe("T");
    expect(params.text).toBe("X");
    expect(params.projectId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("deleteArticle sends title without projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.deleteArticle("T");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.title).toBe("T");
    expect(params.projectId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("listArticles sends no board params", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ articles: [] });
    await api.listArticles();
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("searchArticles sends query without projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ articles: [] });
    await api.searchArticles({ query: "test" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.query).toBe("test");
    expect(params.projectId).toBeUndefined();
    expect(params.projectHash).toBeUndefined();
  });

  test("linkArticleToProject passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.linkArticleToProject({ projectId: TEST_BOARD_ID, articleTitle: "T" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("unlinkArticleFromProject passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await api.unlinkArticleFromProject({ projectId: TEST_BOARD_ID, articleTitle: "T" });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getProjectArticles passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ articles: [] });
    await api.getProjectArticles(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("createCommand passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({});
    await api.createCommand(TEST_BOARD_ID, "stop_all");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("listRecentCommands passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ commands: [] });
    await api.listRecentCommands(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("getLatestPing passes projectId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ ping: null });
    await api.getLatestPing(TEST_BOARD_ID);
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe(TEST_BOARD_ID);
    expect(params.projectHash).toBeUndefined();
  });

  test("global agent ops (createAgent, updateAgent, deleteAgent, getAllAgents) do NOT pass projectId", async () => {
    Parse.Cloud.run.mockResolvedValue({ agent: {} });

    await api.createAgent({ name: "test-1" });
    expect(Parse.Cloud.run.mock.calls[0][1].projectId).toBeUndefined();

    await api.updateAgent({ name: "test-1", description: "updated" });
    expect(Parse.Cloud.run.mock.calls[1][1].projectId).toBeUndefined();

    await api.deleteAgent("test-1");
    expect(Parse.Cloud.run.mock.calls[2][1].projectId).toBeUndefined();

    Parse.Cloud.run.mockResolvedValueOnce({ agents: [] });
    await api.getAllAgents();
    expect(Parse.Cloud.run.mock.calls[3][1]).toEqual({});
  });
});

// ─── 2. api.js — LiveQuery subscriptions use Board Pointer ───────────────────
//
// subscribeToCommands and subscribeToPings must filter by board Pointer, NOT
// by projectHash string.  The Board class is resolved via Parse.Object.extend.

describe("api.js: LiveQuery subscriptions use Project Pointer", () => {

  test("subscribeToCommands creates Project Pointer query via equalTo('project', ...)", async () => {
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
      createWithoutData: jest.fn((id) => ({ id, className: "Project" })),
    });

    await api.subscribeToCommands(TEST_BOARD_ID, jest.fn());

    expect(capturedQuery).not.toBeNull();
    expect(capturedQuery.field).toBe("project");
    expect(capturedQuery.value.id).toBe(TEST_BOARD_ID);
  });

  test("subscribeToPings creates Project Pointer query via equalTo('project', ...)", async () => {
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
      createWithoutData: jest.fn((id) => ({ id, className: "Project" })),
    });

    await api.subscribeToPings(TEST_BOARD_ID, jest.fn());

    expect(capturedQuery).not.toBeNull();
    expect(capturedQuery.field).toBe("project");
    expect(capturedQuery.value.id).toBe(TEST_BOARD_ID);
  });

  test("subscribeToMessages filters LiveQuery by project (project-scoped since CARD-227)", async () => {
    const mockSub = { on: jest.fn(), unsubscribe: jest.fn() };
    const equalToSpy = jest.fn();

    Parse.Query.mockImplementationOnce(function () {
      this.equalTo = equalToSpy;
      this.include = jest.fn();
      this.subscribe = jest.fn().mockResolvedValue(mockSub);
    });

    await api.subscribeToMessages(TEST_BOARD_ID, jest.fn());

    // Messages LiveQuery is project-scoped since CARD-227 — equalTo("project", ...) must be called
    expect(equalToSpy).toHaveBeenCalledWith("project", expect.anything());
  });
});

// ─── 3. Redux slices — thunks pass projectId to api functions ─────────────────
//
// These tests spy on the real api.js so we can assert what projectId was passed
// without needing to inspect Parse internals.

describe("messagesSlice: thunks read board?.objectId from state", () => {
  test("sendMessage reads projectId from board.board.objectId", async () => {
    jest.spyOn(api, "sendMessage").mockResolvedValue({ success: true, messageId: "m1" });
    const store = createStoreWithBoard();

    await store.dispatch(sendMessage({ to: "developer-1", message: "Hello" }));

    expect(api.sendMessage).toHaveBeenCalledWith({
      projectId: TEST_BOARD_ID,
      from: "owner",
      to: "developer-1",
      message: "Hello",
    });
  });

  test("sendMessage passes undefined projectId when board is null", async () => {
    jest.spyOn(api, "sendMessage").mockResolvedValue({ success: true });
    const store = createStoreWithBoard({ project: { project: null } });

    await store.dispatch(sendMessage({ to: "pm-1", message: "Hi" }));

    const { projectId } = api.sendMessage.mock.calls[0][0];
    expect(projectId).toBeUndefined();
  });

  test("loadConversation reads projectId from board.board.objectId", async () => {
    jest.spyOn(api, "getConversation").mockResolvedValue({ messages: [], hasMore: false });
    const store = createStoreWithBoard();

    await store.dispatch(loadConversation("developer-1"));

    expect(api.getConversation).toHaveBeenCalledWith(
      TEST_BOARD_ID, "owner", "developer-1", { limit: 30 }
    );
  });

  test("loadMoreMessages reads projectId from board.board.objectId", async () => {
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

describe("projectSlice: thunks pass projectId to API", () => {
  test("fetchCards passes projectId", async () => {
    jest.spyOn(api, "listCards").mockResolvedValue({ cards: [] });
    const store = createStoreWithBoard();

    await store.dispatch(fetchCards({ projectId: TEST_BOARD_ID, status: "scope" }));

    expect(api.listCards).toHaveBeenCalledWith(TEST_BOARD_ID, "scope", undefined);
  });

  test("fetchCard passes projectId", async () => {
    jest.spyOn(api, "showCard").mockResolvedValue({ card: { cardId: "CARD-001" } });
    const store = createStoreWithBoard();

    await store.dispatch(fetchCard({ projectId: TEST_BOARD_ID, cardId: "CARD-001" }));

    expect(api.showCard).toHaveBeenCalledWith(TEST_BOARD_ID, "CARD-001");
  });

  test("createCard passes projectId through cardData", async () => {
    jest.spyOn(api, "createCard").mockResolvedValue({ card: { cardId: "CARD-002" } });
    const store = createStoreWithBoard();

    await store.dispatch(createCard({ projectId: TEST_BOARD_ID, title: "Test", author: "qa-1" }));

    expect(api.createCard).toHaveBeenCalledWith({
      projectId: TEST_BOARD_ID,
      title: "Test",
      author: "qa-1",
    });
  });

  test("updateCard passes projectId through cardData", async () => {
    jest.spyOn(api, "updateCard").mockResolvedValue({ card: { cardId: "CARD-001", status: "done" } });
    const store = createStoreWithBoard();

    await store.dispatch(updateCard({ projectId: TEST_BOARD_ID, cardId: "CARD-001", status: "done", author: "qa-1" }));

    expect(api.updateCard).toHaveBeenCalledWith({
      projectId: TEST_BOARD_ID,
      cardId: "CARD-001",
      status: "done",
      author: "qa-1",
    });
  });

  test("addComment passes projectId through commentData", async () => {
    jest.spyOn(api, "addComment").mockResolvedValue({ comment: { objectId: "c1" } });
    const store = createStoreWithBoard({
      project: { selectedCard: { cardId: "CARD-001", comments: [] } },
    });

    await store.dispatch(addComment({ projectId: TEST_BOARD_ID, cardId: "CARD-001", message: "test", author: "qa-1" }));

    expect(api.addComment).toHaveBeenCalledWith({
      projectId: TEST_BOARD_ID,
      cardId: "CARD-001",
      message: "test",
      author: "qa-1",
    });
  });

  test("createSprint passes projectId", async () => {
    const sprint = { objectId: "sp1", name: "Sprint 1", order: 1 };
    jest.spyOn(api, "createSprint").mockResolvedValue(sprint);
    const store = createStoreWithBoard();

    await store.dispatch(createSprint({ projectId: TEST_BOARD_ID, name: "Sprint 1", order: 1 }));

    expect(api.createSprint).toHaveBeenCalledWith({ projectId: TEST_BOARD_ID, name: "Sprint 1", order: 1 });
  });

  test("updateSprint passes projectId", async () => {
    const sprint = { objectId: "sp1", name: "Renamed", order: 2 };
    jest.spyOn(api, "updateSprint").mockResolvedValue(sprint);
    const store = createStoreWithBoard();

    await store.dispatch(updateSprint({ projectId: TEST_BOARD_ID, sprintId: "sp1", name: "Renamed" }));

    expect(api.updateSprint).toHaveBeenCalledWith({ projectId: TEST_BOARD_ID, sprintId: "sp1", name: "Renamed" });
  });

  test("deleteSprint passes projectId", async () => {
    jest.spyOn(api, "deleteSprint").mockResolvedValue({ sprintId: "sp1" });
    const store = createStoreWithBoard();

    await store.dispatch(deleteSprint({ projectId: TEST_BOARD_ID, sprintId: "sp1" }));

    expect(api.deleteSprint).toHaveBeenCalledWith(TEST_BOARD_ID, "sp1");
  });
});

// CARD-218: articles are global — thunks no longer pass projectId to CRUD/list API calls
describe("articlesSlice: article CRUD thunks are global (no projectId)", () => {
  test("fetchArticles calls listArticles with no args", async () => {
    jest.spyOn(api, "listArticles").mockResolvedValue({ articles: [] });
    const store = createStoreWithBoard();
    await store.dispatch(fetchArticles());
    expect(api.listArticles).toHaveBeenCalledWith();
  });

  test("createArticle passes title without projectId", async () => {
    jest.spyOn(api, "createArticle").mockResolvedValue({ article: { objectId: "a1", title: "T" } });
    const store = createStoreWithBoard();
    await store.dispatch(createArticle({ title: "T" }));
    expect(api.createArticle).toHaveBeenCalledWith({ title: "T" });
  });

  test("updateArticle passes fields without projectId", async () => {
    jest.spyOn(api, "updateArticle").mockResolvedValue({ article: { objectId: "a1", title: "T", text: "X" } });
    const store = createStoreWithBoard();
    await store.dispatch(updateArticle({ title: "T", text: "X" }));
    expect(api.updateArticle).toHaveBeenCalledWith({ title: "T", text: "X" });
  });

  test("deleteArticle passes title only (no projectId)", async () => {
    jest.spyOn(api, "deleteArticle").mockResolvedValue({});
    const store = createStoreWithBoard();
    await store.dispatch(deleteArticle({ title: "T" }));
    expect(api.deleteArticle).toHaveBeenCalledWith("T");
  });

  test("searchArticles passes query without projectId", async () => {
    jest.spyOn(api, "searchArticles").mockResolvedValue({ articles: [] });
    const store = createStoreWithBoard();
    await store.dispatch(searchArticles({ query: "test" }));
    expect(api.searchArticles).toHaveBeenCalledWith({ query: "test", keywords: undefined });
  });

  test("getArticle passes title only (no projectId)", async () => {
    jest.spyOn(api, "getArticle").mockResolvedValue({ article: { objectId: "a1", title: "T" } });
    const store = createStoreWithBoard();
    await store.dispatch(getArticle({ title: "T" }));
    expect(api.getArticle).toHaveBeenCalledWith("T");
  });

  test("fetchLinkedArticles passes projectId", async () => {
    jest.spyOn(api, "getProjectArticles").mockResolvedValue({ articles: [] });
    const store = createStoreWithBoard();
    await store.dispatch(fetchLinkedArticles(TEST_BOARD_ID));
    expect(api.getProjectArticles).toHaveBeenCalledWith(TEST_BOARD_ID);
  });

  test("linkArticle passes projectId", async () => {
    jest.spyOn(api, "linkArticleToProject").mockResolvedValue({
      success: true,
      linked: true,
      article: { objectId: "a1", title: "T" },
    });
    const store = createStoreWithBoard();
    await store.dispatch(linkArticle({ projectId: TEST_BOARD_ID, articleTitle: "T" }));
    expect(api.linkArticleToProject).toHaveBeenCalledWith({ projectId: TEST_BOARD_ID, articleTitle: "T" });
  });

  test("unlinkArticle passes projectId", async () => {
    jest.spyOn(api, "unlinkArticleFromProject").mockResolvedValue({ success: true });
    const store = createStoreWithBoard();
    await store.dispatch(unlinkArticle({ projectId: TEST_BOARD_ID, articleTitle: "T" }));
    expect(api.unlinkArticleFromProject).toHaveBeenCalledWith({ projectId: TEST_BOARD_ID, articleTitle: "T" });
  });
});

describe("commandsSlice: thunks pass projectId to API", () => {
  test("fetchRecentCommands passes projectId", async () => {
    jest.spyOn(api, "listRecentCommands").mockResolvedValue({ commands: [] });
    const store = createStoreWithBoard();
    await store.dispatch(fetchRecentCommands(TEST_BOARD_ID));
    expect(api.listRecentCommands).toHaveBeenCalledWith(TEST_BOARD_ID);
  });

  test("createCommand passes projectId", async () => {
    jest.spyOn(api, "createCommand").mockResolvedValue({
      objectId: "cmd1",
      action: "stop_all",
      status: "requested",
    });
    const store = createStoreWithBoard();
    await store.dispatch(createCommand({ projectId: TEST_BOARD_ID, action: "stop_all" }));
    expect(api.createCommand).toHaveBeenCalledWith(TEST_BOARD_ID, "stop_all");
  });

  test("fetchLatestPing passes projectId", async () => {
    jest.spyOn(api, "getLatestPing").mockResolvedValue({ ping: null });
    const store = createStoreWithBoard();
    await store.dispatch(fetchLatestPing(TEST_BOARD_ID));
    expect(api.getLatestPing).toHaveBeenCalledWith(TEST_BOARD_ID);
  });
});

describe("agentsSlice: project-scoped thunks pass projectId to API", () => {
  test("fetchAgents passes projectId", async () => {
    jest.spyOn(api, "getAgents").mockResolvedValue({ agents: [] });
    const store = createStoreWithBoard();
    await store.dispatch(fetchAgents(TEST_BOARD_ID));
    expect(api.getAgents).toHaveBeenCalledWith(TEST_BOARD_ID);
  });

  test("assignAgent passes projectId", async () => {
    jest.spyOn(api, "assignAgentToProject").mockResolvedValue({
      success: true,
      projectAgent: { agentName: "pm-1", projectId: TEST_BOARD_ID, isActive: true, sortOrder: 0 },
    });
    const store = createStoreWithBoard();
    await store.dispatch(assignAgent({ projectId: TEST_BOARD_ID, agentName: "pm-1" }));
    expect(api.assignAgentToProject).toHaveBeenCalledWith({ projectId: TEST_BOARD_ID, agentName: "pm-1" });
  });

  test("unassignAgent passes projectId", async () => {
    jest.spyOn(api, "unassignAgentFromProject").mockResolvedValue({ success: true });
    const store = createStoreWithBoard();
    await store.dispatch(unassignAgent({ projectId: TEST_BOARD_ID, agentName: "pm-1" }));
    expect(api.unassignAgentFromProject).toHaveBeenCalledWith({ projectId: TEST_BOARD_ID, agentName: "pm-1" });
  });

  test("updateProjectAgent passes projectId", async () => {
    jest.spyOn(api, "updateProjectAgent").mockResolvedValue({
      projectAgent: { agentName: "pm-1", isActive: false, sortOrder: 0 },
    });
    const store = createStoreWithBoard();
    await store.dispatch(updateProjectAgent({ projectId: TEST_BOARD_ID, agentName: "pm-1", isActive: false }));
    expect(api.updateProjectAgent).toHaveBeenCalledWith({
      projectId: TEST_BOARD_ID,
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
      "store/projectSlice.js",
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
// All operations should use board.objectId (not board.projectHash) as projectId.

describe("E2E: board loaded → card operations use board.objectId as projectId", () => {
  test("full flow: fetchCards after board load uses objectId", async () => {
    jest.spyOn(api, "getOrCreateProject").mockResolvedValue({
      project: { objectId: TEST_BOARD_ID, nextId: 1 },
      cards: [],
      sprints: [],
    });
    jest.spyOn(api, "listCards").mockResolvedValue({
      cards: [{ cardId: "CARD-001", title: "Test", status: "create" }],
    });

    const { fetchProject } = await import("../src/store/projectSlice");
    const store = configureStore({
      reducer: { project: projectReducer },
    });

    // Simulate: user opens project, board loads
    await store.dispatch(fetchProject("C:\\test\\project"));
    const projectId = store.getState().project.project?.objectId;
    expect(projectId).toBe(TEST_BOARD_ID);

    // Then: cards are refreshed using the loaded board's objectId
    await store.dispatch(fetchCards({ projectId, status: "create" }));
    expect(api.listCards).toHaveBeenCalledWith(TEST_BOARD_ID, "create", undefined);
  });

  test("full flow: messages sent after board load use objectId", async () => {
    jest.spyOn(api, "sendMessage").mockResolvedValue({ success: true, messageId: "m-001" });

    // Board already loaded in store
    const store = createStoreWithBoard();
    expect(store.getState().project.project.objectId).toBe(TEST_BOARD_ID);

    // User sends a message — slice reads board.objectId from state
    await store.dispatch(sendMessage({ to: "developer-1", message: "Ready for review" }));

    expect(api.sendMessage).toHaveBeenCalledWith({
      projectId: TEST_BOARD_ID,
      from: "owner",
      to: "developer-1",
      message: "Ready for review",
    });
  });

  // CARD-218: articles are global — fetchArticles takes no projectId
  test("full flow: articles fetched globally without projectId", async () => {
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
    const projectId = store.getState().project.project.objectId;

    await store.dispatch(fetchRecentCommands(projectId));

    expect(api.listRecentCommands).toHaveBeenCalledWith(TEST_BOARD_ID);
    expect(store.getState().commands.commands).toHaveLength(1);
  });

  test("full flow: agents assigned using objectId, not projectHash", async () => {
    jest.spyOn(api, "assignAgentToProject").mockResolvedValue({
      success: true,
      projectAgent: { agentName: "developer-1", isActive: true, sortOrder: 1 },
    });

    const store = createStoreWithBoard();
    const projectId = store.getState().project.project.objectId;

    await store.dispatch(assignAgent({ projectId, agentName: "developer-1" }));

    const callArg = api.assignAgentToProject.mock.calls[0][0];
    expect(callArg.projectId).toBe(TEST_BOARD_ID);
    expect(callArg.projectId).not.toBe(undefined);
    // Critically: no projectHash should be present
    expect(callArg.projectHash).toBeUndefined();
  });
});

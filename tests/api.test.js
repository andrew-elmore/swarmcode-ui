/**
 * Tests for services/api.js — Parse Cloud Function client service layer.
 * All network calls are mocked via global.fetch.
 */

import {
  sendMessage,
  pollMessages,
  getConversation,
  subscribeToMessages,
  getOrCreateBoard,
  createCard,
  updateCard,
  addComment,
  listCards,
  showCard,
  pollBoard,
  addRecentProject,
  getRecentProjects,
} from "../src/services/api.js";

// --- Mock fetch globally ---

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockFetchSuccess(result) {
  global.fetch.mockResolvedValueOnce({
    json: async () => ({ result }),
  });
}

function mockFetchError(errorMessage) {
  global.fetch.mockResolvedValueOnce({
    json: async () => ({ error: errorMessage }),
  });
}

function getLastFetchBody() {
  const call = global.fetch.mock.calls[0];
  return JSON.parse(call[1].body);
}

function getLastFetchUrl() {
  return global.fetch.mock.calls[0][0];
}

// ─── sendMessage ─────────────────────────────────────────────────────────────

describe("api.sendMessage", () => {
  test("calls sendMessage endpoint with correct params", async () => {
    mockFetchSuccess({ success: true, messageId: "abc123" });
    const result = await sendMessage({
      from: "qa-1",
      to: "developer-1",
      message: "Hello",
    });
    expect(getLastFetchUrl()).toContain("/functions/sendMessage");
    expect(getLastFetchBody()).toEqual({
      from: "qa-1",
      to: "developer-1",
      message: "Hello",
    });
    expect(result).toEqual({ success: true, messageId: "abc123" });
  });

  test("throws on API error", async () => {
    mockFetchError("Unknown sender 'bad-agent'");
    await expect(
      sendMessage({ from: "bad-agent", to: "qa-1", message: "Y" })
    ).rejects.toThrow("Unknown sender 'bad-agent'");
  });
});

// ─── pollMessages ────────────────────────────────────────────────────────────

describe("api.pollMessages", () => {
  test("calls pollMessages without since when not provided", async () => {
    mockFetchSuccess({ messages: [] });
    await pollMessages();
    expect(getLastFetchBody()).toEqual({});
  });

  test("passes since parameter when provided", async () => {
    const since = "2026-02-07T12:00:00.000Z";
    mockFetchSuccess({ messages: [] });
    await pollMessages(since);
    expect(getLastFetchBody()).toEqual({ since });
  });

  test("returns messages array", async () => {
    const msgs = [{ from: "pm-1", to: "qa-1", subject: "Hi", message: "Hello" }];
    mockFetchSuccess({ messages: msgs });
    const result = await pollMessages();
    expect(result.messages).toEqual(msgs);
  });
});

// ─── getConversation ─────────────────────────────────────────────────────────

describe("api.getConversation", () => {
  test("calls getConversation with userA and userB", async () => {
    mockFetchSuccess({ messages: [] });
    await getConversation("owner", "pm-1");
    expect(getLastFetchUrl()).toContain("/functions/getConversation");
    expect(getLastFetchBody()).toEqual({ userA: "owner", userB: "pm-1" });
  });

  test("returns messages array", async () => {
    const msgs = [
      { from: "owner", to: "pm-1", message: "Hello", createdAt: "2026-01-01T00:00:00Z" },
    ];
    mockFetchSuccess({ messages: msgs });
    const result = await getConversation("owner", "pm-1");
    expect(result.messages).toEqual(msgs);
  });
});

// ─── subscribeToMessages ─────────────────────────────────────────────────────

describe("api.subscribeToMessages", () => {
  test("returns an unsubscribe function", async () => {
    const unsubscribe = await subscribeToMessages(jest.fn());
    expect(typeof unsubscribe).toBe("function");
  });

  test("calls onMessage when a new message is created", async () => {
    const Parse = require("parse");

    // Capture the 'create' handler registered on the subscription
    let createHandler = null;
    const mockSubscription = {
      on: jest.fn((event, handler) => {
        if (event === "create") createHandler = handler;
      }),
      unsubscribe: jest.fn(),
    };
    Parse.Query.mockImplementationOnce(() => ({
      subscribe: jest.fn().mockResolvedValue(mockSubscription),
    }));

    const onMessage = jest.fn();
    await subscribeToMessages(onMessage);

    // Simulate a new Message object arriving via LiveQuery
    const mockObject = {
      id: "msg-001",
      get: jest.fn((key) => {
        const data = {
          from: "pm-1",
          to: "owner",
          subject: "Test",
          message: "Hello from LiveQuery",
          createdAt: "2026-01-01T00:00:00Z",
          broadcast: false,
          broadcastId: null,
        };
        return data[key];
      }),
    };

    expect(createHandler).not.toBeNull();
    createHandler(mockObject);

    expect(onMessage).toHaveBeenCalledWith({
      id: "msg-001",
      from: "pm-1",
      to: "owner",
      subject: "Test",
      message: "Hello from LiveQuery",
      createdAt: "2026-01-01T00:00:00Z",
      broadcast: false,
      broadcastId: null,
    });
  });

  test("unsubscribes previous subscription when called again", async () => {
    const Parse = require("parse");

    const mockSub1 = { on: jest.fn(), unsubscribe: jest.fn() };
    const mockSub2 = { on: jest.fn(), unsubscribe: jest.fn() };

    Parse.Query
      .mockImplementationOnce(() => ({
        subscribe: jest.fn().mockResolvedValue(mockSub1),
      }))
      .mockImplementationOnce(() => ({
        subscribe: jest.fn().mockResolvedValue(mockSub2),
      }));

    await subscribeToMessages(jest.fn());
    await subscribeToMessages(jest.fn());

    expect(mockSub1.unsubscribe).toHaveBeenCalled();
  });
});

// ─── getOrCreateBoard ────────────────────────────────────────────────────────

describe("api.getOrCreateBoard", () => {
  test("sends projectPath to getOrCreateBoard", async () => {
    mockFetchSuccess({ board: { projectHash: "abc" }, cards: [] });
    await getOrCreateBoard("C:\\test\\project");
    expect(getLastFetchUrl()).toContain("/functions/getOrCreateBoard");
    expect(getLastFetchBody()).toEqual({ projectPath: "C:\\test\\project" });
  });
});

// ─── createCard ──────────────────────────────────────────────────────────────

describe("api.createCard", () => {
  test("sends all card fields", async () => {
    mockFetchSuccess({ card: { cardId: "CARD-001" } });
    await createCard({
      projectHash: "abc",
      title: "Test Card",
      description: "Desc",
      status: "todo",
      assignee: "developer-1",
      priority: "high",
      author: "pm-1",
    });
    const body = getLastFetchBody();
    expect(body.projectHash).toBe("abc");
    expect(body.title).toBe("Test Card");
    expect(body.status).toBe("todo");
    expect(body.assignee).toBe("developer-1");
    expect(body.priority).toBe("high");
    expect(body.author).toBe("pm-1");
  });

  test("throws on missing title error", async () => {
    mockFetchError("Title is required");
    await expect(
      createCard({ projectHash: "abc", author: "qa-1" })
    ).rejects.toThrow("Title is required");
  });
});

// ─── updateCard ──────────────────────────────────────────────────────────────

describe("api.updateCard", () => {
  test("only sends non-undefined fields", async () => {
    mockFetchSuccess({ card: { cardId: "CARD-001", status: "done" }, changes: "status: todo -> done" });
    await updateCard({
      projectHash: "abc",
      cardId: "CARD-001",
      status: "done",
      author: "developer-1",
    });
    const body = getLastFetchBody();
    expect(body.projectHash).toBe("abc");
    expect(body.cardId).toBe("CARD-001");
    expect(body.status).toBe("done");
    expect(body.author).toBe("developer-1");
    // assignee, priority, title, description should not be in the body
    expect(body.assignee).toBeUndefined();
    expect(body.priority).toBeUndefined();
  });

  test("throws on no changes error", async () => {
    mockFetchError("No changes specified");
    await expect(
      updateCard({ projectHash: "abc", cardId: "CARD-001", author: "qa-1" })
    ).rejects.toThrow("No changes specified");
  });
});

// ─── addComment ──────────────────────────────────────────────────────────────

describe("api.addComment", () => {
  test("sends comment params", async () => {
    mockFetchSuccess({ comment: { objectId: "c1" } });
    await addComment({
      projectHash: "abc",
      cardId: "CARD-001",
      message: "Test comment",
      author: "qa-1",
    });
    const body = getLastFetchBody();
    expect(body.projectHash).toBe("abc");
    expect(body.cardId).toBe("CARD-001");
    expect(body.message).toBe("Test comment");
    expect(body.author).toBe("qa-1");
  });
});

// ─── listCards ────────────────────────────────────────────────────────────────

describe("api.listCards", () => {
  test("sends projectHash without status filter", async () => {
    mockFetchSuccess({ cards: [] });
    await listCards("abc");
    const body = getLastFetchBody();
    expect(body.projectHash).toBe("abc");
    expect(body.status).toBeUndefined();
  });

  test("sends status filter when provided", async () => {
    mockFetchSuccess({ cards: [] });
    await listCards("abc", "todo");
    const body = getLastFetchBody();
    expect(body.status).toBe("todo");
  });
});

// ─── showCard ────────────────────────────────────────────────────────────────

describe("api.showCard", () => {
  test("sends projectHash and cardId", async () => {
    mockFetchSuccess({ card: { cardId: "CARD-001", comments: [] } });
    await showCard("abc", "CARD-001");
    const body = getLastFetchBody();
    expect(body.projectHash).toBe("abc");
    expect(body.cardId).toBe("CARD-001");
  });
});

// ─── pollBoard ───────────────────────────────────────────────────────────────

describe("api.pollBoard", () => {
  test("sends projectHash without since", async () => {
    mockFetchSuccess({ changed: false, cards: [] });
    await pollBoard("abc");
    const body = getLastFetchBody();
    expect(body.projectHash).toBe("abc");
    expect(body.since).toBeUndefined();
  });

  test("sends since when provided", async () => {
    mockFetchSuccess({ changed: true, cards: [] });
    await pollBoard("abc", "2026-02-07T00:00:00Z");
    const body = getLastFetchBody();
    expect(body.since).toBe("2026-02-07T00:00:00Z");
  });
});

// ─── addRecentProject ────────────────────────────────────────────────────────

describe("api.addRecentProject", () => {
  test("sends path and name", async () => {
    mockFetchSuccess({ success: true });
    await addRecentProject("C:\\test\\proj", "proj");
    const body = getLastFetchBody();
    expect(body.path).toBe("C:\\test\\proj");
    expect(body.name).toBe("proj");
  });
});

// ─── getRecentProjects ───────────────────────────────────────────────────────

describe("api.getRecentProjects", () => {
  test("sends empty params", async () => {
    mockFetchSuccess({ projects: [] });
    await getRecentProjects();
    expect(getLastFetchUrl()).toContain("/functions/getRecentProjects");
    expect(getLastFetchBody()).toEqual({});
  });

  test("returns projects list", async () => {
    const projects = [{ path: "C:\\test", name: "test", lastOpened: "2026-02-07" }];
    mockFetchSuccess({ projects });
    const result = await getRecentProjects();
    expect(result.projects).toEqual(projects);
  });
});

// ─── Headers and URL ─────────────────────────────────────────────────────────

describe("api request configuration", () => {
  test("includes X-Parse-Application-Id and X-Parse-REST-API-Key headers", async () => {
    mockFetchSuccess({ projects: [] });
    await getRecentProjects();
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers["X-Parse-Application-Id"]).toBe("swarmcode");
    expect(headers["X-Parse-REST-API-Key"]).toBeDefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  test("uses POST method", async () => {
    mockFetchSuccess({ projects: [] });
    await getRecentProjects();
    expect(global.fetch.mock.calls[0][1].method).toBe("POST");
  });
});

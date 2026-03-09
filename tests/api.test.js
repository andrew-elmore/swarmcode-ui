/**
 * Tests for services/api.js — Parse Cloud Function client service layer.
 * Cloud calls are mocked via Parse.Cloud.run.
 */

import Parse from "parse";
import {
  sendMessage,
  getConversation,
  subscribeToMessages,
  getOrCreateProject,
  createCard,
  updateCard,
  addComment,
  listCards,
  showCard,
  addRecentProject,
  getRecentProjects,
  deleteProject,
} from "../src/services/api.js";

beforeEach(() => {
  Parse.Cloud.run.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── sendMessage ─────────────────────────────────────────────────────────────

describe("api.sendMessage", () => {
  test("calls sendMessage with correct params", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true, messageId: "abc123" });
    const result = await sendMessage({
      projectId: "test-hash",
      from: "qa-1",
      to: "developer-1",
      message: "Hello",
    });
    expect(Parse.Cloud.run).toHaveBeenCalledWith("sendMessage", {
      projectId: "test-hash",
      from: "qa-1",
      to: "developer-1",
      message: "Hello",
    });
    expect(result).toEqual({ success: true, messageId: "abc123" });
  });

  test("throws on API error", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("Unknown sender 'bad-agent'"));
    await expect(
      sendMessage({ projectId: "test-hash", from: "bad-agent", to: "qa-1", message: "Y" })
    ).rejects.toThrow("Unknown sender 'bad-agent'");
  });
});


// ─── getConversation ─────────────────────────────────────────────────────────

describe("api.getConversation", () => {
  test("calls getConversation with projectId, user1 and user2", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ messages: [] });
    await getConversation("test-hash", "owner", "pm-1");
    expect(Parse.Cloud.run).toHaveBeenCalledWith("getConversation", {
      projectId: "test-hash",
      user1: "owner",
      user2: "pm-1",
    });
  });

  test("returns messages array", async () => {
    const msgs = [
      { from: "owner", to: "pm-1", message: "Hello", createdAt: "2026-01-01T00:00:00Z" },
    ];
    Parse.Cloud.run.mockResolvedValueOnce({ messages: msgs });
    const result = await getConversation("test-hash", "owner", "pm-1");
    expect(result.messages).toEqual(msgs);
  });
});

// ─── subscribeToMessages ─────────────────────────────────────────────────────

describe("api.subscribeToMessages", () => {
  test("returns an unsubscribe function", async () => {
    const unsubscribe = await subscribeToMessages("test-board-id", jest.fn());
    expect(typeof unsubscribe).toBe("function");
  });

  test("calls onMessage when a new message is created", async () => {
    let createHandler = null;
    const mockSubscription = {
      on: jest.fn((event, handler) => {
        if (event === "create") createHandler = handler;
      }),
      unsubscribe: jest.fn(),
    };
    Parse.Query.mockImplementationOnce(() => ({
      equalTo: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(mockSubscription),
    }));

    const onMessage = jest.fn();
    await subscribeToMessages("test-board-id", onMessage);

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
      fromId: null,
      toId: null,
      subject: "Test",
      message: "Hello from LiveQuery",
      createdAt: "2026-01-01T00:00:00Z",
      broadcast: false,
      broadcastId: null,
    });
  });

  test("unsubscribes previous subscription when called again", async () => {
    const mockSub1 = { on: jest.fn(), unsubscribe: jest.fn() };
    const mockSub2 = { on: jest.fn(), unsubscribe: jest.fn() };

    Parse.Query
      .mockImplementationOnce(() => ({
        equalTo: jest.fn(),
        subscribe: jest.fn().mockResolvedValue(mockSub1),
      }))
      .mockImplementationOnce(() => ({
        equalTo: jest.fn(),
        subscribe: jest.fn().mockResolvedValue(mockSub2),
      }));

    await subscribeToMessages("test-board-id", jest.fn());
    await subscribeToMessages("test-board-id", jest.fn());

    expect(mockSub1.unsubscribe).toHaveBeenCalled();
  });
});

// ─── getOrCreateProject ────────────────────────────────────────────────────────

describe("api.getOrCreateProject", () => {
  test("sends projectPath to getOrCreateProject", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ project: { objectId: "abc" }, cards: [] });
    await getOrCreateProject("C:\\test\\project");
    expect(Parse.Cloud.run).toHaveBeenCalledWith("getOrCreateProject", {
      projectPath: "C:\\test\\project",
    });
  });
});

// ─── createCard ──────────────────────────────────────────────────────────────

describe("api.createCard", () => {
  test("sends all card fields", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ card: { cardId: "CARD-001" } });
    await createCard({
      projectId: "abc",
      title: "Test Card",
      description: "Desc",
      status: "scope",
      assignee: "developer-1",
      priority: "high",
      author: "pm-1",
    });
    expect(Parse.Cloud.run).toHaveBeenCalledWith("createCard", {
      projectId: "abc",
      title: "Test Card",
      description: "Desc",
      status: "scope",
      assignee: "developer-1",
      priority: "high",
      author: "pm-1",
    });
  });

  test("throws on missing title error", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("Title is required"));
    await expect(
      createCard({ projectId: "abc", author: "qa-1" })
    ).rejects.toThrow("Title is required");
  });
});

// ─── updateCard ──────────────────────────────────────────────────────────────

describe("api.updateCard", () => {
  test("only sends non-undefined fields", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({
      card: { cardId: "CARD-001", status: "done" },
      changes: "status: scope -> done",
    });
    await updateCard({
      projectId: "abc",
      cardId: "CARD-001",
      status: "done",
      author: "developer-1",
    });
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe("abc");
    expect(params.cardId).toBe("CARD-001");
    expect(params.status).toBe("done");
    expect(params.author).toBe("developer-1");
    expect(params.assignee).toBeUndefined();
    expect(params.priority).toBeUndefined();
  });

  test("throws on no changes error", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("No changes specified"));
    await expect(
      updateCard({ projectId: "abc", cardId: "CARD-001", author: "qa-1" })
    ).rejects.toThrow("No changes specified");
  });
});

// ─── addComment ──────────────────────────────────────────────────────────────

describe("api.addComment", () => {
  test("sends comment params", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ comment: { objectId: "c1" } });
    await addComment({
      projectId: "abc",
      cardId: "CARD-001",
      message: "Test comment",
      author: "qa-1",
    });
    expect(Parse.Cloud.run).toHaveBeenCalledWith("addComment", {
      projectId: "abc",
      cardId: "CARD-001",
      message: "Test comment",
      author: "qa-1",
    });
  });
});

// ─── listCards ────────────────────────────────────────────────────────────────

describe("api.listCards", () => {
  test("sends projectId without status filter", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ cards: [] });
    await listCards("abc");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.projectId).toBe("abc");
    expect(params.status).toBeUndefined();
  });

  test("sends status filter when provided", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ cards: [] });
    await listCards("abc", "scope");
    const params = Parse.Cloud.run.mock.calls[0][1];
    expect(params.status).toBe("scope");
  });
});

// ─── showCard ────────────────────────────────────────────────────────────────

describe("api.showCard", () => {
  test("sends projectId and cardId", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ card: { cardId: "CARD-001", comments: [] } });
    await showCard("abc", "CARD-001");
    expect(Parse.Cloud.run).toHaveBeenCalledWith("showCard", {
      projectId: "abc",
      cardId: "CARD-001",
    });
  });
});


// ─── addRecentProject ────────────────────────────────────────────────────────

describe("api.addRecentProject", () => {
  test("sends path and name", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await addRecentProject("C:\\test\\proj", "proj");
    expect(Parse.Cloud.run).toHaveBeenCalledWith("addRecentProject", {
      path: "C:\\test\\proj",
      name: "proj",
    });
  });
});

// ─── getRecentProjects ───────────────────────────────────────────────────────

describe("api.getRecentProjects", () => {
  test("sends empty params", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ projects: [] });
    await getRecentProjects();
    expect(Parse.Cloud.run).toHaveBeenCalledWith("getRecentProjects", {});
  });

  test("returns projects list", async () => {
    const projects = [{ path: "C:\\test", name: "test", lastOpened: "2026-02-07" }];
    Parse.Cloud.run.mockResolvedValueOnce({ projects });
    const result = await getRecentProjects();
    expect(result.projects).toEqual(projects);
  });
});

// ─── Parse SDK initialization ────────────────────────────────────────────────

describe("Parse SDK initialization", () => {
  test("Parse.initialize was called", () => {
    expect(Parse.initialize).toHaveBeenCalled();
  });
});

// ─── deleteProject ──────────────────────────────────────────────────────────

describe("api.deleteProject", () => {
  test("sends path to deleteProject", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });
    await deleteProject("C:\\test\\proj");
    expect(Parse.Cloud.run).toHaveBeenCalledWith("deleteProject", {
      path: "C:\\test\\proj",
    });
  });

  test("throws on API error", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("Project not found"));
    await expect(deleteProject("C:\\bad")).rejects.toThrow("Project not found");
  });
});

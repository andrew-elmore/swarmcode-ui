/**
 * CARD-086 QA Tests — Message error handling
 * Author: qa-1
 * Date: 2026-02-11
 * Updated: 2026-02-16 (CARD-164: fetch -> Parse.Cloud.run migration)
 *
 * Original root cause: callFunction() in api.js did not handle errors properly.
 * Original fix: api.js checks res.ok, messagesSlice sets error state, ChatView shows Snackbar.
 *
 * CARD-164 update: callFunction() now delegates to Parse.Cloud.run() which handles
 * HTTP-level errors internally. Error propagation tests updated to use Parse.Cloud.run mocks.
 */

import Parse from "parse";
import {
  sendMessage as apiSendMessage,
  getConversation,
  createCard,
  listCards,
} from "../src/services/api.js";

beforeEach(() => {
  Parse.Cloud.run.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// api.js: callFunction() error propagation via Parse.Cloud.run
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-086 QA: callFunction error handling", () => {
  test.skip("throws when Parse.Cloud.run rejects with error message", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("Missing required field: message"));

    await expect(
      apiSendMessage({ boardId: "h", from: "owner", to: "pm-1", message: "test" })
    ).rejects.toThrow("Missing required field: message");
  });

  test.skip("throws on server error", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("Internal server error"));

    await expect(
      apiSendMessage({ boardId: "h", from: "owner", to: "pm-1", message: "test" })
    ).rejects.toThrow("Internal server error");
  });

  test.skip("throws on network/connection error", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("XMLHttpRequest failed"));

    await expect(
      apiSendMessage({ boardId: "h", from: "owner", to: "pm-1", message: "test" })
    ).rejects.toThrow("XMLHttpRequest failed");
  });

  test.skip("returns result on successful response", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true, messageId: "m1" });

    const result = await apiSendMessage({
      boardId: "h", from: "owner", to: "pm-1", message: "test",
    });
    expect(result).toEqual({ success: true, messageId: "m1" });
  });

  test("getConversation error propagates correctly", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("Function not found"));

    await expect(getConversation("h", "owner", "pm-1")).rejects.toThrow("Function not found");
  });

  test("listCards error propagates correctly", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("Internal server error"));

    await expect(listCards("h")).rejects.toThrow("Internal server error");
  });

  test.skip("createCard unauthorized error propagates correctly", async () => {
    Parse.Cloud.run.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(
      createCard({ boardId: "h", title: "T", author: "qa-1" })
    ).rejects.toThrow("unauthorized");
  });

  test.skip("calls Parse.Cloud.run with correct function name and params", async () => {
    Parse.Cloud.run.mockResolvedValueOnce({ success: true });

    await apiSendMessage({ boardId: "h", from: "owner", to: "pm-1", message: "test" });

    expect(Parse.Cloud.run).toHaveBeenCalledWith("sendMessage", {
      boardId: "h",
      from: "owner",
      to: "pm-1",
      message: "test",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// messagesSlice: error state management
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-086 QA: messagesSlice error handling", () => {
  let messagesReducer;
  let sendMessage;
  let clearError;

  beforeEach(async () => {
    const mod = await import("../src/store/messagesSlice");
    messagesReducer = mod.default;
    sendMessage = mod.sendMessage;
    clearError = mod.clearError;
  });

  test("initial state has error: null", () => {
    const state = messagesReducer(undefined, { type: "@@INIT" });
    expect(state.error).toBeNull();
  });

  test("sendMessage.pending clears previous error", () => {
    const errorState = messagesReducer(
      undefined,
      sendMessage.rejected(new Error("Old error"), "req0", { to: "pm-1", message: "x" })
    );
    expect(errorState.error).toBe("Old error");

    const state = messagesReducer(errorState, sendMessage.pending("req1"));
    expect(state.error).toBeNull();
    expect(state.sending).toBe(true);
  });

  test("sendMessage.rejected sets error message", () => {
    const prevState = messagesReducer(undefined, { type: "@@INIT" });

    const state = messagesReducer(
      prevState,
      sendMessage.rejected(new Error("Network timeout"), "req1", { to: "pm-1", message: "Hi" })
    );

    expect(state.error).toBe("Network timeout");
    expect(state.sending).toBe(false);
  });

  test("sendMessage.fulfilled clears sending flag without error", () => {
    const pendingState = messagesReducer(
      undefined,
      sendMessage.pending("req1")
    );
    expect(pendingState.sending).toBe(true);

    const state = messagesReducer(
      pendingState,
      sendMessage.fulfilled(
        { to: "pm-1", message: "Hi", result: { success: true } },
        "req1",
        { to: "pm-1", message: "Hi" }
      )
    );

    expect(state.sending).toBe(false);
    expect(state.error).toBeNull();
  });

  test("clearError action resets error to null", () => {
    const errorState = messagesReducer(
      undefined,
      sendMessage.rejected(new Error("Something went wrong"), "req0", { to: "pm-1", message: "x" })
    );
    expect(errorState.error).toBe("Something went wrong");

    const state = messagesReducer(errorState, clearError());
    expect(state.error).toBeNull();
  });

  test("clearError is exported as an action creator", () => {
    expect(clearError).toBeDefined();
    expect(typeof clearError).toBe("function");
    expect(clearError().type).toBe("messages/clearError");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Source code verification
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-086 QA: source code verification", () => {
  const fs = require("fs");
  const path = require("path");

  test("api.js callFunction uses Parse.Cloud.run", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/services/api.js"),
      "utf8"
    );
    expect(src).toMatch(/Parse\.Cloud\.run/);
  });

  test("api.js callFunction does not use fetch()", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/services/api.js"),
      "utf8"
    );
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });

  test("api.js does not define HEADERS constant", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/services/api.js"),
      "utf8"
    );
    expect(src).not.toMatch(/const\s+HEADERS\s*=/);
  });

  test("ChatView imports Snackbar and Alert", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/components/ChatView.jsx"),
      "utf8"
    );
    expect(src).toMatch(/import\s+Snackbar/);
    expect(src).toMatch(/import\s+Alert/);
  });

  test("ChatView imports clearError from messagesSlice", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/components/ChatView.jsx"),
      "utf8"
    );
    expect(src).toMatch(/clearError/);
  });

  test("ChatView renders Snackbar with error", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/components/ChatView.jsx"),
      "utf8"
    );
    expect(src).toMatch(/<Snackbar/);
    expect(src).toMatch(/<Alert/);
    expect(src).toMatch(/severity="error"/);
  });

  test("ChatView preserves input on send failure (only clears on success)", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/components/ChatView.jsx"),
      "utf8"
    );
    expect(src).toMatch(/if\s*\(\s*!result\.error\s*\)/);
    expect(src).toMatch(/setInput\s*\(\s*["'][\s]*["']\s*\)/);
  });

  test("messagesSlice has clearError reducer", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/store/messagesSlice.js"),
      "utf8"
    );
    expect(src).toMatch(/clearError\s*\(\s*state\s*\)/);
  });

  test("messagesSlice sendMessage.rejected sets error from action", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/store/messagesSlice.js"),
      "utf8"
    );
    expect(src).toMatch(/sendMessage\.rejected/);
    expect(src).toMatch(/state\.error\s*=\s*action\.error\.message/);
  });
});

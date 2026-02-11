/**
 * CARD-086 QA Tests — Message error handling
 * Author: qa-1
 * Date: 2026-02-11
 *
 * Root cause: callFunction() in api.js did not check res.ok before parsing
 * JSON. When the server returned HTTP 4xx/5xx, the code fell through to
 * data.result which was undefined, silently swallowing errors. ChatView had
 * no error display, and the input field was always cleared even on failure.
 *
 * Fix:
 * 1. api.js: callFunction() checks res.ok, extracts error from JSON body
 *    or falls back to "API error <status>".
 * 2. messagesSlice: sendMessage.rejected sets state.error, clearError action.
 * 3. ChatView: Snackbar+Alert shows error, input preserved on send failure.
 */

import {
  sendMessage as apiSendMessage,
  getConversation,
  createCard,
  listCards,
} from "../src/services/api.js";

// --- Mock fetch globally ---

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// api.js: callFunction() error handling
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-086 QA: callFunction error handling", () => {
  test("throws with JSON error message when res.ok is false and body has error", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Missing required field: message" }),
    });

    await expect(
      apiSendMessage({ projectHash: "h", from: "owner", to: "pm-1", message: "test" })
    ).rejects.toThrow("Missing required field: message");
  });

  test("throws 'API error <status>' when res.ok is false and body has no error field", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ result: null }),
    });

    await expect(
      apiSendMessage({ projectHash: "h", from: "owner", to: "pm-1", message: "test" })
    ).rejects.toThrow("API error 502");
  });

  test("throws 'API error <status>' when res.ok is false and body is not JSON", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new Error("Unexpected token"); },
    });

    await expect(
      apiSendMessage({ projectHash: "h", from: "owner", to: "pm-1", message: "test" })
    ).rejects.toThrow("API error 503");
  });

  test("throws with error from data.error even when res.ok is true", async () => {
    // Some Parse Server responses return 200 with an error field in the body
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "Internal function error" }),
    });

    await expect(
      apiSendMessage({ projectHash: "h", from: "owner", to: "pm-1", message: "test" })
    ).rejects.toThrow("Internal function error");
  });

  test("returns result on successful response", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { success: true, messageId: "m1" } }),
    });

    const result = await apiSendMessage({
      projectHash: "h", from: "owner", to: "pm-1", message: "test",
    });
    expect(result).toEqual({ success: true, messageId: "m1" });
  });

  test("HTTP 404 error propagates correctly", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Function not found" }),
    });

    await expect(getConversation("h", "owner", "pm-1")).rejects.toThrow("Function not found");
  });

  test("HTTP 500 error propagates correctly", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    await expect(listCards("h")).rejects.toThrow("Internal server error");
  });

  test("HTTP 401 unauthorized error propagates correctly", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    });

    await expect(
      createCard({ projectHash: "h", title: "T", author: "qa-1" })
    ).rejects.toThrow("unauthorized");
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
    // First set an error via a rejected action, then verify pending clears it
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
    // First set sending=true via pending action
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
    // First set an error via rejected action
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

  test("api.js callFunction checks res.ok", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/services/api.js"),
      "utf8"
    );
    expect(src).toMatch(/if\s*\(\s*!res\.ok\s*\)/);
  });

  test("api.js callFunction includes status code in fallback error", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/services/api.js"),
      "utf8"
    );
    expect(src).toMatch(/API error.*res\.status/);
  });

  test("api.js callFunction tries to extract error from JSON body", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/services/api.js"),
      "utf8"
    );
    // Should try parsing JSON and checking body.error
    expect(src).toMatch(/body\.error/);
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
    // The setInput("") call should be inside an if (!result.error) block
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

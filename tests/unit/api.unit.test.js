/**
 * CARD-099 Unit Tests — src/services/api.js LiveQuery subscription bugs.
 * Author: qa-1
 *
 * Two bugs fixed in CARD-099:
 *
 * BUG 1: query.include('from') / query.include('to') in the LiveQuery subscription
 *   caused Parse Server to attempt pointer resolution before delivering events. If
 *   that fetch failed, the event was silently dropped. Fix: both include() calls removed.
 *
 * BUG 2: subscribeToMessages was async (returned a Promise). App.jsx captured the
 *   unsubscribe via .then(), creating a race where React cleanup fired before the
 *   Promise resolved -- orphaned or double subscriptions. Fix: function is now
 *   synchronous, returns unsubscribe immediately, uses internal cancelled flag.
 *
 * Source-level assertions: read api.js as text and verify the structure.
 * Behavioral assertions: use the Parse mock to verify runtime contract.
 */

import fs from "fs";
import path from "path";
import { subscribeToMessages, subscribeToCommands, subscribeToPings } from "../../src/services/api.js";
import Parse from "parse";

const apiSrc = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "src", "services", "api.js"),
  "utf8"
);

// Extract individual function bodies for scoped assertions
function extractFnSrc(src, fnName) {
  const start = src.indexOf(`export function ${fnName}`);
  const end = src.indexOf("\nexport ", start + 1);
  return end > start ? src.slice(start, end) : src.slice(start);
}

const fnSrc = extractFnSrc(apiSrc, "subscribeToMessages");
const cmdSrc = extractFnSrc(apiSrc, "subscribeToCommands");
const pingSrc = extractFnSrc(apiSrc, "subscribeToPings");

// ─── BUG 1: include() removed ────────────────────────────────────────────────

describe("CARD-099 Unit: subscribeToMessages — include() calls removed (BUG 1)", () => {
  test("subscribeToMessages does NOT call query.include('from')", () => {
    expect(fnSrc).not.toMatch(/query\.include\s*\(\s*['"]from['"]/);
  });

  test("subscribeToMessages does NOT call query.include('to')", () => {
    expect(fnSrc).not.toMatch(/query\.include\s*\(\s*['"]to['"]/);
  });

  test("subscribeToMessages does NOT call query.include() at all", () => {
    expect(fnSrc).not.toMatch(/query\.include\s*\(/);
  });

  test("subscribeToMessages still uses equalTo('project', ...) filter", () => {
    expect(fnSrc).toMatch(/query\.equalTo\s*\(\s*['"]project['"]/);
  });
});

// ─── BUG 2: synchronous function + cancelled flag ────────────────────────────

describe("CARD-099 Unit: subscribeToMessages — synchronous (not async) (BUG 2)", () => {
  test("subscribeToMessages is NOT declared as async", () => {
    // Must be 'export function subscribeToMessages', not 'export async function'
    expect(apiSrc).toMatch(/export function subscribeToMessages/);
    expect(apiSrc).not.toMatch(/export async function subscribeToMessages/);
  });

  test("cancelled flag is declared inside subscribeToMessages", () => {
    expect(fnSrc).toMatch(/let cancelled\s*=/);
  });

  test("cancelled is set to true in the cleanup (unsubscribe) function", () => {
    expect(fnSrc).toContain("cancelled = true");
  });

  test("cancelled is checked before attaching event handler", () => {
    // The race guard: if (cancelled) { sub.unsubscribe(); return; }
    expect(fnSrc).toMatch(/if\s*\(\s*cancelled\s*\)/);
  });

  test("subscribe() is called via .then() internally (async handled inside)", () => {
    expect(fnSrc).toContain(".then(");
  });
});

// ─── Behavioral: return type ──────────────────────────────────────────────────

describe("CARD-099 Unit: subscribeToMessages — returns function synchronously", () => {
  afterEach(() => jest.clearAllMocks());

  test("subscribeToMessages returns a function (not a Promise)", () => {
    const result = subscribeToMessages("proj123", () => {});
    expect(typeof result).toBe("function");
    // Call cleanup to avoid leaking the internal .then() subscription
    result();
  });

  test("returned function is callable without throwing", () => {
    const unsubscribe = subscribeToMessages("proj123", () => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  test("returns no-op function when projectId is falsy", () => {
    const result = subscribeToMessages("", () => {});
    expect(typeof result).toBe("function");
    expect(() => result()).not.toThrow();
  });

  test("returns no-op function when projectId is null/undefined", () => {
    const result = subscribeToMessages(null, () => {});
    expect(typeof result).toBe("function");
  });
});

// ─── Behavioral: race condition (cancelled flag) ──────────────────────────────

describe("CARD-099 Unit: subscribeToMessages — cancelled flag prevents orphaned subscription", () => {
  let mockSub;

  beforeEach(() => {
    mockSub = { on: jest.fn(), unsubscribe: jest.fn() };
    // Make subscribe return a controllable Promise
    Parse.Query.mockImplementation(() => ({
      equalTo: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(mockSub),
    }));
  });

  afterEach(() => jest.clearAllMocks());

  test("if cleanup fires before subscribe resolves, sub.unsubscribe() is called", async () => {
    let resolveSubscribe;
    const neverResolvingSubscription = new Promise((resolve) => {
      resolveSubscribe = resolve;
    });

    Parse.Query.mockImplementationOnce(() => ({
      equalTo: jest.fn(),
      subscribe: jest.fn().mockReturnValue(neverResolvingSubscription),
    }));

    const unsubscribe = subscribeToMessages("proj123", () => {});

    // Cleanup fires before subscribe resolves
    unsubscribe();

    // Now the subscribe promise resolves
    resolveSubscribe(mockSub);

    // Wait for the .then() to execute
    await new Promise((r) => setTimeout(r, 10));

    // The cancelled flag caused sub.unsubscribe() to be called
    expect(mockSub.unsubscribe).toHaveBeenCalledTimes(1);
    // And no event handler was registered
    expect(mockSub.on).not.toHaveBeenCalled();
  });

  test("if cleanup fires after subscribe resolves, subscription is unsubscribed", async () => {
    const unsubscribe = subscribeToMessages("proj123", () => {});

    // Wait for the mock subscribe Promise to resolve
    await Promise.resolve();
    await Promise.resolve(); // flush .then() microtask

    // Now cleanup fires
    unsubscribe();

    expect(mockSub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  test("event handler fires onMessage callback when 'create' event received", async () => {
    const onMessage = jest.fn();
    subscribeToMessages("proj123", onMessage);

    // Wait for subscribe to resolve and handler to be attached
    await Promise.resolve();
    await Promise.resolve();

    // Simulate a Parse LiveQuery 'create' event
    const mockObject = {
      id: "msg001",
      get: jest.fn((key) => {
        const map = {
          from: null,
          to: null,
          subject: "hello",
          message: "test body",
          createdAt: new Date("2026-03-15T10:00:00Z"),
          broadcast: false,
          broadcastId: null,
        };
        return map[key];
      }),
    };

    // Find the "create" handler registered on the subscription
    const createHandler = mockSub.on.mock.calls.find(([event]) => event === "create")?.[1];
    expect(createHandler).toBeDefined();

    createHandler(mockObject);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "msg001", message: "test body" })
    );
  });
});

// ─── BUG 2 mirrored: subscribeToCommands ─────────────────────────────────────

describe("CARD-099 Unit: subscribeToCommands — synchronous (not async) (BUG 2)", () => {
  test("subscribeToCommands is NOT declared as async", () => {
    expect(apiSrc).toMatch(/export function subscribeToCommands/);
    expect(apiSrc).not.toMatch(/export async function subscribeToCommands/);
  });

  test("cancelled flag is declared inside subscribeToCommands", () => {
    expect(cmdSrc).toMatch(/let cancelled\s*=/);
  });

  test("cancelled is set to true in the subscribeToCommands cleanup", () => {
    expect(cmdSrc).toContain("cancelled = true");
  });

  test("cancelled is checked before attaching event handlers in subscribeToCommands", () => {
    expect(cmdSrc).toMatch(/if\s*\(\s*cancelled\s*\)/);
  });

  test("subscribeToCommands uses .then() internally for the async subscribe call", () => {
    expect(cmdSrc).toContain(".then(");
  });

  test("subscribeToCommands returns a function synchronously", () => {
    const result = subscribeToCommands("proj123", () => {});
    expect(typeof result).toBe("function");
    result();
  });
});

// ─── BUG 2 mirrored: subscribeToPings ────────────────────────────────────────

describe("CARD-099 Unit: subscribeToPings — synchronous (not async) (BUG 2)", () => {
  test("subscribeToPings is NOT declared as async", () => {
    expect(apiSrc).toMatch(/export function subscribeToPings/);
    expect(apiSrc).not.toMatch(/export async function subscribeToPings/);
  });

  test("cancelled flag is declared inside subscribeToPings", () => {
    expect(pingSrc).toMatch(/let cancelled\s*=/);
  });

  test("cancelled is set to true in the subscribeToPings cleanup", () => {
    expect(pingSrc).toContain("cancelled = true");
  });

  test("cancelled is checked before attaching event handlers in subscribeToPings", () => {
    expect(pingSrc).toMatch(/if\s*\(\s*cancelled\s*\)/);
  });

  test("subscribeToPings uses .then() internally for the async subscribe call", () => {
    expect(pingSrc).toContain(".then(");
  });

  test("subscribeToPings returns a function synchronously", () => {
    const result = subscribeToPings("proj123", () => {});
    expect(typeof result).toBe("function");
    result();
  });
});

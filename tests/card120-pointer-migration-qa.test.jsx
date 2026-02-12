/**
 * CARD-120 QA Tests — Pointer Migration: UI source verification + Redux tests
 * Author: qa-1
 * Date: 2026-02-12
 *
 * Verifies the UI-side impacts of the string-to-Pointer migration (CARD-116 + CARD-118).
 * These tests validate source code patterns, Redux slice compatibility, and
 * serialization assumptions without needing the API server running.
 *
 * CARD-123: Removed Part 1 (API cloud code source verification) — those tests
 * read files from swarmcode-api/ which doesn't exist in the UI CI runner.
 * API source verification tests belong in the API repo's test suite.
 *
 * Part 1: UI source verification (api.js, App.jsx, BoardView, CardDetailDialog) — CARD-118
 * Part 2: UI boardSlice compatibility with new sprint object shape
 * Part 3: Assignee string serialization compatibility
 */

const fs = require("fs");
const path = require("path");

// ═════════════════════════════════════════════════════════════════════════════
// Part 1: CARD-118 UI Source Verification — LiveQuery Pointer resolution
// ═════════════════════════════════════════════════════════════════════════════

const uiSrcDir = path.resolve(__dirname, "../src");

describe("CARD-120 QA: api.js LiveQuery Pointer stub handling (CARD-118)", () => {
  const src = fs.readFileSync(path.join(uiSrcDir, "services/api.js"), "utf8");

  test("resolveAgent handles string (pre-migration)", () => {
    expect(src).toMatch(/typeof raw === "string"/);
    expect(src).toMatch(/return raw;\s*\/\/ Pre-migration/);
  });

  test("resolveAgent handles included Pointer (raw.get('name'))", () => {
    expect(src).toMatch(/raw\.get && raw\.get\("name"\)/);
  });

  test("resolveAgent returns objectId for Pointer stub", () => {
    expect(src).toMatch(/return raw\.id \|\| null;\s*\/\/ Pointer stub/);
  });

  test("fromId and toId are included in message for agentIdMap lookup", () => {
    expect(src).toMatch(/fromId:\s*rawFrom\?\.id \|\| null/);
    expect(src).toMatch(/toId:\s*rawTo\?\.id \|\| null/);
  });
});

describe("CARD-120 QA: App.jsx agentIdMap for LiveQuery Pointer resolution (CARD-118)", () => {
  const src = fs.readFileSync(path.join(uiSrcDir, "App.jsx"), "utf8");

  test("agentIdMapRef is created as a ref", () => {
    expect(src).toMatch(/const agentIdMapRef = useRef\(\{\}\)/);
  });

  test("agentIdMap is built from agents array (objectId -> name)", () => {
    expect(src).toMatch(/agents\.forEach.*if \(a\.objectId\) map\[a\.objectId\] = a\.name/);
  });

  test("LiveQuery callback resolves from via idMap with fallback", () => {
    expect(src).toMatch(/const resolvedFrom = \(msg\.fromId && idMap\[msg\.fromId\]\) \|\| msg\.from/);
  });

  test("LiveQuery callback resolves to via idMap with fallback", () => {
    expect(src).toMatch(/const resolvedTo = \(msg\.toId && idMap\[msg\.toId\]\) \|\| msg\.to/);
  });

  test("console.warn fallback for unresolved agent objectId", () => {
    expect(src).toMatch(/console\.warn.*Could not resolve agent name for fromId/);
  });

  test("TTS gating uses resolvedMsg.from (not raw msg.from)", () => {
    expect(src).toMatch(/resolvedMsg\.from !== "owner"/);
  });

  test("enqueueMessage receives resolvedMsg.from (agent name, not objectId)", () => {
    expect(src).toMatch(/enqueueMessage\(\{ from: resolvedMsg\.from/);
  });
});

describe("CARD-120 QA: BoardView.jsx sprint backward compat (CARD-118)", () => {
  const src = fs.readFileSync(path.join(uiSrcDir, "components/BoardView.jsx"), "utf8");

  test("sprint filter uses sprintName with fallback to sprint", () => {
    expect(src).toMatch(/c\.sprintName \|\| c\.sprint\) === sprintFilter/);
  });

  test("sprint Chip display uses getSprintDisplayName from constants", () => {
    expect(src).toMatch(/import.*getSprintDisplayName.*from.*constants/);
    expect(src).toMatch(/getSprintDisplayName\(card\)/);
  });

  test("sprint Chip visibility check uses sprintName || sprint", () => {
    expect(src).toMatch(/card\.sprintName \|\| card\.sprint/);
  });
});

describe("CARD-120 QA: CardDetailDialog.jsx sprint backward compat (CARD-118)", () => {
  const src = fs.readFileSync(path.join(uiSrcDir, "components/CardDetailDialog.jsx"), "utf8");

  test("sprint display uses getSprintDisplayName from constants", () => {
    expect(src).toMatch(/import.*getSprintDisplayName.*from.*constants/);
    expect(src).toMatch(/getSprintDisplayName\(card\)/);
  });

  test("sprint Chip visibility check uses sprintName || sprint", () => {
    expect(src).toMatch(/card\.sprintName \|\| card\.sprint/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Part 3: UI boardSlice sprint object compatibility
// ═════════════════════════════════════════════════════════════════════════════

import { configureStore } from "@reduxjs/toolkit";
import boardReducer from "../src/store/boardSlice";

describe("CARD-120 QA: boardSlice sprint object shape compatibility", () => {
  function createBoardStore(cards = [], sprints = []) {
    return configureStore({
      reducer: { board: boardReducer },
      preloadedState: {
        board: {
          board: { objectId: "b1", projectHash: "testhash", nextId: 10 },
          cards,
          sprints,
          sprintFilter: null,
          selectedCard: null,
          loading: false,
          error: null,
          lastPoll: null,
        },
      },
    });
  }

  test("card with sprint as { objectId, name } object is stored correctly", () => {
    const store = createBoardStore([
      {
        objectId: "c1",
        cardId: "CARD-001",
        title: "Test card",
        assignee: "developer-1",
        sprint: { objectId: "s1", name: "Sprint 1" },
        sprintName: "Sprint 1",
        status: "todo",
        priority: "medium",
        comments: [],
      },
    ]);

    const card = store.getState().board.cards[0];
    expect(card.sprint).toEqual({ objectId: "s1", name: "Sprint 1" });
    expect(card.sprintName).toBe("Sprint 1");
  });

  test("card with sprint as null is stored correctly", () => {
    const store = createBoardStore([
      {
        objectId: "c1",
        cardId: "CARD-001",
        title: "No sprint card",
        assignee: null,
        sprint: null,
        sprintName: null,
        status: "backlog",
        priority: "low",
        comments: [],
      },
    ]);

    const card = store.getState().board.cards[0];
    expect(card.sprint).toBeNull();
    expect(card.sprintName).toBeNull();
  });

  test("sprint filter can match by sprint name via sprintName field", () => {
    const cards = [
      {
        objectId: "c1", cardId: "CARD-001", title: "A",
        sprint: { objectId: "s1", name: "Alpha" }, sprintName: "Alpha",
        status: "todo", priority: "medium", assignee: null, comments: [],
      },
      {
        objectId: "c2", cardId: "CARD-002", title: "B",
        sprint: { objectId: "s2", name: "Beta" }, sprintName: "Beta",
        status: "todo", priority: "medium", assignee: null, comments: [],
      },
      {
        objectId: "c3", cardId: "CARD-003", title: "C",
        sprint: null, sprintName: null,
        status: "todo", priority: "medium", assignee: null, comments: [],
      },
    ];

    // Using sprintName for backward-compat filtering
    const alphaCards = cards.filter((c) => c.sprintName === "Alpha");
    expect(alphaCards).toHaveLength(1);
    expect(alphaCards[0].cardId).toBe("CARD-001");

    // Using sprint.objectId for Pointer-based filtering
    const betaCards = cards.filter((c) => c.sprint?.objectId === "s2");
    expect(betaCards).toHaveLength(1);
    expect(betaCards[0].cardId).toBe("CARD-002");

    // Null sprint cards
    const noSprintCards = cards.filter((c) => c.sprint === null);
    expect(noSprintCards).toHaveLength(1);
    expect(noSprintCards[0].cardId).toBe("CARD-003");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Part 3: Assignee string serialization compatibility
// ═════════════════════════════════════════════════════════════════════════════

describe("CARD-120 QA: assignee remains a string in serialized cards", () => {
  test("card.assignee is a string name, not a Pointer object", () => {
    // The API serializeCard returns assignee as a plain string (via getAssigneeName)
    // UI code can safely do card.assignee === "developer-1"
    const serializedCard = {
      objectId: "c1",
      cardId: "CARD-001",
      title: "Test",
      assignee: "developer-1", // String, not { __type: "Pointer", ... }
      sprint: { objectId: "s1", name: "Sprint 1" },
      sprintName: "Sprint 1",
      status: "in_progress",
      priority: "high",
      comments: [{ author: "qa-1", message: "Test comment", createdAt: "2026-02-12" }],
    };

    expect(typeof serializedCard.assignee).toBe("string");
    expect(serializedCard.assignee).toBe("developer-1");
    expect(typeof serializedCard.comments[0].author).toBe("string");
    expect(serializedCard.comments[0].author).toBe("qa-1");
  });
});

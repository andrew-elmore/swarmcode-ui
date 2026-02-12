/**
 * CARD-120 QA Tests — Pointer Migration: UI source verification + Redux tests
 * Author: qa-1
 * Date: 2026-02-12
 *
 * Verifies the UI-side impacts of the string-to-Pointer migration (CARD-116 + CARD-118).
 * These tests validate source code patterns, Redux slice compatibility, and
 * serialization assumptions without needing the API server running.
 *
 * Part 1: API cloud code source verification (board.js, messaging.js, etc.) — CARD-116
 * Part 2: UI source verification (api.js, App.jsx, BoardView, CardDetailDialog) — CARD-118
 * Part 3: UI boardSlice compatibility with new sprint object shape
 * Part 4: Assignee string serialization compatibility
 */

const fs = require("fs");
const path = require("path");

// ═════════════════════════════════════════════════════════════════════════════
// Part 1: API Cloud Code Source Verification
// ═════════════════════════════════════════════════════════════════════════════

const apiDir = path.resolve(__dirname, "../../swarmcode-api/cloud");

describe("CARD-120 QA: helpers.js Pointer migration", () => {
  const src = fs.readFileSync(path.join(apiDir, "helpers.js"), "utf8");

  test("findAgentByName helper exported", () => {
    expect(src).toMatch(/async function findAgentByName\(name\)/);
    expect(src).toMatch(/module\.exports[\s\S]*findAgentByName/);
  });

  test("findBoardByHash helper exported", () => {
    expect(src).toMatch(/async function findBoardByHash\(projectHash\)/);
    expect(src).toMatch(/module\.exports[\s\S]*findBoardByHash/);
  });

  test("getValidAgentNames uses board Pointer query with include('agent')", () => {
    expect(src).toMatch(/query\.equalTo\("board", board\)/);
    expect(src).toMatch(/query\.include\("agent"\)/);
  });

  test("getValidAgentNames falls back to string query for migration window", () => {
    expect(src).toMatch(/query\.equalTo\("projectHash", projectHash\)/);
  });

  test("getValidAgentNames includes SYSTEM_AGENT_NAMES", () => {
    expect(src).toMatch(/SYSTEM_AGENT_NAMES/);
    expect(src).toMatch(/\[\.\.\.SYSTEM_AGENT_NAMES/);
  });

  test("SYSTEM_AGENT_NAMES includes 'owner' and 'board-system'", () => {
    expect(src).toMatch(/SYSTEM_AGENT_NAMES\s*=\s*\["owner",\s*"board-system"\]/);
  });

  test("_sendBoardNotification resolves board-system to Agent Pointer for from", () => {
    expect(src).toMatch(/findAgentByName\("board-system"\)/);
    expect(src).toMatch(/msg\.set\("from",\s*boardSystemAgent\)/);
  });

  test("_sendBoardNotification resolves recipients to Agent Pointers for to", () => {
    expect(src).toMatch(/recipientAgents\s*=\s*await Promise\.all/);
    expect(src).toMatch(/msg\.set\("to",\s*recipientAgent\)/);
  });

  test("_sendBoardNotification reads assignee from both Pointer and string format", () => {
    expect(src).toMatch(/assigneeRaw\.get\("name"\)/);
  });
});

describe("CARD-120 QA: board.js Pointer migration", () => {
  const src = fs.readFileSync(path.join(apiDir, "board.js"), "utf8");

  test("getAssigneeName handles both Pointer and string", () => {
    expect(src).toMatch(/function getAssigneeName\(card\)/);
    expect(src).toMatch(/typeof raw === "object" && raw\.get/);
  });

  test("getSprintSerialized returns { objectId, name } for Pointer, raw string for pre-migration", () => {
    expect(src).toMatch(/function getSprintSerialized\(card\)/);
    expect(src).toMatch(/\{ objectId: raw\.id, name: raw\.get\("name"\) \}/);
  });

  test("getSprintName returns string name for backward compat", () => {
    expect(src).toMatch(/function getSprintName\(card\)/);
  });

  test("serializeCard returns both sprint (object) and sprintName (string)", () => {
    expect(src).toMatch(/sprint:\s*getSprintSerialized\(card\)/);
    expect(src).toMatch(/sprintName:\s*getSprintName\(card\)/);
  });

  test("serializeCard returns assignee as string name", () => {
    expect(src).toMatch(/assignee:\s*getAssigneeName\(card\)/);
  });

  test("getAuthorName handles both Pointer and string for Comment.author", () => {
    expect(src).toMatch(/function getAuthorName\(comment\)/);
  });

  test("createCard resolves assignee string to Agent Pointer", () => {
    expect(src).toMatch(/assigneePointer\s*=\s*await findAgentByName\(assignee\)/);
    expect(src).toMatch(/card\.set\("assignee",\s*assigneePointer/);
  });

  test("createCard resolves sprint string to Sprint Pointer", () => {
    expect(src).toMatch(/sprintPointer\s*=\s*await findSprintByName\(board,\s*sprint\)/);
    expect(src).toMatch(/card\.set\("sprint",\s*sprintPointer/);
  });

  test("updateCard resolves assignee to Pointer on change", () => {
    expect(src).toMatch(/const assigneePointer = await findAgentByName\(assignee\)/);
  });

  test("updateCard resolves sprint to Pointer on change", () => {
    expect(src).toMatch(/const sprintPointer = await findSprintByName\(board, sprint\)/);
  });

  test("addComment resolves author to Agent Pointer", () => {
    expect(src).toMatch(/authorAgent\s*=\s*await findAgentByName\(author\)/);
    expect(src).toMatch(/comment\.set\("author",\s*authorAgent/);
  });

  test("listCards includes assignee and sprint Pointers", () => {
    expect(src).toMatch(/cardQuery\.include\("assignee"\)/);
    expect(src).toMatch(/cardQuery\.include\("sprint"\)/);
  });

  test("listCards resolves sprint filter to Pointer with string fallback", () => {
    expect(src).toMatch(/sprintPointer\s*=\s*await findSprintByName\(board,\s*sprint\)/);
    expect(src).toMatch(/query\.equalTo\("sprint",\s*sprintPointer\)/);
    // Fallback for pre-migration
    expect(src).toMatch(/query\.equalTo\("sprint",\s*sprint\)/);
  });

  test("updateSprint does NOT have bulk Card.sprint update (Pointers auto-reflect)", () => {
    // The old pattern was: for each card, card.set("sprint", newName)
    // With Pointers, renaming the Sprint object auto-reflects on all Cards.
    // Verify NO bulk Card update loop in updateSprint.
    const updateSprintSection = src.match(
      /Cloud\.define\("updateSprint"[\s\S]*?(?=Cloud\.define|module\.exports|$)/
    );
    expect(updateSprintSection).toBeTruthy();
    const section = updateSprintSection[0];
    // Should NOT contain Card.set("sprint"...) in the updateSprint function
    expect(section).not.toMatch(/card\.set\("sprint"/);
    // Should have the comment explaining why
    expect(section).toMatch(/No bulk Card\.sprint update needed/);
  });

  test("deleteSprint queries cards by sprint Pointer", () => {
    expect(src).toMatch(/cardQuery\.equalTo\("sprint",\s*sprint\)/);
  });

  test("getTeam uses include('agent') on ProjectAgent query (N+1 fix)", () => {
    expect(src).toMatch(/paQuery\.include\("agent"\)/);
  });

  test("getTeam reads assignee via getAssigneeName helper", () => {
    expect(src).toMatch(/getAssigneeName\(card\)/);
  });

  test("findCard includes assignee and sprint", () => {
    expect(src).toMatch(/query\.include\("assignee"\)/);
    expect(src).toMatch(/query\.include\("sprint"\)/);
  });

  test("getOrCreateBoard includes assignee and sprint on card queries", () => {
    expect(src).toMatch(/cardQuery\.include\("assignee"\)/);
    expect(src).toMatch(/cardQuery\.include\("sprint"\)/);
  });

  test("getOrCreateBoard includes author on comment queries", () => {
    expect(src).toMatch(/commentQuery\.include\("author"\)/);
  });
});

describe("CARD-120 QA: messaging.js Pointer migration", () => {
  const src = fs.readFileSync(path.join(apiDir, "messaging.js"), "utf8");

  test("getMessageAgentName handles both Pointer and string", () => {
    expect(src).toMatch(/function getMessageAgentName\(msg,\s*field\)/);
    expect(src).toMatch(/typeof raw === "object" && raw\.get/);
  });

  test("sendMessage resolves from to Agent Pointer", () => {
    expect(src).toMatch(/fromAgent\s*=\s*await findAgentByName\(from\)/);
  });

  test("sendMessage resolves to to Agent Pointer (single recipient)", () => {
    expect(src).toMatch(/toAgent\s*=\s*await findAgentByName\(to\)/);
  });

  test("broadcast to='all' short-circuits BEFORE Pointer resolution", () => {
    // The 'to === "all"' check must appear BEFORE findAgentByName(to)
    const allCheckIndex = src.indexOf('to === "all"');
    const toResolutionIndex = src.indexOf("toAgent = await findAgentByName(to)");
    expect(allCheckIndex).toBeGreaterThan(-1);
    expect(toResolutionIndex).toBeGreaterThan(-1);
    expect(allCheckIndex).toBeLessThan(toResolutionIndex);
  });

  test("broadcast resolves each individual recipient to Pointer", () => {
    expect(src).toMatch(/recipientAgents\s*=\s*await Promise\.all/);
    expect(src).toMatch(/broadcastTargets\.map\(\(name\)\s*=>\s*findAgentByName\(name\)\)/);
  });

  test("broadcast filters out system agents from targets", () => {
    expect(src).toMatch(/SYSTEM_AGENT_NAMES\.includes\(a\)/);
  });

  test("pollMessages includes from and to Pointers", () => {
    expect(src).toMatch(/query\.include\("from"\)/);
    expect(src).toMatch(/query\.include\("to"\)/);
  });

  test("pollMessages resolves recipient to Pointer for query", () => {
    expect(src).toMatch(/recipientAgent\s*=\s*recipient\s*\?\s*await findAgentByName\(recipient\)/);
  });

  test("pollMessages uses getMessageAgentName for serialization", () => {
    expect(src).toMatch(/from:\s*getMessageAgentName\(msg,\s*"from"\)/);
    expect(src).toMatch(/to:\s*getMessageAgentName\(msg,\s*"to"\)/);
  });

  test("getConversation resolves user names to Pointers", () => {
    expect(src).toMatch(/agentA\s*=\s*await findAgentByName\(a\)/);
    expect(src).toMatch(/agentB\s*=\s*await findAgentByName\(b\)/);
  });

  test("getConversation includes from/to Pointers", () => {
    expect(src).toMatch(/query\.include\("from"\)/);
    expect(src).toMatch(/query\.include\("to"\)/);
  });

  test("getConversation falls back to string queries if Pointer resolution fails", () => {
    expect(src).toMatch(/q1\.equalTo\("from",\s*a\)/);
    expect(src).toMatch(/q1\.equalTo\("to",\s*b\)/);
  });
});

describe("CARD-120 QA: commands.js Pointer migration", () => {
  const src = fs.readFileSync(path.join(apiDir, "commands.js"), "utf8");

  test("createCommand resolves board Pointer and sets it", () => {
    expect(src).toMatch(/board\s*=\s*await findBoardByHash\(projectHash\)/);
    expect(src).toMatch(/command\.set\("board",\s*board\)/);
  });

  test("createCommand keeps projectHash string for backward compat", () => {
    expect(src).toMatch(/command\.set\("projectHash",\s*projectHash\)/);
  });

  test("listRecentCommands queries by board Pointer with string fallback", () => {
    expect(src).toMatch(/query\.equalTo\("board",\s*board\)/);
    expect(src).toMatch(/query\.equalTo\("projectHash",\s*projectHash\)/);
  });

  test("recordPing queries by board Pointer for upsert with string fallback", () => {
    expect(src).toMatch(/query\.equalTo\("board",\s*board\)/);
    // String fallback
    expect(src).toMatch(/query\.equalTo\("projectHash",\s*projectHash\)/);
  });

  test("recordPing sets board Pointer on new records", () => {
    expect(src).toMatch(/ping\.set\("board",\s*board\)/);
  });

  test("getLatestPing queries by board Pointer with string fallback", () => {
    const getLatestSection = src.match(
      /Cloud\.define\("getLatestPing"[\s\S]*?(?=Cloud\.define|module\.exports|$)/
    );
    expect(getLatestSection).toBeTruthy();
    expect(getLatestSection[0]).toMatch(/query\.equalTo\("board",\s*board\)/);
  });

  test("getRequestedCommands queries by board Pointer with string fallback", () => {
    const section = src.match(
      /Cloud\.define\("getRequestedCommands"[\s\S]*?(?=Cloud\.define|module\.exports|$)/
    );
    expect(section).toBeTruthy();
    expect(section[0]).toMatch(/query\.equalTo\("board",\s*board\)/);
  });
});

describe("CARD-120 QA: agents.js Pointer migration", () => {
  const src = fs.readFileSync(path.join(apiDir, "agents.js"), "utf8");

  test("findProjectAgent uses board + agent Pointer query", () => {
    expect(src).toMatch(/query\.equalTo\("board",\s*board\)/);
    expect(src).toMatch(/query\.equalTo\("agent",\s*agent\)/);
  });

  test("findProjectAgent falls back to string query for migration window", () => {
    expect(src).toMatch(/fallbackQuery\.equalTo\("projectHash",\s*projectHash\)/);
    expect(src).toMatch(/fallbackQuery\.equalTo\("agentName",\s*agentName\)/);
  });

  test("seedDefaultAgents sets both Pointer and string fields on ProjectAgent", () => {
    expect(src).toMatch(/pa\.set\("projectHash",\s*projectHash\)/);
    expect(src).toMatch(/pa\.set\("agentName",\s*(?:name|tpl\.name)\)/);
    expect(src).toMatch(/pa\.set\("board",\s*board\)/);
    expect(src).toMatch(/pa\.set\("agent",\s*global\)/);
  });

  test("getProjectAgentsMerged uses include('agent') to avoid N+1", () => {
    expect(src).toMatch(/paQuery\.include\("agent"\)/);
  });

  test("getProjectAgentsMerged falls back to findAgentByName for pre-migration rows", () => {
    expect(src).toMatch(/fallbackAgent\s*=\s*await findAgentByName\(agentName\)/);
  });

  test("assignAgentToProject sets both Pointer and string fields", () => {
    expect(src).toMatch(/pa\.set\("agent",\s*agent\)/);
    expect(src).toMatch(/pa\.set\("board",\s*board\)/);
    expect(src).toMatch(/pa\.set\("agentName",\s*agentName\)/);
  });

  test("deleteAgent cascades via agent Pointer query", () => {
    expect(src).toMatch(/paQuery\.equalTo\("agent",\s*agent\)/);
  });

  test("deleteAgent also catches pre-migration rows via string fallback", () => {
    expect(src).toMatch(/fallbackQuery\.equalTo\("agentName",\s*name\)/);
  });

  test("deleteAgent deduplicates Pointer and string query results", () => {
    expect(src).toMatch(/seenIds\s*=\s*new Set/);
  });
});

describe("CARD-120 QA: main.js system agents", () => {
  const src = fs.readFileSync(path.join(apiDir, "main.js"), "utf8");

  test("ensureSystemAgents creates 'owner' Agent record", () => {
    expect(src).toMatch(/name:\s*"owner"/);
    expect(src).toMatch(/description:\s*"Human project owner"/);
    expect(src).toMatch(/isActive:\s*false/);
  });

  test("ensureSystemAgents creates 'board-system' Agent record", () => {
    expect(src).toMatch(/name:\s*"board-system"/);
    expect(src).toMatch(/description:\s*"Board notification system"/);
  });

  test("ensureSystemAgents is idempotent (checks existing before creating)", () => {
    expect(src).toMatch(/const existing = await query\.first/);
    expect(src).toMatch(/if \(!existing\)/);
  });

  test("ensureSystemAgents runs on startup", () => {
    expect(src).toMatch(/ensureSystemAgents\(\)/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Part 2: CARD-118 UI Source Verification — LiveQuery Pointer resolution
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

  test("sprint Chip display uses sprintName with string/object fallback", () => {
    expect(src).toMatch(/card\.sprintName \|\| \(typeof card\.sprint === "string" \? card\.sprint : card\.sprint\?\.name\)/);
  });

  test("sprint Chip visibility check uses sprintName || sprint", () => {
    expect(src).toMatch(/card\.sprintName \|\| card\.sprint/);
  });
});

describe("CARD-120 QA: CardDetailDialog.jsx sprint backward compat (CARD-118)", () => {
  const src = fs.readFileSync(path.join(uiSrcDir, "components/CardDetailDialog.jsx"), "utf8");

  test("sprint dropdown value uses sprintName with string fallback", () => {
    expect(src).toMatch(/card\.sprintName \|\| \(typeof card\.sprint === "string" \? card\.sprint : ""\)/);
  });

  test("sprint Chip label uses sprintName with string/object fallback", () => {
    expect(src).toMatch(/card\.sprintName \|\| \(typeof card\.sprint === "string" \? card\.sprint : card\.sprint\?\.name\)/);
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

/**
 * CARD-094: Voice command parser unit tests
 * Tests phonetic alias map, normalization, message extraction, and edge cases.
 * Author: developer-1
 */

import { parseVoiceCommand, normalize, AGENT_PHONETIC_MAP } from "../src/utils/voiceCommandParser";

// ─── Normalization ──────────────────────────────────────────────────────────

describe("normalize()", () => {
  test("lowercases input", () => {
    expect(normalize("PM ONE Hello")).toBe("pm one hello");
  });

  test("replaces hyphens with spaces", () => {
    expect(normalize("senior-dev-1")).toBe("senior dev 1");
  });

  test("collapses multiple spaces", () => {
    expect(normalize("pm   one   hello")).toBe("pm one hello");
  });

  test("trims whitespace", () => {
    expect(normalize("  pm one hello  ")).toBe("pm one hello");
  });

  test("replaces 'won' with 'one' (SpeechRecognition quirk)", () => {
    expect(normalize("pm won do something")).toBe("pm one do something");
  });

  test("handles em-dashes and en-dashes", () => {
    expect(normalize("senior\u2014dev\u2013one")).toBe("senior dev one");
  });
});

// ─── PM-1 aliases ────────────────────────────────────────────────────────────

describe("parseVoiceCommand() — pm-1 aliases", () => {
  test("'pm one create a login page'", () => {
    const result = parseVoiceCommand("pm one create a login page");
    expect(result).toEqual({ agent: "pm-1", message: "create a login page" });
  });

  test("'PM 1 create a login page' (uppercase)", () => {
    const result = parseVoiceCommand("PM 1 create a login page");
    expect(result).toEqual({ agent: "pm-1", message: "create a login page" });
  });

  test("'pee emm one please create a card'", () => {
    const result = parseVoiceCommand("pee emm one please create a card");
    expect(result).toEqual({ agent: "pm-1", message: "create a card" });
  });

  test("'pee em one do something'", () => {
    const result = parseVoiceCommand("pee em one do something");
    expect(result).toEqual({ agent: "pm-1", message: "do something" });
  });

  test("'p.m. one assign the task'", () => {
    const result = parseVoiceCommand("p.m. one assign the task");
    expect(result).toEqual({ agent: "pm-1", message: "assign the task" });
  });

  test("'p.m. 1 update the board'", () => {
    const result = parseVoiceCommand("p.m. 1 update the board");
    expect(result).toEqual({ agent: "pm-1", message: "update the board" });
  });

  test("'project manager schedule a meeting'", () => {
    const result = parseVoiceCommand("project manager schedule a meeting");
    expect(result).toEqual({ agent: "pm-1", message: "schedule a meeting" });
  });
});

// ─── senior-dev-1 aliases ────────────────────────────────────────────────────

describe("parseVoiceCommand() — senior-dev-1 aliases", () => {
  test("'senior dev one review my PR'", () => {
    const result = parseVoiceCommand("senior dev one review my PR");
    expect(result).toEqual({ agent: "senior-dev-1", message: "review my pr" });
  });

  test("'senior dev 1 help with architecture'", () => {
    const result = parseVoiceCommand("senior dev 1 help with architecture");
    expect(result).toEqual({ agent: "senior-dev-1", message: "help with architecture" });
  });

  test("'senior developer one check this code'", () => {
    const result = parseVoiceCommand("senior developer one check this code");
    expect(result).toEqual({ agent: "senior-dev-1", message: "check this code" });
  });

  test("'senior developer 1 fix the bug'", () => {
    const result = parseVoiceCommand("senior developer 1 fix the bug");
    expect(result).toEqual({ agent: "senior-dev-1", message: "fix the bug" });
  });

  test("'senior please help' (short alias)", () => {
    const result = parseVoiceCommand("senior please help");
    expect(result).toEqual({ agent: "senior-dev-1", message: "help" });
  });
});

// ─── developer-1 aliases ────────────────────────────────────────────────────

describe("parseVoiceCommand() — developer-1 aliases", () => {
  test("'developer one implement the feature'", () => {
    const result = parseVoiceCommand("developer one implement the feature");
    expect(result).toEqual({ agent: "developer-1", message: "implement the feature" });
  });

  test("'developer 1 fix the tests'", () => {
    const result = parseVoiceCommand("developer 1 fix the tests");
    expect(result).toEqual({ agent: "developer-1", message: "fix the tests" });
  });

  test("'dev one write some code'", () => {
    const result = parseVoiceCommand("dev one write some code");
    expect(result).toEqual({ agent: "developer-1", message: "write some code" });
  });

  test("'dev 1 please add a button'", () => {
    const result = parseVoiceCommand("dev 1 please add a button");
    expect(result).toEqual({ agent: "developer-1", message: "add a button" });
  });
});

// ─── devops-1 aliases ────────────────────────────────────────────────────────

describe("parseVoiceCommand() — devops-1 aliases", () => {
  test("'devops one deploy to production'", () => {
    const result = parseVoiceCommand("devops one deploy to production");
    expect(result).toEqual({ agent: "devops-1", message: "deploy to production" });
  });

  test("'devops 1 check the CI pipeline'", () => {
    const result = parseVoiceCommand("devops 1 check the CI pipeline");
    expect(result).toEqual({ agent: "devops-1", message: "check the ci pipeline" });
  });

  test("'dev ops one restart the server'", () => {
    const result = parseVoiceCommand("dev ops one restart the server");
    expect(result).toEqual({ agent: "devops-1", message: "restart the server" });
  });

  test("'dev ops 1 update the config'", () => {
    const result = parseVoiceCommand("dev ops 1 update the config");
    expect(result).toEqual({ agent: "devops-1", message: "update the config" });
  });
});

// ─── qa-1 aliases ────────────────────────────────────────────────────────────

describe("parseVoiceCommand() — qa-1 aliases", () => {
  test("'qa one run the tests'", () => {
    const result = parseVoiceCommand("qa one run the tests");
    expect(result).toEqual({ agent: "qa-1", message: "run the tests" });
  });

  test("'qa 1 check for regressions'", () => {
    const result = parseVoiceCommand("qa 1 check for regressions");
    expect(result).toEqual({ agent: "qa-1", message: "check for regressions" });
  });

  test("'q a one test the login flow'", () => {
    const result = parseVoiceCommand("q a one test the login flow");
    expect(result).toEqual({ agent: "qa-1", message: "test the login flow" });
  });

  test("'q.a. one verify the fix'", () => {
    const result = parseVoiceCommand("q.a. one verify the fix");
    expect(result).toEqual({ agent: "qa-1", message: "verify the fix" });
  });

  test("'quality assurance check the build'", () => {
    const result = parseVoiceCommand("quality assurance check the build");
    expect(result).toEqual({ agent: "qa-1", message: "check the build" });
  });

  test("'cue ay one write tests'", () => {
    const result = parseVoiceCommand("cue ay one write tests");
    expect(result).toEqual({ agent: "qa-1", message: "write tests" });
  });
});

// ─── Broadcast (team/all) ────────────────────────────────────────────────────

describe("parseVoiceCommand() — broadcast aliases", () => {
  test("'team please do xyz'", () => {
    const result = parseVoiceCommand("team please do xyz");
    expect(result).toEqual({ agent: "all", message: "do xyz" });
  });

  test("'everyone status update'", () => {
    const result = parseVoiceCommand("everyone status update");
    expect(result).toEqual({ agent: "all", message: "status update" });
  });

  test("'all agents report progress'", () => {
    const result = parseVoiceCommand("all agents report progress");
    expect(result).toEqual({ agent: "all", message: "report progress" });
  });

  test("'all check in'", () => {
    const result = parseVoiceCommand("all check in");
    expect(result).toEqual({ agent: "all", message: "check in" });
  });
});

// ─── Filler word stripping ───────────────────────────────────────────────────

describe("parseVoiceCommand() — filler word stripping", () => {
  test("strips 'please' after agent name", () => {
    const result = parseVoiceCommand("pm one please create a card");
    expect(result.message).toBe("create a card");
  });

  test("strips leading comma after agent name", () => {
    const result = parseVoiceCommand("pm one, create a card");
    expect(result.message).toBe("create a card");
  });

  test("strips 'comma' word after agent name", () => {
    const result = parseVoiceCommand("pm one comma create a card");
    expect(result.message).toBe("create a card");
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("parseVoiceCommand() — edge cases", () => {
  test("returns null for empty string", () => {
    expect(parseVoiceCommand("")).toBeNull();
  });

  test("returns null for whitespace-only string", () => {
    expect(parseVoiceCommand("   ")).toBeNull();
  });

  test("returns null when no agent matches", () => {
    expect(parseVoiceCommand("hello world")).toBeNull();
  });

  test("returns empty message when only agent name is spoken", () => {
    const result = parseVoiceCommand("pm one");
    expect(result).toEqual({ agent: "pm-1", message: "" });
  });

  test("'won' is normalized to 'one' (SpeechRecognition quirk)", () => {
    const result = parseVoiceCommand("pm won create a card");
    expect(result).toEqual({ agent: "pm-1", message: "create a card" });
  });

  test("handles hyphenated agent name in transcript", () => {
    const result = parseVoiceCommand("senior-dev-1 review the code");
    expect(result).toEqual({ agent: "senior-dev-1", message: "review the code" });
  });

  test("'dev ops one' matches devops-1 (not developer-1)", () => {
    const result = parseVoiceCommand("dev ops one deploy now");
    expect(result).toEqual({ agent: "devops-1", message: "deploy now" });
  });

  test("only first agent match (prefix) is used", () => {
    const result = parseVoiceCommand("pm one tell developer one to fix the bug");
    expect(result.agent).toBe("pm-1");
    expect(result.message).toBe("tell developer one to fix the bug");
  });
});

// ─── Alias map ordering ─────────────────────────────────────────────────────

describe("AGENT_PHONETIC_MAP ordering", () => {
  test("devops entries come before developer entries", () => {
    const devOpsIdx = AGENT_PHONETIC_MAP.findIndex((e) => e.pattern === "dev ops one");
    const devOneIdx = AGENT_PHONETIC_MAP.findIndex((e) => e.pattern === "dev one");
    expect(devOpsIdx).toBeLessThan(devOneIdx);
  });

  test("longer patterns come before shorter within same agent group", () => {
    const seniorDevOne = AGENT_PHONETIC_MAP.findIndex((e) => e.pattern === "senior developer one");
    const senior = AGENT_PHONETIC_MAP.findIndex((e) => e.pattern === "senior");
    expect(seniorDevOne).toBeLessThan(senior);
  });
});

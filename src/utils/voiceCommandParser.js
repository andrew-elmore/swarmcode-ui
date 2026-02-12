// voiceCommandParser.js — Parse voice transcripts into { agent, message }

/**
 * Phonetic alias map: spoken names -> canonical agent IDs.
 * Sorted longest-first within each group to avoid false prefix matches
 * (e.g. "dev ops one" must match before "dev one").
 */
const AGENT_PHONETIC_MAP = [
  // senior-dev-1 (longest first)
  { pattern: "senior developer one", agent: "senior-dev-1" },
  { pattern: "senior developer 1", agent: "senior-dev-1" },
  { pattern: "senior dev one", agent: "senior-dev-1" },
  { pattern: "senior dev 1", agent: "senior-dev-1" },
  { pattern: "senior", agent: "senior-dev-1" },

  // devops-1 (must come before developer-1 to avoid "dev" prefix collision)
  { pattern: "dev ops one", agent: "devops-1" },
  { pattern: "dev ops 1", agent: "devops-1" },
  { pattern: "devops one", agent: "devops-1" },
  { pattern: "devops 1", agent: "devops-1" },

  // developer-1
  { pattern: "developer one", agent: "developer-1" },
  { pattern: "developer 1", agent: "developer-1" },
  { pattern: "dev one", agent: "developer-1" },
  { pattern: "dev 1", agent: "developer-1" },

  // pm-1
  { pattern: "project manager", agent: "pm-1" },
  { pattern: "pee emm one", agent: "pm-1" },
  { pattern: "pee em one", agent: "pm-1" },
  { pattern: "p.m. one", agent: "pm-1" },
  { pattern: "p.m. 1", agent: "pm-1" },
  { pattern: "pm one", agent: "pm-1" },
  { pattern: "pm 1", agent: "pm-1" },

  // qa-1
  { pattern: "quality assurance", agent: "qa-1" },
  { pattern: "cue ay one", agent: "qa-1" },
  { pattern: "q.a. one", agent: "qa-1" },
  { pattern: "q.a. 1", agent: "qa-1" },
  { pattern: "q a one", agent: "qa-1" },
  { pattern: "qa one", agent: "qa-1" },
  { pattern: "qa 1", agent: "qa-1" },

  // broadcast
  { pattern: "all agents", agent: "all" },
  { pattern: "everyone", agent: "all" },
  { pattern: "team", agent: "all" },
  { pattern: "all", agent: "all" },
];

/**
 * Normalize a transcript for matching:
 * - lowercase
 * - replace hyphens/dashes with spaces
 * - collapse multiple spaces
 * - trim
 * - fix common SpeechRecognition quirk: "won" -> "one"
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bwon\b/g, "one");
}

/**
 * Strip common filler words/punctuation between agent name and message content.
 * e.g. "please create a login page" -> "create a login page"
 */
function stripLeadingFillers(text) {
  return text.replace(/^(please|comma|[,.])\s*/i, "").trim();
}

/**
 * Parse a voice transcript into { agent, message }.
 * Returns null if no agent could be identified.
 * Returns { agent, message: "" } if agent matched but no message content.
 */
export function parseVoiceCommand(transcript) {
  const normalized = normalize(transcript);
  if (!normalized) return null;

  for (const { pattern, agent } of AGENT_PHONETIC_MAP) {
    if (normalized.startsWith(pattern)) {
      const rawMessage = normalized.substring(pattern.length).trim();
      const message = stripLeadingFillers(rawMessage);
      return { agent, message };
    }
  }

  return null;
}

export { normalize, AGENT_PHONETIC_MAP };

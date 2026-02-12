// api.js — Parse Cloud Function client service layer + LiveQuery

import Parse from "parse";

const PARSE_URL = process.env.REACT_APP_PARSE_URL || "/parse";
const APP_ID = process.env.REACT_APP_PARSE_APP_ID || "swarmcode";
const JS_KEY = process.env.REACT_APP_PARSE_REST_API_KEY || "";
const PROJECT_TOKEN = process.env.REACT_APP_PROJECT_TOKEN || "";

// Initialize Parse SDK (needed for LiveQuery)
Parse.initialize(APP_ID, JS_KEY);
Parse.serverURL = PARSE_URL;
const LIVEQUERY_URL = process.env.REACT_APP_PARSE_LIVEQUERY_URL;
if (LIVEQUERY_URL) {
  Parse.liveQueryServerURL = LIVEQUERY_URL;
}

// --- Low-level REST call ---

const HEADERS = {
  "X-Parse-Application-Id": APP_ID,
  "X-Parse-REST-API-Key": JS_KEY,
  "Content-Type": "application/json",
  ...(PROJECT_TOKEN ? { "X-Project-Token": PROJECT_TOKEN } : {}),
};

async function callFunction(name, params = {}) {
  const res = await fetch(`${PARSE_URL}/functions/${name}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch { /* non-JSON response */ }
    throw new Error(msg);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.result;
}

// --- Messaging ---

export async function sendMessage({ projectHash, from, to, message }) {
  return callFunction("sendMessage", { projectHash, from, to, message });
}

export async function pollMessages(since) {
  const params = since ? { since } : {};
  return callFunction("pollMessages", params);
}

export async function getConversation(projectHash, userA, userB, { limit, before } = {}) {
  const params = { projectHash, userA, userB };
  if (limit) params.limit = limit;
  if (before) params.before = before;
  return callFunction("getConversation", params);
}

// --- LiveQuery ---

let _messageSubscription = null;

/**
 * Subscribe to new Message objects via LiveQuery.
 * Calls onMessage(msg) for each new message created.
 * Returns an unsubscribe function.
 */
export async function subscribeToMessages(onMessage) {
  // Unsubscribe previous if any
  if (_messageSubscription) {
    _messageSubscription.unsubscribe();
    _messageSubscription = null;
  }

  const query = new Parse.Query("Message");
  const subscription = await query.subscribe();
  _messageSubscription = subscription;

  subscription.on("create", (object) => {
    const msg = {
      id: object.id,
      from: object.get("from"),
      to: object.get("to"),
      subject: object.get("subject"),
      message: object.get("message"),
      createdAt: object.get("createdAt"),
      broadcast: object.get("broadcast") || false,
      broadcastId: object.get("broadcastId") || null,
    };
    onMessage(msg);
  });

  return () => {
    subscription.unsubscribe();
    _messageSubscription = null;
  };
}

// --- Board ---

export async function getOrCreateBoard(projectPath) {
  return callFunction("getOrCreateBoard", { projectPath });
}

export async function createCard({ projectHash, title, description, status, assignee, priority, sprint, author }) {
  const params = { projectHash, title, description, status, assignee, priority, author };
  if (sprint !== undefined) params.sprint = sprint;
  return callFunction("createCard", params);
}

export async function updateCard({ projectHash, cardId, status, assignee, priority, title, description, sprint, author }) {
  const params = { projectHash, cardId, author };
  if (status !== undefined) params.status = status;
  if (assignee !== undefined) params.assignee = assignee;
  if (priority !== undefined) params.priority = priority;
  if (title !== undefined) params.title = title;
  if (description !== undefined) params.description = description;
  if (sprint !== undefined) params.sprint = sprint;
  return callFunction("updateCard", params);
}

export async function addComment({ projectHash, cardId, message, author }) {
  return callFunction("addComment", { projectHash, cardId, message, author });
}

export async function listCards(projectHash, status, sprint) {
  const params = { projectHash };
  if (status) params.status = status;
  if (sprint) params.sprint = sprint;
  return callFunction("listCards", params);
}

export async function showCard(projectHash, cardId) {
  return callFunction("showCard", { projectHash, cardId });
}

export async function pollBoard(projectHash, since) {
  const params = { projectHash };
  if (since) params.since = since;
  return callFunction("pollBoard", params);
}

// --- Projects ---

export async function addRecentProject(path, name) {
  return callFunction("addRecentProject", { path, name });
}

export async function getRecentProjects() {
  return callFunction("getRecentProjects", {});
}

export async function deleteProject(path) {
  return callFunction("deleteProject", { path });
}

// --- Agents ---

// Fetch agents assigned to a specific project (via ProjectAgent join table)
export async function getAgents(projectHash) {
  return callFunction("getAgents", { projectHash });
}

// Fetch ALL global agents regardless of project
export async function getAllAgents() {
  return callFunction("getAllAgents", {});
}

// Create a global agent (no projectHash needed)
export async function createAgent({ name, description, openingInstructions, permanentMemory, permissions, isActive, sortOrder }) {
  return callFunction("createAgent", {
    name,
    description,
    openingInstructions,
    permanentMemory,
    permissions,
    isActive,
    sortOrder,
  });
}

// Update a global agent (no projectHash needed)
export async function updateAgent({ name, ...updates }) {
  const params = { name };
  for (const key of ["description", "openingInstructions", "permanentMemory", "permissions", "isActive", "sortOrder", "voice"]) {
    if (updates[key] !== undefined) params[key] = updates[key];
  }
  return callFunction("updateAgent", params);
}

// Delete a global agent (cascades ProjectAgent join rows)
export async function deleteAgent(name) {
  return callFunction("deleteAgent", { name });
}

// Assign a global agent to a project
export async function assignAgentToProject({ projectHash, agentName }) {
  return callFunction("assignAgentToProject", { projectHash, agentName });
}

// Unassign an agent from a project
export async function unassignAgentFromProject({ projectHash, agentName }) {
  return callFunction("unassignAgentFromProject", { projectHash, agentName });
}

// Update per-project agent overrides (isActive, sortOrder)
export async function updateProjectAgent({ projectHash, agentName, isActive, sortOrder }) {
  const params = { projectHash, agentName };
  if (isActive !== undefined) params.isActive = isActive;
  if (sortOrder !== undefined) params.sortOrder = sortOrder;
  return callFunction("updateProjectAgent", params);
}

// --- Sprints ---

export async function createSprint({ projectHash, name, order }) {
  return callFunction("createSprint", { projectHash, name, order });
}

export async function getSprints(projectHash) {
  return callFunction("getSprints", { projectHash });
}

export async function updateSprint({ projectHash, sprintId, name, order }) {
  const params = { projectHash, sprintId };
  if (name !== undefined) params.name = name;
  if (order !== undefined) params.order = order;
  return callFunction("updateSprint", params);
}

export async function deleteSprint(projectHash, sprintId) {
  return callFunction("deleteSprint", { projectHash, sprintId });
}

// --- Commands (CARD-102) ---

export async function createCommand(projectHash, action) {
  return callFunction("createCommand", { projectHash, action });
}

export async function listRecentCommands(projectHash) {
  return callFunction("listRecentCommands", { projectHash });
}

export async function updateCommandStatus(commandId, status, error) {
  const params = { commandId, status };
  if (error) params.error = error;
  return callFunction("updateCommandStatus", params);
}

// --- Ping (CARD-102) ---

export async function recordPing(projectHash, agentStatus) {
  return callFunction("recordPing", { projectHash, agentStatus });
}

export async function getLatestPing(projectHash) {
  return callFunction("getLatestPing", { projectHash });
}

export async function getRequestedCommands(projectHash) {
  return callFunction("getRequestedCommands", { projectHash });
}

// --- Command LiveQuery ---

let _commandSubscription = null;

export async function subscribeToCommands(projectHash, onCommand) {
  if (_commandSubscription) {
    _commandSubscription.unsubscribe();
    _commandSubscription = null;
  }

  const query = new Parse.Query("Command");
  query.equalTo("projectHash", projectHash);
  const subscription = await query.subscribe();
  _commandSubscription = subscription;

  subscription.on("create", (object) => {
    onCommand({
      type: "create",
      command: {
        objectId: object.id,
        action: object.get("action"),
        status: object.get("status"),
        error: object.get("error") || null,
        createdAt: object.get("createdAt"),
        fulfilledAt: object.get("fulfilledAt") || null,
      },
    });
  });

  subscription.on("update", (object) => {
    onCommand({
      type: "update",
      command: {
        objectId: object.id,
        action: object.get("action"),
        status: object.get("status"),
        error: object.get("error") || null,
        createdAt: object.get("createdAt"),
        fulfilledAt: object.get("fulfilledAt") || null,
      },
    });
  });

  return () => {
    subscription.unsubscribe();
    _commandSubscription = null;
  };
}

// --- Ping LiveQuery ---

let _pingSubscription = null;

export async function subscribeToPings(projectHash, onPing) {
  if (_pingSubscription) {
    _pingSubscription.unsubscribe();
    _pingSubscription = null;
  }

  const query = new Parse.Query("Ping");
  query.equalTo("projectHash", projectHash);
  const subscription = await query.subscribe();
  _pingSubscription = subscription;

  const handler = (object) => {
    onPing({
      objectId: object.id,
      projectHash: object.get("projectHash"),
      agentStatus: object.get("agentStatus"),
      updatedAt: object.get("updatedAt"),
    });
  };

  subscription.on("create", handler);
  subscription.on("update", handler);

  return () => {
    subscription.unsubscribe();
    _pingSubscription = null;
  };
}

// --- TTS ---
// CARD-090: Server-side TTS commented out — using browser speechSynthesis

// const BASE_URL = PARSE_URL.replace("/parse", "");

// export async function getVoices() {
//   const res = await fetch(`${BASE_URL}/tts/voices`, {
//     headers: PROJECT_TOKEN ? { "X-Project-Token": PROJECT_TOKEN } : {},
//   });
//   if (!res.ok) throw new Error("Failed to fetch voices");
//   return res.json();
// }

// export async function synthesizeSpeech({ text, voice, speed }) {
//   const res = await fetch(`${BASE_URL}/tts/synthesize`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       ...(PROJECT_TOKEN ? { "X-Project-Token": PROJECT_TOKEN } : {}),
//     },
//     body: JSON.stringify({ text, voice, speed }),
//   });
//   if (!res.ok) throw new Error("TTS synthesis failed");
//   return res.arrayBuffer();
// }

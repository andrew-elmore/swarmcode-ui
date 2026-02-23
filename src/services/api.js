// api.js — Parse Cloud Function client service layer + LiveQuery

import Parse from "parse";

const APP_ID = process.env.REACT_APP_PARSE_APP_ID || "swarmcode";
const JS_KEY = process.env.REACT_APP_PARSE_REST_API_KEY || "";
const PARSE_URL = process.env.REACT_APP_PARSE_URL || "/parse";

Parse.initialize(APP_ID, JS_KEY);
Parse.serverURL = PARSE_URL;
const LIVEQUERY_URL = process.env.REACT_APP_PARSE_LIVEQUERY_URL;
if (LIVEQUERY_URL) {
  Parse.liveQueryServerURL = LIVEQUERY_URL;
}

async function callFunction(name, params = {}) {
  return Parse.Cloud.run(name, params);
}


export async function sendMessage({ boardId, from, to, message }) {
  return callFunction("sendMessage", { boardId, from, to, message });
}


export async function getConversation(boardId, userA, userB, { limit, before } = {}) {
  const params = { boardId, user1: userA, user2: userB };
  if (limit) params.limit = limit;
  if (before) params.before = before;
  return callFunction("getConversation", params);
}


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
    // Extract name if included, or objectId for lookup via agentIdMap in Redux.
    const rawFrom = object.get("from");
    const rawTo = object.get("to");
    const resolveAgent = (raw) => {
      if (!raw) return null;
      if (typeof raw === "string") return raw; // Pre-migration: plain string
      if (raw.get && raw.get("name")) return raw.get("name"); // Included Pointer
      return raw.id || null; // Pointer stub: return objectId for caller to resolve
    };
    const msg = {
      id: object.id,
      from: resolveAgent(rawFrom),
      to: resolveAgent(rawTo),
      fromId: rawFrom?.id || null,  // Always provide objectId for agentIdMap lookup
      toId: rawTo?.id || null,
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


export async function getOrCreateBoard(projectPath) {
  return callFunction("getOrCreateBoard", { projectPath });
}

export async function createCard({ boardId, title, description, status, assignee, priority, sprint, author }) {
  const params = { boardId, title, description, status, assignee, priority, author };
  if (sprint !== undefined) params.sprint = sprint;
  return callFunction("createCard", params);
}

export async function updateCard({ boardId, cardId, status, assignee, priority, title, description, sprint, author }) {
  const params = { boardId, cardId, author };
  if (status !== undefined) params.status = status;
  if (assignee !== undefined) params.assignee = assignee;
  if (priority !== undefined) params.priority = priority;
  if (title !== undefined) params.title = title;
  if (description !== undefined) params.description = description;
  if (sprint !== undefined) params.sprint = sprint;
  return callFunction("updateCard", params);
}

export async function addComment({ boardId, cardId, message, author }) {
  return callFunction("addComment", { boardId, cardId, message, author });
}

export async function listCards(boardId, status, sprint) {
  const params = { boardId };
  if (status) params.status = status;
  if (sprint) params.sprint = sprint;
  return callFunction("listCards", params);
}

export async function showCard(boardId, cardId) {
  return callFunction("showCard", { boardId, cardId });
}


export async function addRecentProject(path, name) {
  return callFunction("addRecentProject", { path, name });
}

export async function getRecentProjects() {
  return callFunction("getRecentProjects", {});
}

export async function deleteProject(path) {
  return callFunction("deleteProject", { path });
}


// Fetch agents assigned to a specific project (via ProjectAgent join table)
export async function getAgents(boardId) {
  return callFunction("getAgents", { boardId });
}

// Fetch ALL global agents regardless of project
export async function getAllAgents() {
  return callFunction("getAllAgents", {});
}

// Create a global agent (no boardId needed)
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

// Update a global agent (no boardId needed)
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
export async function assignAgentToProject({ boardId, agentName }) {
  return callFunction("assignAgentToProject", { boardId, agentName });
}

// Unassign an agent from a project
export async function unassignAgentFromProject({ boardId, agentName }) {
  return callFunction("unassignAgentFromProject", { boardId, agentName });
}

// Update per-project agent overrides (isActive, sortOrder)
export async function updateProjectAgent({ boardId, agentName, isActive, sortOrder }) {
  const params = { boardId, agentName };
  if (isActive !== undefined) params.isActive = isActive;
  if (sortOrder !== undefined) params.sortOrder = sortOrder;
  return callFunction("updateProjectAgent", params);
}


export async function createSprint({ boardId, name, order }) {
  return callFunction("createSprint", { boardId, name, order });
}

export async function getSprints(boardId) {
  return callFunction("getSprints", { boardId });
}

export async function updateSprint({ boardId, sprintId, name, order }) {
  const params = { boardId, sprintId };
  if (name !== undefined) params.name = name;
  if (order !== undefined) params.order = order;
  return callFunction("updateSprint", params);
}

export async function deleteSprint(boardId, sprintId) {
  return callFunction("deleteSprint", { boardId, sprintId });
}


export async function createArticle({ boardId, title, text, keywords }) {
  return callFunction("createArticle", { boardId, title, text, keywords });
}

export async function getArticle(boardId, title) {
  return callFunction("getArticle", { boardId, title });
}

export async function updateArticle({ boardId, title, text, keywords, newTitle }) {
  const params = { boardId, title };
  if (text !== undefined) params.text = text;
  if (keywords !== undefined) params.keywords = keywords;
  if (newTitle !== undefined) params.newTitle = newTitle;
  return callFunction("updateArticle", params);
}

export async function deleteArticle(boardId, title) {
  return callFunction("deleteArticle", { boardId, title });
}

export async function listArticles(boardId) {
  return callFunction("listArticles", { boardId });
}

export async function searchArticles(boardId, { query, keywords } = {}) {
  const params = { boardId };
  if (query) params.query = query;
  if (keywords) params.keywords = keywords;
  return callFunction("searchArticles", params);
}

export async function linkArticleToProject({ boardId, articleTitle }) {
  return callFunction("linkArticleToProject", { boardId, articleTitle });
}

export async function unlinkArticleFromProject({ boardId, articleTitle }) {
  return callFunction("unlinkArticleFromProject", { boardId, articleTitle });
}

export async function getProjectArticles(boardId) {
  return callFunction("getProjectArticles", { boardId });
}


export async function createCommand(boardId, action) {
  return callFunction("createCommand", { boardId, action });
}

export async function listRecentCommands(boardId) {
  return callFunction("listRecentCommands", { boardId });
}


export async function getLatestPing(boardId) {
  return callFunction("getLatestPing", { boardId });
}


let _commandSubscription = null;

export async function subscribeToCommands(boardId, onCommand) {
  if (_commandSubscription) {
    _commandSubscription.unsubscribe();
    _commandSubscription = null;
  }

  const query = new Parse.Query("Command");
  const Board = Parse.Object.extend("Board");
  query.equalTo("board", Board.createWithoutData(boardId));
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


let _pingSubscription = null;

/**
 * Check the actual LiveQuery WebSocket client state via Parse internals.
 * Returns the client state string: 'connected', 'disconnected', 'closed', etc.
 * Returns 'disconnected' if no client exists.
 */
export async function getLiveQueryStatus() {
  try {
    const client = await Parse.CoreManager.getLiveQueryController().getDefaultLiveQueryClient();
    return client.state || "disconnected";
  } catch {
    return "disconnected";
  }
}


export async function subscribeToPings(boardId, onPing) {
  if (_pingSubscription) {
    _pingSubscription.unsubscribe();
    _pingSubscription = null;
  }

  const query = new Parse.Query("Ping");
  const Board = Parse.Object.extend("Board");
  query.equalTo("board", Board.createWithoutData(boardId));
  const subscription = await query.subscribe();
  _pingSubscription = subscription;

  const handler = (object) => {
    onPing({
      objectId: object.id,
      boardId: object.get("board")?.id,
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

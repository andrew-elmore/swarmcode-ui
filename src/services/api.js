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
} else {
  Parse.liveQueryServerURL = PARSE_URL.startsWith('http')
    ? PARSE_URL.replace(/^http/, 'ws')
    : 'ws://localhost:1337/parse';
}

async function callFunction(name, params = {}) {
  return Parse.Cloud.run(name, params);
}


export async function sendMessage({ projectId, from, to, message }) {
  return callFunction("sendMessage", { projectId, from, to, message });
}


export async function getRecentMessages(projectId, limit = 20) {
  return callFunction("getRecentMessages", { projectId, limit });
}


export async function getConversation(projectId, userA, userB, { limit, before } = {}) {
  const params = { projectId, user1: userA, user2: userB };
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
export async function subscribeToMessages(projectId, onMessage) {
  if (!projectId) return () => {};

  // Unsubscribe previous if any
  if (_messageSubscription) {
    _messageSubscription.unsubscribe();
    _messageSubscription = null;
  }

  const Project = Parse.Object.extend("Project");
  const query = new Parse.Query("Message");
  query.equalTo("project", Project.createWithoutData(projectId));
  query.include('from');
  query.include('to');
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


export async function getOrCreateProject(projectPath) {
  return callFunction("getOrCreateProject", { projectPath });
}

export async function createCard({ projectId, title, description, status, assignee, priority, sprint, author }) {
  const params = { projectId, title, description, status, assignee, priority, author };
  if (sprint !== undefined) params.sprint = sprint;
  return callFunction("createCard", params);
}

export async function updateCard({ projectId, cardId, status, assignee, priority, title, description, sprint, author }) {
  const params = { projectId, cardId, author };
  if (status !== undefined) params.status = status;
  if (assignee !== undefined) params.assignee = assignee;
  if (priority !== undefined) params.priority = priority;
  if (title !== undefined) params.title = title;
  if (description !== undefined) params.description = description;
  if (sprint !== undefined) params.sprint = sprint;
  return callFunction("updateCard", params);
}

export async function addComment({ projectId, cardId, message, author }) {
  return callFunction("addComment", { projectId, cardId, message, author });
}

export async function listCards(projectId, status, sprint) {
  const params = { projectId };
  if (status) params.status = status;
  if (sprint) params.sprint = sprint;
  return callFunction("listCards", params);
}

export async function showCard(projectId, cardId) {
  return callFunction("showCard", { projectId, cardId });
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
export async function getAgents(projectId) {
  return callFunction("getAgents", { projectId });
}

// Fetch ALL global agents regardless of project
export async function getAllAgents() {
  return callFunction("getAllAgents", {});
}

// Create a global agent (no projectId needed)
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

// Update a global agent (no projectId needed)
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
export async function assignAgentToProject({ projectId, agentName }) {
  return callFunction("assignAgentToProject", { projectId, agentName });
}

// Unassign an agent from a project
export async function unassignAgentFromProject({ projectId, agentName }) {
  return callFunction("unassignAgentFromProject", { projectId, agentName });
}

// Update per-project agent overrides (isActive, sortOrder)
export async function updateProjectAgent({ projectId, agentName, isActive, sortOrder }) {
  const params = { projectId, agentName };
  if (isActive !== undefined) params.isActive = isActive;
  if (sortOrder !== undefined) params.sortOrder = sortOrder;
  return callFunction("updateProjectAgent", params);
}


export async function createStatus({ projectId, name, description, instructions, agentName, order, monitor }) {
  return callFunction("createStatus", { projectId, name, description, instructions, agentName, order, monitor });
}

export async function updateStatus({ projectId, statusId, name, description, instructions, agentName, order, monitor }) {
  const params = { projectId, statusId };
  if (name !== undefined) params.name = name;
  if (description !== undefined) params.description = description;
  if (instructions !== undefined) params.instructions = instructions;
  if (agentName !== undefined) params.agentName = agentName;
  if (order !== undefined) params.order = order;
  if (monitor !== undefined) params.monitor = monitor;
  return callFunction("updateStatus", params);
}

export async function deleteStatus(projectId, statusId) {
  return callFunction("deleteStatus", { projectId, statusId });
}


export async function createSprint({ projectId, name, order }) {
  return callFunction("createSprint", { projectId, name, order });
}

export async function getSprints(projectId) {
  return callFunction("getSprints", { projectId });
}

export async function updateSprint({ projectId, sprintId, name, order }) {
  const params = { projectId, sprintId };
  if (name !== undefined) params.name = name;
  if (order !== undefined) params.order = order;
  return callFunction("updateSprint", params);
}

export async function deleteSprint(projectId, sprintId) {
  return callFunction("deleteSprint", { projectId, sprintId });
}


export async function createArticle({ title, text, keywords }) {
  return callFunction("createArticle", { title, text, keywords });
}

export async function getArticle(title) {
  return callFunction("getArticle", { title });
}

export async function updateArticle({ title, text, keywords, newTitle }) {
  const params = { title };
  if (text !== undefined) params.text = text;
  if (keywords !== undefined) params.keywords = keywords;
  if (newTitle !== undefined) params.newTitle = newTitle;
  return callFunction("updateArticle", params);
}

export async function deleteArticle(title) {
  return callFunction("deleteArticle", { title });
}

export async function listArticles() {
  return callFunction("listArticles", {});
}

export async function searchArticles({ query, keywords } = {}) {
  const params = {};
  if (query) params.query = query;
  if (keywords) params.keywords = keywords;
  return callFunction("searchArticles", params);
}

export async function linkArticleToProject({ projectId, articleTitle }) {
  return callFunction("linkArticleToProject", { projectId, articleTitle });
}

export async function unlinkArticleFromProject({ projectId, articleTitle }) {
  return callFunction("unlinkArticleFromProject", { projectId, articleTitle });
}

export async function getProjectArticles(projectId) {
  return callFunction("getProjectArticles", { projectId });
}


export async function createCommand(projectId, action) {
  return callFunction("createCommand", { projectId, action });
}

export async function listRecentCommands(projectId) {
  return callFunction("listRecentCommands", { projectId });
}


export async function getLatestPing(projectId) {
  return callFunction("getLatestPing", { projectId });
}


let _commandSubscription = null;

export async function subscribeToCommands(projectId, onCommand) {
  if (_commandSubscription) {
    _commandSubscription.unsubscribe();
    _commandSubscription = null;
  }

  const query = new Parse.Query("Command");
  const Project = Parse.Object.extend("Project");
  query.equalTo("project", Project.createWithoutData(projectId));
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


export async function subscribeToPings(projectId, onPing) {
  if (_pingSubscription) {
    _pingSubscription.unsubscribe();
    _pingSubscription = null;
  }

  const query = new Parse.Query("Ping");
  const Project = Parse.Object.extend("Project");
  query.equalTo("project", Project.createWithoutData(projectId));
  const subscription = await query.subscribe();
  _pingSubscription = subscription;

  const handler = (object) => {
    onPing({
      objectId: object.id,
      projectId: object.get("project")?.id,
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

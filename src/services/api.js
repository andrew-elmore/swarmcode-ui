// api.js — Parse Cloud Function client service layer + LiveQuery

import Parse from "parse";

const PARSE_URL = process.env.REACT_APP_PARSE_URL || "http://localhost:1337/parse";
const APP_ID = process.env.REACT_APP_PARSE_APP_ID || "swarmcode";
const JS_KEY = process.env.REACT_APP_PARSE_REST_API_KEY || "";

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
};

async function callFunction(name, params = {}) {
  const res = await fetch(`${PARSE_URL}/functions/${name}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.result;
}

// --- Messaging ---

export async function sendMessage({ from, to, message }) {
  return callFunction("sendMessage", { from, to, message });
}

export async function pollMessages(since) {
  const params = since ? { since } : {};
  return callFunction("pollMessages", params);
}

export async function getConversation(userA, userB, { limit, before } = {}) {
  const params = { userA, userB };
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

export async function createCard({ projectHash, title, description, status, assignee, priority, author }) {
  return callFunction("createCard", {
    projectHash,
    title,
    description,
    status,
    assignee,
    priority,
    author,
  });
}

export async function updateCard({ projectHash, cardId, status, assignee, priority, title, description, author }) {
  const params = { projectHash, cardId, author };
  if (status !== undefined) params.status = status;
  if (assignee !== undefined) params.assignee = assignee;
  if (priority !== undefined) params.priority = priority;
  if (title !== undefined) params.title = title;
  if (description !== undefined) params.description = description;
  return callFunction("updateCard", params);
}

export async function addComment({ projectHash, cardId, message, author }) {
  return callFunction("addComment", { projectHash, cardId, message, author });
}

export async function listCards(projectHash, status) {
  const params = { projectHash };
  if (status) params.status = status;
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

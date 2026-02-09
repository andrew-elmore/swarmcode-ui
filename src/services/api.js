// api.js — Parse Cloud Function client service layer

const PARSE_URL = process.env.REACT_APP_PARSE_URL || "http://localhost:1337/parse";
const APP_ID = process.env.REACT_APP_PARSE_APP_ID || "swarmcode";
const REST_API_KEY = process.env.REACT_APP_PARSE_REST_API_KEY || "";

const HEADERS = {
  "X-Parse-Application-Id": APP_ID,
  "Content-Type": "application/json",
};
if (REST_API_KEY) {
  HEADERS["X-Parse-REST-API-Key"] = REST_API_KEY;
}

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

export async function sendMessage({ from, to, subject, message }) {
  return callFunction("sendMessage", { from, to, subject, message });
}

export async function pollMessages(since) {
  const params = since ? { since } : {};
  return callFunction("pollMessages", params);
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

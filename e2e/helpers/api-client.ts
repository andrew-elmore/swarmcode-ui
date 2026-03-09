// API client for E2E test seeding and assertions
// Calls Parse Cloud Functions directly via REST API

const API_URL = 'http://localhost:1337/parse';
const HEADERS = {
  'X-Parse-Application-Id': 'swarmcode',
  'X-Parse-REST-API-Key': 'rest-api-key-dev',
  'Content-Type': 'application/json',
};
const MASTER_HEADERS = {
  ...HEADERS,
  'X-Parse-Master-Key': 'master-key-dev',
};

export async function callFunction(name: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${API_URL}/functions/${name}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud function "${name}" failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.result;
}

export async function callFunctionWithMasterKey(name: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${API_URL}/functions/${name}`, {
    method: 'POST',
    headers: MASTER_HEADERS,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud function "${name}" (master) failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.result;
}

export async function seedProject(path: string, name: string) {
  return callFunction('addRecentProject', { path, name });
}

export async function seedGlobalAgent(name: string, description: string) {
  return callFunction('createAgent', { name, description });
}

export async function deleteGlobalAgent(name: string) {
  return callFunction('deleteAgent', { name });
}

export async function seedAgent(projectId: string, name: string, description: string) {
  await callFunction('createAgent', { name, description });
  await callFunction('assignAgentToProject', { projectId, agentName: name });
}

export async function seedCard(
  projectId: string,
  title: string,
  options: { status?: string; priority?: string; assignee?: string; description?: string } = {}
) {
  return callFunction('createCard', {
    projectId,
    title,
    status: options.status || 'create',
    priority: options.priority || 'medium',
    assignee: options.assignee || null,
    ...(options.description !== undefined && { description: options.description }),
    author: 'e2e-test',
  });
}

export async function seedMessages(
  projectId: string,
  from: string,
  to: string,
  count: number
) {
  const messages = [];
  for (let i = 0; i < count; i++) {
    const msg = await callFunction('sendMessage', {
      projectId,
      from,
      to,
      message: `Test message ${i + 1}`,
    });
    messages.push(msg);
  }
  return messages;
}

export async function seedSprint(projectId: string, name: string) {
  return callFunction('createSprint', { projectId, name });
}

export async function seedCommand(projectId: string, action: string) {
  return callFunction('createCommand', { projectId, action });
}

export async function seedPing(projectId: string, agentStatus: Record<string, string> = {}) {
  return callFunction('recordPing', { projectId, agentStatus });
}

export async function seedArticle(
  projectId: string,
  title: string,
  text?: string,
  keywords?: string[]
) {
  return callFunction('createArticle', {
    projectId,
    title,
    ...(text !== undefined && { text }),
    ...(keywords !== undefined && { keywords }),
  });
}

export async function listArticles(projectId: string) {
  return callFunction('listArticles', { projectId });
}

export async function getBoard(projectPath: string) {
  return callFunction('getOrCreateBoard', { projectPath });
}

export async function listCards(projectId: string) {
  return callFunction('listCards', { projectId });
}

export async function getConversation(projectId: string, user1: string, user2: string) {
  return callFunction('getConversation', { projectId, user1, user2 });
}

export async function deleteProject(path: string) {
  return callFunction('deleteProject', { path });
}

// Batch delete objects of a Parse class using master key
export async function batchDelete(className: string, where: Record<string, unknown> = {}) {
  const queryRes = await fetch(
    `${API_URL}/classes/${className}?where=${encodeURIComponent(JSON.stringify(where))}&limit=1000`,
    { headers: MASTER_HEADERS }
  );
  if (!queryRes.ok) return 0;
  const data = await queryRes.json();
  const results = data.results || [];
  if (results.length === 0) return 0;

  const requests = results.map((obj: { objectId: string }) => ({
    method: 'DELETE',
    path: `/parse/classes/${className}/${obj.objectId}`,
  }));
  await fetch(`${API_URL}/batch`, {
    method: 'POST',
    headers: MASTER_HEADERS,
    body: JSON.stringify({ requests }),
  });
  return results.length;
}

export async function cleanupProject(projectPath: string) {
  await callFunction('deleteProject', { path: projectPath });
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

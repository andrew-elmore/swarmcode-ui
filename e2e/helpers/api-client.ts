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

export async function seedAgent(projectHash: string, name: string, description: string) {
  await callFunction('createAgent', { name, description });
  await callFunction('assignAgentToProject', { projectHash, agentName: name });
}

export async function seedCard(
  projectHash: string,
  title: string,
  options: { status?: string; priority?: string; assignee?: string } = {}
) {
  return callFunction('createCard', {
    projectHash,
    title,
    status: options.status || 'create',
    priority: options.priority || 'medium',
    assignee: options.assignee || null,
    author: 'e2e-test',
  });
}

export async function seedMessages(
  projectHash: string,
  from: string,
  to: string,
  count: number
) {
  const messages = [];
  for (let i = 0; i < count; i++) {
    const msg = await callFunction('sendMessage', {
      projectHash,
      from,
      to,
      message: `Test message ${i + 1}`,
    });
    messages.push(msg);
  }
  return messages;
}

export async function seedSprint(projectHash: string, name: string) {
  return callFunction('createSprint', { projectHash, name });
}

export async function seedCommand(projectHash: string, action: string) {
  return callFunction('createCommand', { projectHash, action });
}

export async function seedPing(projectHash: string, agentStatus: Record<string, string> = {}) {
  return callFunction('recordPing', { projectHash, agentStatus });
}

export async function getBoard(projectPath: string) {
  return callFunction('getOrCreateBoard', { projectPath });
}

export async function listCards(projectHash: string) {
  return callFunction('listCards', { projectHash });
}

export async function getConversation(projectHash: string, agent: string) {
  return callFunction('getConversation', { projectHash, agent });
}

export async function deleteProject(projectHash: string) {
  return callFunction('deleteProject', { projectHash });
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

export async function cleanupProject(projectHash: string) {
  await batchDelete('Card', { projectHash });
  await batchDelete('Message', { projectHash });
  await batchDelete('Command', { projectHash });
  await batchDelete('Ping', { projectHash });
  await batchDelete('Sprint', { projectHash });
  await batchDelete('ProjectAgent', { projectHash });
  await batchDelete('Board', { projectHash });
  await batchDelete('Project', { projectHash });
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

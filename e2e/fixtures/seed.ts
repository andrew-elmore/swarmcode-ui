// Test data factories for E2E tests
// Uses api-client.ts to seed data via Parse Cloud Functions

import {
  seedProject,
  seedAgent,
  seedCard,
  seedMessages,
  seedSprint,
  seedPing,
  seedArticle,
  getBoard,
  cleanupProject,
} from '../helpers/api-client';

export interface TestProject {
  path: string;
  name: string;
  projectHash: string;
}

export interface TestCard {
  cardId: string;
  title: string;
  status: string;
  priority: string;
}

// Default agent definitions matching the team
const DEFAULT_AGENTS = [
  { name: 'pm-1', description: 'Project manager' },
  { name: 'senior-dev-1', description: 'Senior developer' },
  { name: 'developer-1', description: 'Developer' },
  { name: 'qa-1', description: 'QA engineer' },
  { name: 'devops-1', description: 'DevOps engineer' },
];

let projectCounter = 0;

/**
 * Create a test project with a unique path and return its projectHash.
 * Each test file should call this in beforeAll() to get an isolated project.
 */
export async function createTestProject(
  name?: string
): Promise<TestProject> {
  projectCounter++;
  const timestamp = Date.now();
  const uniquePath = `/tmp/e2e-test-${timestamp}-${projectCounter}`;
  const projectName = name || `E2E Test ${projectCounter}`;

  await seedProject(uniquePath, projectName);
  const board = await getBoard(uniquePath);
  const projectHash = board.board.projectHash;

  return { path: uniquePath, name: projectName, projectHash };
}

/**
 * Seed the default team agents and assign them to the project.
 */
export async function seedDefaultAgents(projectHash: string): Promise<void> {
  for (const agent of DEFAULT_AGENTS) {
    await seedAgent(projectHash, agent.name, agent.description);
  }
}

/**
 * Seed a set of cards across different statuses for board testing.
 */
export async function seedBoardCards(
  projectHash: string,
  cards?: Array<{ title: string; status?: string; priority?: string; assignee?: string }>
): Promise<TestCard[]> {
  const defaultCards = cards || [
    { title: 'Card in Create', status: 'create', priority: 'medium' },
    { title: 'Card in Scope', status: 'scope', priority: 'high' },
    { title: 'Card in Implement', status: 'implement', priority: 'critical', assignee: 'developer-1' },
    { title: 'Card in Code Review', status: 'code_review', priority: 'low' },
    { title: 'Card in Test', status: 'test', priority: 'medium', assignee: 'qa-1' },
  ];

  const results: TestCard[] = [];
  for (const card of defaultCards) {
    const result = await seedCard(projectHash, card.title, {
      status: card.status,
      priority: card.priority,
      assignee: card.assignee,
    });
    results.push({
      cardId: result.card.cardId,
      title: card.title,
      status: card.status || 'create',
      priority: card.priority || 'medium',
    });
  }
  return results;
}

/**
 * Seed a conversation with N messages for pagination testing.
 */
export async function seedConversation(
  projectHash: string,
  from: string,
  to: string,
  count: number
) {
  return seedMessages(projectHash, from, to, count);
}

/**
 * Seed a sprint and return its data.
 */
export async function createTestSprint(projectHash: string, name?: string) {
  const sprintName = name || `Sprint ${Date.now()}`;
  return seedSprint(projectHash, sprintName);
}

/**
 * Seed a heartbeat ping to make orchestrator appear online.
 */
export async function seedOrchestratorOnline(
  projectHash: string,
  agentStatus?: Record<string, string>
) {
  return seedPing(projectHash, agentStatus || {
    'developer-1': 'running',
    'qa-1': 'idle',
  });
}

/**
 * Seed a set of articles into a project.
 */
export async function seedArticles(
  projectHash: string,
  articles: Array<{ title: string; text?: string; keywords?: string[] }>
) {
  const results = [];
  for (const article of articles) {
    const result = await seedArticle(projectHash, article.title, article.text, article.keywords);
    results.push(result);
  }
  return results;
}

/**
 * Full test environment setup: project + agents + sample cards.
 * Use this for specs that need a fully populated project.
 */
export async function setupFullTestEnvironment(projectName?: string) {
  const project = await createTestProject(projectName);
  await seedDefaultAgents(project.projectHash);
  const cards = await seedBoardCards(project.projectHash);
  return { project, cards };
}

/**
 * Cleanup all data for a project. Call in afterAll().
 */
export async function teardownProject(projectHash: string) {
  await cleanupProject(projectHash);
}

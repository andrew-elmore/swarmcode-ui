import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, seedBoardCards, teardownProject } from '../../fixtures/seed';
import { AgentSimulator } from '../../fixtures/agent-simulator';
import { selectProject } from '../../helpers/navigation';
import {
  TAB_BOARD,
  TAB_MESSAGES,
  boardColumn,
  boardCard,
  CARD_DETAIL_DIALOG,
  NEW_CARD_BUTTON,
  CARD_TITLE_INPUT,
  CARD_STATUS_SELECT,
  CARD_PRIORITY_SELECT,
} from '../../helpers/selectors';

test.describe('Board Collaboration', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;
  let simulator: AgentSimulator;

  test.beforeAll(async () => {
    const project = await createTestProject('Board Collab Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test.afterEach(async () => {
    if (simulator) await simulator.stop();
  });

  test('user creates card, agent simulator moves it to implement', async ({ page }) => {
    // Start simulator that watches for new cards and moves them
    simulator = new AgentSimulator(projectId, 'developer-1', {
      heartbeatInterval: 0,
      commandPollInterval: 0,
      pollInterval: 500,
    });
    await simulator.start();

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(NEW_CARD_BUTTON)).toBeVisible({ timeout: 10_000 });

    // Create a card via UI
    await page.locator(NEW_CARD_BUTTON).click();
    await page.locator(CARD_TITLE_INPUT).locator('input').fill('Collab Test Card');
    await page.locator(CARD_STATUS_SELECT).click();
    await page.getByRole('option', { name: 'create' }).click();
    await page.locator(CARD_PRIORITY_SELECT).click();
    await page.getByRole('option', { name: 'high' }).click();
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify card appears in create column
    await expect(page.locator(boardColumn('create')).getByText('Collab Test Card')).toBeVisible({
      timeout: 5000,
    });

    // Now agent simulator moves the card to implement via API
    // Find the card element directly by its data-testid prefix within the column
    const cardElement = page.locator(boardColumn('create')).locator('[data-testid^="board-card-"]').filter({ hasText: 'Collab Test Card' });
    const cardTestId = await cardElement.getAttribute('data-testid');
    const cardId = cardTestId?.replace('board-card-', '') || '';

    await simulator.updateCard(cardId, { status: 'implement' });

    // Switch tabs to force board re-fetch (BoardView unmounts/remounts)
    await page.locator(TAB_MESSAGES).click();
    await page.locator(TAB_BOARD).click();

    // Card should now be in the implement column
    await expect(page.locator(boardColumn('implement')).getByText('Collab Test Card')).toBeVisible({
      timeout: 5000,
    });
  });

  test('agent simulator adds comment, comment appears in card detail', async ({ page }) => {
    // Seed a card for the agent to comment on
    const cards = await seedBoardCards(projectId, [
      { title: 'Comment Collab Card', status: 'code_review', priority: 'medium' },
    ]);
    const cardId = cards[0].cardId;

    // Use simulator for direct API calls only (no polling needed)
    simulator = new AgentSimulator(projectId, 'senior-dev-1', {
      heartbeatInterval: 0,
      commandPollInterval: 0,
      pollInterval: 5000,
    });

    // Agent adds a comment via API (no need to start polling)
    await simulator.addComment(cardId, 'LGTM - approved by senior-dev-1');

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(boardCard(cardId))).toBeVisible({ timeout: 10_000 });

    // Open card detail
    await page.locator(boardCard(cardId)).click();
    await expect(page.locator(CARD_DETAIL_DIALOG)).toBeVisible({ timeout: 3000 });

    // Verify the agent's comment appears
    await expect(
      page.locator(CARD_DETAIL_DIALOG).getByText('LGTM - approved by senior-dev-1')
    ).toBeVisible({ timeout: 5000 });

    // Verify comment count updated
    await expect(page.locator(CARD_DETAIL_DIALOG).getByText('Comments (1)')).toBeVisible();
  });

  test('agent creates a new card via API, card appears in board after refresh', async ({ page }) => {
    // Use simulator for direct API calls only (no polling needed)
    simulator = new AgentSimulator(projectId, 'pm-1', {
      heartbeatInterval: 0,
      commandPollInterval: 0,
      pollInterval: 5000,
    });

    // Agent creates a card via API
    const result = await simulator.createCard('Agent-Created Task', {
      status: 'scope',
      priority: 'critical',
      description: 'Created by pm-1 simulator',
    });

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();

    // Card should appear in the scope column
    await expect(page.locator(boardColumn('scope')).getByText('Agent-Created Task')).toBeVisible({
      timeout: 10_000,
    });

    // Open card detail to verify properties
    await page.locator(boardColumn('scope')).getByText('Agent-Created Task').click();
    await expect(page.locator(CARD_DETAIL_DIALOG)).toBeVisible({ timeout: 3000 });

    // Verify the description is shown
    await expect(
      page.locator(CARD_DETAIL_DIALOG).getByText('Created by pm-1 simulator')
    ).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, seedBoardCards, teardownProject } from '../../fixtures/seed';
import { seedSprint } from '../../helpers/api-client';
import {
  TAB_BOARD,
  boardColumn,
  boardCard,
  NEW_CARD_BUTTON,
  CARD_TITLE_INPUT,
  CARD_STATUS_SELECT,
  CARD_PRIORITY_SELECT,
  CARD_DETAIL_DIALOG,
  CARD_COMMENT_INPUT,
  SPRINT_FILTER,
} from '../../helpers/selectors';

test.describe('Board CRUD', () => {
  let projectHash: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Board CRUD Test');
    projectHash = project.projectHash;
    await seedDefaultAgents(projectHash);
  });

  test.afterAll(async () => {
    if (projectHash) await teardownProject(projectHash);
  });

  test('board displays 8-column layout', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_BOARD).click();

    // Verify all 8 columns are visible
    const columns = ['create', 'scope', 'implement', 'code_review', 'test', 'test_review', 'ship', 'done'];
    for (const col of columns) {
      await expect(page.locator(boardColumn(col))).toBeVisible({ timeout: 5000 });
    }
  });

  test('create a card via New Card dialog', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(NEW_CARD_BUTTON)).toBeVisible({ timeout: 5000 });

    // Open New Card dialog
    await page.locator(NEW_CARD_BUTTON).click();

    // Fill in the card form
    await page.locator(CARD_TITLE_INPUT).locator('input').fill('E2E Test Card');

    // Select status = scope
    await page.locator(CARD_STATUS_SELECT).click();
    await page.getByRole('option', { name: 'scope' }).click();

    // Select priority = high
    await page.locator(CARD_PRIORITY_SELECT).click();
    await page.getByRole('option', { name: 'high' }).click();

    // Submit
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify card appears in the scope column
    await expect(page.locator(boardColumn('scope')).getByText('E2E Test Card')).toBeVisible({
      timeout: 5000,
    });
  });

  test('click a card to open CardDetailDialog and edit properties', async ({ page }) => {
    // Seed a card to interact with
    const cards = await seedBoardCards(projectHash, [
      { title: 'Detail Test Card', status: 'create', priority: 'medium' },
    ]);
    const cardId = cards[0].cardId;

    await page.goto('/');
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(boardCard(cardId))).toBeVisible({ timeout: 5000 });

    // Click the card to open detail dialog
    await page.locator(boardCard(cardId)).click();
    await expect(page.locator(CARD_DETAIL_DIALOG)).toBeVisible({ timeout: 3000 });

    // Verify card title is shown
    await expect(page.locator(CARD_DETAIL_DIALOG).getByText('Detail Test Card')).toBeVisible();

    // Change priority to high
    await page.locator(CARD_DETAIL_DIALOG).locator(CARD_PRIORITY_SELECT).click();
    await page.getByRole('option', { name: 'high' }).click();

    // Change status to scope
    await page.locator(CARD_DETAIL_DIALOG).locator(CARD_STATUS_SELECT).click();
    await page.getByRole('option', { name: 'scope' }).click();

    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click();

    // Verify card moved to scope column
    await expect(page.locator(boardColumn('scope')).getByText('Detail Test Card')).toBeVisible({
      timeout: 5000,
    });
  });

  test('add a comment to a card', async ({ page }) => {
    const cards = await seedBoardCards(projectHash, [
      { title: 'Comment Test Card', status: 'implement', priority: 'low' },
    ]);
    const cardId = cards[0].cardId;

    await page.goto('/');
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(boardCard(cardId))).toBeVisible({ timeout: 5000 });

    // Open card detail
    await page.locator(boardCard(cardId)).click();
    await expect(page.locator(CARD_DETAIL_DIALOG)).toBeVisible({ timeout: 3000 });

    // Verify "Comments (0)" initially
    await expect(page.locator(CARD_DETAIL_DIALOG).getByText('Comments (0)')).toBeVisible();

    // Type and submit a comment
    await page.locator(CARD_COMMENT_INPUT).locator('input').fill('E2E test comment');
    await page.getByRole('button', { name: 'Send' }).click();

    // Verify comment appears
    await expect(page.locator(CARD_DETAIL_DIALOG).getByText('E2E test comment')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(CARD_DETAIL_DIALOG).getByText('Comments (1)')).toBeVisible();
  });

  test('create a sprint, assign card to sprint, filter by sprint', async ({ page }) => {
    // Seed a card and a sprint
    const cards = await seedBoardCards(projectHash, [
      { title: 'Sprint Filter Card', status: 'create', priority: 'medium' },
    ]);
    await seedSprint(projectHash, 'Sprint Alpha');

    await page.goto('/');
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(boardCard(cards[0].cardId))).toBeVisible({ timeout: 5000 });

    // Open card detail and assign sprint
    await page.locator(boardCard(cards[0].cardId)).click();
    await expect(page.locator(CARD_DETAIL_DIALOG)).toBeVisible({ timeout: 3000 });

    // Select sprint
    const sprintSelect = page.locator(CARD_DETAIL_DIALOG).getByLabel('Sprint');
    await sprintSelect.click();
    await page.getByRole('option', { name: 'Sprint Alpha' }).click();

    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click();

    // Filter board by sprint
    await expect(page.locator(SPRINT_FILTER)).toBeVisible({ timeout: 3000 });
    await page.locator(SPRINT_FILTER).click();
    await page.getByRole('option', { name: 'Sprint Alpha' }).click();

    // Card should still be visible (it's in Sprint Alpha)
    await expect(page.locator(boardCard(cards[0].cardId))).toBeVisible({ timeout: 5000 });

    // Switch to All Sprints
    await page.locator(SPRINT_FILTER).click();
    await page.getByRole('option', { name: 'All Sprints' }).click();
  });
});

test.describe('Board CRUD — mobile', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });

  let projectHash: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Board Mobile Test');
    projectHash = project.projectHash;
    await seedDefaultAgents(projectHash);
  });

  test.afterAll(async () => {
    if (projectHash) await teardownProject(projectHash);
  });

  test('mobile board shows single column with column selector', async ({ page }) => {
    await seedBoardCards(projectHash, [
      { title: 'Mobile Card A', status: 'create', priority: 'high' },
      { title: 'Mobile Card B', status: 'scope', priority: 'medium' },
    ]);

    await page.goto('/');
    await page.locator(TAB_BOARD).click();

    // On mobile, a column selector dropdown should be visible
    await expect(page.getByLabel('Column')).toBeVisible({ timeout: 5000 });

    // Select 'Create' column
    await page.getByLabel('Column').click();
    await page.getByRole('option', { name: /Create/ }).click();

    // Mobile Card A should be visible (it's in Create)
    await expect(page.getByText('Mobile Card A')).toBeVisible({ timeout: 3000 });

    // Switch to Scope column
    await page.getByLabel('Column').click();
    await page.getByRole('option', { name: /Scope/ }).click();

    // Mobile Card B should be visible (it's in Scope)
    await expect(page.getByText('Mobile Card B')).toBeVisible({ timeout: 3000 });
  });
});

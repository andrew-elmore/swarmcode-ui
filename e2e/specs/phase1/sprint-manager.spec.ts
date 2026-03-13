import { test, expect } from '@playwright/test';
import { createTestProject, teardownProject } from '../../fixtures/seed';
import {
  TAB_BOARD,
  PROJECT_SELECTOR,
  MANAGE_SPRINTS_BUTTON,
  SPRINT_MANAGER_DIALOG,
  SPRINT_NEW_NAME,
  SPRINT_ADD_BUTTON,
  SPRINT_LIST_ITEM,
  SPRINT_MOVE_UP,
  SPRINT_MOVE_DOWN,
  SPRINT_DELETE,
  SPRINT_EDIT_NAME,
  SPRINT_FILTER,
} from '../../helpers/selectors';

test.describe('Sprint Manager CRUD', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Sprint Manager Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('empty state shows no sprints message', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: projectName }).click();
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(MANAGE_SPRINTS_BUTTON)).toBeVisible({ timeout: 5000 });

    // Open Manage Sprints dialog
    await page.locator(MANAGE_SPRINTS_BUTTON).click();
    await expect(page.locator(SPRINT_MANAGER_DIALOG)).toBeVisible({ timeout: 3000 });

    // Verify empty state message
    await expect(
      page.locator(SPRINT_MANAGER_DIALOG).getByText('No sprints yet. Create one above.'),
    ).toBeVisible();

    // Verify no sprint list items
    await expect(page.locator(SPRINT_LIST_ITEM)).toHaveCount(0);

    // Close dialog
    await page.locator(SPRINT_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('create sprint', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: projectName }).click();
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(MANAGE_SPRINTS_BUTTON)).toBeVisible({ timeout: 5000 });

    // Open Manage Sprints dialog
    await page.locator(MANAGE_SPRINTS_BUTTON).click();
    await expect(page.locator(SPRINT_MANAGER_DIALOG)).toBeVisible({ timeout: 3000 });

    // Type sprint name and click Add
    await page.locator(SPRINT_NEW_NAME).locator('input').fill('Sprint Alpha');
    await page.locator(SPRINT_ADD_BUTTON).click();

    // Verify sprint appears in the list
    await expect(page.locator(SPRINT_LIST_ITEM)).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator(SPRINT_LIST_ITEM).getByText('Sprint Alpha')).toBeVisible();

    // Verify the input was cleared after creation
    await expect(page.locator(SPRINT_NEW_NAME).locator('input')).toHaveValue('');

    // Close dialog
    await page.locator(SPRINT_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('rename sprint', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: projectName }).click();
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(MANAGE_SPRINTS_BUTTON)).toBeVisible({ timeout: 5000 });

    // Open Manage Sprints dialog
    await page.locator(MANAGE_SPRINTS_BUTTON).click();
    await expect(page.locator(SPRINT_MANAGER_DIALOG)).toBeVisible({ timeout: 3000 });

    // Sprint Alpha should exist from the previous test — create it if needed
    const count = await page.locator(SPRINT_LIST_ITEM).count();
    if (count === 0) {
      await page.locator(SPRINT_NEW_NAME).locator('input').fill('Sprint Alpha');
      await page.locator(SPRINT_ADD_BUTTON).click();
      await expect(page.locator(SPRINT_LIST_ITEM)).toHaveCount(1, { timeout: 5000 });
    }

    // Click on the sprint name text to enter edit mode
    await page.locator(SPRINT_LIST_ITEM).getByText('Sprint Alpha').click();

    // Verify the inline edit TextField appears
    await expect(page.locator(SPRINT_EDIT_NAME)).toBeVisible({ timeout: 3000 });

    // Clear and type new name
    await page.locator(SPRINT_EDIT_NAME).locator('input').fill('Sprint Beta');

    // Press Enter to confirm rename
    await page.locator(SPRINT_EDIT_NAME).locator('input').press('Enter');

    // Verify the updated name persists
    await expect(page.locator(SPRINT_LIST_ITEM).getByText('Sprint Beta')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(SPRINT_LIST_ITEM).getByText('Sprint Alpha')).not.toBeVisible();

    // Close dialog
    await page.locator(SPRINT_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('delete sprint', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: projectName }).click();
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(MANAGE_SPRINTS_BUTTON)).toBeVisible({ timeout: 5000 });

    // Open Manage Sprints dialog
    await page.locator(MANAGE_SPRINTS_BUTTON).click();
    await expect(page.locator(SPRINT_MANAGER_DIALOG)).toBeVisible({ timeout: 3000 });

    // Ensure at least one sprint exists — create if needed
    const count = await page.locator(SPRINT_LIST_ITEM).count();
    if (count === 0) {
      await page.locator(SPRINT_NEW_NAME).locator('input').fill('Sprint To Delete');
      await page.locator(SPRINT_ADD_BUTTON).click();
      await expect(page.locator(SPRINT_LIST_ITEM)).toHaveCount(1, { timeout: 5000 });
    }

    const initialCount = await page.locator(SPRINT_LIST_ITEM).count();

    // Set up dialog handler to accept window.confirm()
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete button on the first sprint
    await page.locator(SPRINT_LIST_ITEM).first().locator(SPRINT_DELETE).click();

    // Verify sprint was removed
    await expect(page.locator(SPRINT_LIST_ITEM)).toHaveCount(initialCount - 1, { timeout: 5000 });

    // Close dialog
    await page.locator(SPRINT_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('reorder sprints', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: projectName }).click();
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(MANAGE_SPRINTS_BUTTON)).toBeVisible({ timeout: 5000 });

    // Open Manage Sprints dialog
    await page.locator(MANAGE_SPRINTS_BUTTON).click();
    await expect(page.locator(SPRINT_MANAGER_DIALOG)).toBeVisible({ timeout: 3000 });

    // Create two sprints for reordering
    await page.locator(SPRINT_NEW_NAME).locator('input').fill('First Sprint');
    await page.locator(SPRINT_ADD_BUTTON).click();
    await expect(page.locator(SPRINT_LIST_ITEM)).toHaveCount(1, { timeout: 5000 });

    await page.locator(SPRINT_NEW_NAME).locator('input').fill('Second Sprint');
    await page.locator(SPRINT_ADD_BUTTON).click();
    await expect(page.locator(SPRINT_LIST_ITEM)).toHaveCount(2, { timeout: 5000 });

    // Verify initial order: First Sprint at index 0, Second Sprint at index 1
    const items = page.locator(SPRINT_LIST_ITEM);
    await expect(items.nth(0)).toContainText('First Sprint');
    await expect(items.nth(1)).toContainText('Second Sprint');

    // Click "Move down" on the first sprint to swap positions
    await items.nth(0).locator(SPRINT_MOVE_DOWN).click();

    // Verify order changed: Second Sprint is now first, First Sprint is second
    await expect(items.nth(0)).toContainText('Second Sprint', { timeout: 5000 });
    await expect(items.nth(1)).toContainText('First Sprint');

    // Click "Move up" on the second item to swap back
    await items.nth(1).locator(SPRINT_MOVE_UP).click();

    // Verify original order restored
    await expect(items.nth(0)).toContainText('First Sprint', { timeout: 5000 });
    await expect(items.nth(1)).toContainText('Second Sprint');

    // Close dialog
    await page.locator(SPRINT_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });
});

test.describe('Sprint Manager — Board Integration', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Sprint Board Integration Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('created sprint appears in board filter', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: projectName }).click();
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(MANAGE_SPRINTS_BUTTON)).toBeVisible({ timeout: 5000 });

    // Open Manage Sprints dialog and create a sprint
    await page.locator(MANAGE_SPRINTS_BUTTON).click();
    await expect(page.locator(SPRINT_MANAGER_DIALOG)).toBeVisible({ timeout: 3000 });

    await page.locator(SPRINT_NEW_NAME).locator('input').fill('Integration Sprint');
    await page.locator(SPRINT_ADD_BUTTON).click();
    await expect(page.locator(SPRINT_LIST_ITEM)).toHaveCount(1, { timeout: 5000 });

    // Close dialog
    await page.locator(SPRINT_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();

    // Verify the sprint filter dropdown is now visible on the board
    await expect(page.locator(SPRINT_FILTER)).toBeVisible({ timeout: 5000 });

    // Open the sprint filter and verify the created sprint appears as an option
    await page.locator(SPRINT_FILTER).click();
    await expect(page.getByRole('option', { name: 'Integration Sprint' })).toBeVisible({
      timeout: 3000,
    });

    // Select it to verify it's functional
    await page.getByRole('option', { name: 'Integration Sprint' }).click();
    await expect(page.locator(SPRINT_FILTER)).toContainText('Integration Sprint');
  });
});

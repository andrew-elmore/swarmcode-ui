/**
 * CARD-001: CRUD for Board Statuses
 * E2E tests for the Status Manager Dialog via Playwright.
 * Tests create, edit, cancel, and delete status flows through the browser UI.
 */

import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import { callFunction } from '../../helpers/api-client';
import { selectProject } from '../../helpers/navigation';
import {
  TAB_BOARD,
  MANAGE_STATUSES_BUTTON,
  STATUS_MANAGER_DIALOG,
  STATUS_NEW_NAME,
  STATUS_NEW_DESCRIPTION,
  STATUS_NEW_INSTRUCTIONS,
  STATUS_NEW_AGENT,
  STATUS_ADD_BUTTON,
  STATUS_LIST_ITEM,
  STATUS_DELETE,
  STATUS_EDIT_NAME,
} from '../../helpers/selectors';

test.describe('Status Manager', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Status Manager E2E Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('Manage Statuses button is visible on BoardView', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await expect(page.locator(MANAGE_STATUSES_BUTTON)).toBeVisible({ timeout: 5000 });
  });

  test('clicking Manage Statuses opens StatusManagerDialog', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await page.locator(MANAGE_STATUSES_BUTTON).click();

    await expect(page.locator(STATUS_MANAGER_DIALOG)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Manage Statuses' })).toBeVisible();
    await expect(page.locator(STATUS_NEW_NAME)).toBeVisible();
    await expect(page.locator(STATUS_ADD_BUTTON)).toBeVisible();
    await expect(page.locator(STATUS_ADD_BUTTON)).toBeDisabled();

    await page.locator(STATUS_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('dialog shows the 8 default seeded statuses', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await page.locator(MANAGE_STATUSES_BUTTON).click();
    await expect(page.locator(STATUS_MANAGER_DIALOG)).toBeVisible({ timeout: 5000 });

    await expect(page.locator(STATUS_LIST_ITEM)).toHaveCount(8, { timeout: 5000 });

    await page.locator(STATUS_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('creates a new status and it appears in the list', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await page.locator(MANAGE_STATUSES_BUTTON).click();
    await expect(page.locator(STATUS_MANAGER_DIALOG)).toBeVisible({ timeout: 5000 });

    await page.locator(STATUS_NEW_NAME).locator('input').fill('review');
    await page.locator(STATUS_NEW_DESCRIPTION).locator('input').fill('Peer review step');
    await page.locator(STATUS_NEW_INSTRUCTIONS).locator('textarea').first().fill('Review changes carefully');

    await page.locator(STATUS_NEW_AGENT).click();
    await page.getByRole('option', { name: 'senior-dev-1' }).click();

    await expect(page.locator(STATUS_ADD_BUTTON)).toBeEnabled();
    await page.locator(STATUS_ADD_BUTTON).click();

    await expect(
      page.locator(STATUS_MANAGER_DIALOG).getByText('review')
    ).toBeVisible({ timeout: 5000 });

    await page.locator(STATUS_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('edits an existing status name', async ({ page }) => {
    // Seed a dedicated status to avoid modifying shared defaults
    await callFunction('createStatus', {
      projectId,
      name: 'edit-target',
      description: 'Will be renamed',
      instructions: 'Rename this status',
      agentName: 'qa-1',
      order: 90,
    });

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await page.locator(MANAGE_STATUSES_BUTTON).click();
    await expect(page.locator(STATUS_MANAGER_DIALOG)).toBeVisible({ timeout: 5000 });

    await expect(
      page.locator(STATUS_MANAGER_DIALOG).getByText('edit-target')
    ).toBeVisible({ timeout: 5000 });

    await page.locator(STATUS_MANAGER_DIALOG).getByText('edit-target').click();

    await expect(page.locator(STATUS_EDIT_NAME)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(STATUS_EDIT_NAME).locator('input')).toHaveValue('edit-target');

    await page.locator(STATUS_EDIT_NAME).locator('input').fill('renamed-status');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.locator(STATUS_MANAGER_DIALOG).getByText('renamed-status')
    ).toBeVisible({ timeout: 5000 });

    await page.locator(STATUS_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('cancels edit without saving changes', async ({ page }) => {
    await callFunction('createStatus', {
      projectId,
      name: 'cancel-test',
      description: 'Edit will be cancelled',
      instructions: 'Do not rename',
      agentName: 'qa-1',
      order: 91,
    });

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await page.locator(MANAGE_STATUSES_BUTTON).click();
    await expect(page.locator(STATUS_MANAGER_DIALOG)).toBeVisible({ timeout: 5000 });

    await page.locator(STATUS_MANAGER_DIALOG).getByText('cancel-test').click();
    await expect(page.locator(STATUS_EDIT_NAME)).toBeVisible({ timeout: 3000 });

    await page.locator(STATUS_EDIT_NAME).locator('input').fill('should-not-appear');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      page.locator(STATUS_MANAGER_DIALOG).getByText('cancel-test')
    ).toBeVisible({ timeout: 3000 });
    await expect(
      page.locator(STATUS_MANAGER_DIALOG).getByText('should-not-appear')
    ).not.toBeVisible();

    await page.locator(STATUS_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });

  test('deletes a status after confirmation', async ({ page }) => {
    // Seed a throwaway status to delete
    await callFunction('createStatus', {
      projectId,
      name: 'to-be-deleted',
      description: 'Delete me',
      instructions: 'This will be removed',
      agentName: 'qa-1',
      order: 99,
    });

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();
    await page.locator(MANAGE_STATUSES_BUTTON).click();
    await expect(page.locator(STATUS_MANAGER_DIALOG)).toBeVisible({ timeout: 5000 });

    await expect(
      page.locator(STATUS_MANAGER_DIALOG).getByText('to-be-deleted')
    ).toBeVisible({ timeout: 5000 });

    // Accept the window.confirm dialog before clicking delete
    page.once('dialog', (dialog) => dialog.accept());

    // to-be-deleted has order:99 — it sorts last
    await page.locator(STATUS_DELETE).last().click();

    await expect(
      page.locator(STATUS_MANAGER_DIALOG).getByText('to-be-deleted')
    ).not.toBeVisible({ timeout: 5000 });

    await page.locator(STATUS_MANAGER_DIALOG).getByRole('button', { name: 'Close' }).click();
  });
});

import { test, expect } from '@playwright/test';
import { createTestProject, teardownProject } from '../../fixtures/seed';
import {
  TAB_PROJECTS,
  ADD_PROJECT_BUTTON,
  projectListItem,
  DELETE_PROJECT_BUTTON,
  PROJECT_SELECTOR,
} from '../../helpers/selectors';

test.describe('Project CRUD', () => {
  let projectHash: string;

  test.afterAll(async () => {
    if (projectHash) await teardownProject(projectHash);
  });

  test('add a new project via Add Project dialog', async ({ page }) => {
    await page.goto('/');

    // Navigate to Projects tab
    await page.locator(TAB_PROJECTS).click();

    // Click Add Project button
    await page.locator(ADD_PROJECT_BUTTON).first().click();

    // Fill in the project path
    const pathInput = page.getByLabel('Project Path');
    await pathInput.fill('/tmp/e2e-crud-test-project');
    await pathInput.press('Enter');

    // Verify project appears in the list
    await expect(page.locator(projectListItem('e2e-crud-test-project'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('project appears in project selector dropdown', async ({ page }) => {
    // Seed a project via API for a clean state
    const project = await createTestProject('Selector Test Project');
    projectHash = project.projectHash;

    await page.goto('/');

    // The project selector should contain the seeded project
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });

    // Click the selector to open dropdown
    await page.locator(PROJECT_SELECTOR).click();

    // Verify the project name appears in the dropdown options
    await expect(page.getByRole('option', { name: 'Selector Test Project' })).toBeVisible();
  });

  test('switch between projects and verify board reloads', async ({ page }) => {
    // Seed two projects
    const project1 = await createTestProject('Switch Project A');
    const project2 = await createTestProject('Switch Project B');

    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });

    // Select project A
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: 'Switch Project A' }).click();

    // Navigate to Board tab to verify it loaded
    const tabBoard = page.locator('[data-testid="tab-board"]');
    await tabBoard.click();
    await expect(page.getByText('Board')).toBeVisible();

    // Switch to project B
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: 'Switch Project B' }).click();

    // Board should still be visible (reloaded for new project)
    await expect(page.getByText('Board')).toBeVisible();

    // Cleanup both projects
    await teardownProject(project1.projectHash);
    await teardownProject(project2.projectHash);
  });

  test('delete a project with confirmation dialog', async ({ page }) => {
    // Seed a project to delete
    const project = await createTestProject('Delete Me Project');

    await page.goto('/');
    await page.locator(TAB_PROJECTS).click();

    // Wait for the project to appear in the list
    await expect(page.locator(projectListItem('Delete Me Project'))).toBeVisible({
      timeout: 5000,
    });

    // Click the delete button on the project
    const listItem = page.locator(projectListItem('Delete Me Project'));
    await listItem.locator(DELETE_PROJECT_BUTTON).click();

    // Confirmation dialog should appear
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
    await expect(page.getByText('Delete Me Project')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete' }).click();

    // Verify project is removed from the list
    await expect(page.locator(projectListItem('Delete Me Project'))).not.toBeVisible({
      timeout: 5000,
    });
  });
});

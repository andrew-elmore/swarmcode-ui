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
  let boardId: string;
  let projectPath: string;

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
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
    boardId = project.boardId;
    projectPath = project.path;

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
    await teardownProject(project1.path);
    await teardownProject(project2.path);
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

test.describe('Project selector edge cases', () => {
  test('empty state shows No projects in selector and empty message in ProjectsView', async ({ page }) => {
    // Intercept getRecentProjects to return empty projects array
    await page.route('**/parse/functions/getRecentProjects', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: [] }),
      }),
    );

    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });

    // Open the selector dropdown — should show disabled 'No projects' option
    await page.locator(PROJECT_SELECTOR).click();
    await expect(page.getByRole('option', { name: 'No projects' })).toBeVisible();

    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape');

    // Navigate to Projects tab and verify empty state message
    await page.locator(TAB_PROJECTS).click();
    await expect(page.getByText('No projects yet. Add one to get started.')).toBeVisible({
      timeout: 5000,
    });
  });

  test('auto-selects first project on load', async ({ page }) => {
    // Seed a project via API
    const project = await createTestProject('Auto Select Project');

    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });

    // Verify the project selector displays the seeded project name without manual selection
    await expect(page.locator(PROJECT_SELECTOR)).toContainText('Auto Select Project', {
      timeout: 5000,
    });

    // Navigate to Board tab to verify board data loaded for auto-selected project
    await page.locator('[data-testid="tab-board"]').click();
    await expect(page.getByText('Board')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await teardownProject(project.path);
  });

  test('selecting same project twice is idempotent', async ({ page }) => {
    // Seed a project
    const project = await createTestProject('Idempotent Select Project');

    await page.goto('/');
    await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });

    // Select the project
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: 'Idempotent Select Project' }).click();

    // Verify project is selected
    await expect(page.locator(PROJECT_SELECTOR)).toContainText('Idempotent Select Project');

    // Navigate to Board tab to verify board loads
    await page.locator('[data-testid="tab-board"]').click();
    await expect(page.getByText('Board')).toBeVisible({ timeout: 5000 });

    // Open dropdown and select the same project again
    await page.locator(PROJECT_SELECTOR).click();
    await page.getByRole('option', { name: 'Idempotent Select Project' }).click();

    // Verify no errors — project still selected and board still displays
    await expect(page.locator(PROJECT_SELECTOR)).toContainText('Idempotent Select Project');
    await expect(page.getByText('Board')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await teardownProject(project.path);
  });
});

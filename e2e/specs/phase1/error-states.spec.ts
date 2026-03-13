import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import { selectProject } from '../../helpers/navigation';
import {
  TAB_BOARD,
  TAB_MESSAGES,
  TAB_ARTICLES,
  agentSidebarItem,
  MESSAGE_INPUT,
  MESSAGE_SEND_BUTTON,
  ERROR_ALERT,
} from '../../helpers/selectors';

const ERROR_RESPONSE = {
  status: 500,
  contentType: 'application/json',
  body: JSON.stringify({ code: 141, error: 'Internal server error' }),
};

test.describe('Error/Failure States', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Error States Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('board shows error alert on fetch failure', async ({ page }) => {
    // Intercept getOrCreateBoard to return 500 BEFORE navigating
    await page.route('**/parse/functions/getOrCreateBoard', (route) =>
      route.fulfill(ERROR_RESPONSE),
    );

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();

    // Verify error alert is visible with error text
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(ERROR_ALERT)).toContainText('Internal server error');
  });

  test('chat shows error snackbar on send failure', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_MESSAGES).click();

    // Wait for agent sidebar to load and select an agent
    await expect(page.locator(agentSidebarItem('developer-1'))).toBeVisible({ timeout: 10_000 });
    await page.locator(agentSidebarItem('developer-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Intercept sendMessage to return 500
    await page.route('**/parse/functions/sendMessage', (route) =>
      route.fulfill(ERROR_RESPONSE),
    );

    // Type and send a message
    await page.locator(MESSAGE_INPUT).locator('textarea').fill('This will fail');
    await page.locator(MESSAGE_SEND_BUTTON).click();

    // Verify error snackbar appears (ChatView uses Snackbar + Alert)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('alert')).toContainText('Internal server error');
  });

  test('articles shows dismissible error alert', async ({ page }) => {
    // Intercept listArticles to return 500 BEFORE navigating
    await page.route('**/parse/functions/listArticles', (route) =>
      route.fulfill(ERROR_RESPONSE),
    );

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_ARTICLES).click();

    // Verify error alert is visible
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(ERROR_ALERT)).toContainText('Internal server error');

    // Dismiss the alert by clicking the close button
    await page.locator(ERROR_ALERT).getByRole('button', { name: 'Close' }).click();

    // Verify alert is dismissed
    await expect(page.locator(ERROR_ALERT)).not.toBeVisible({ timeout: 3000 });
  });

  test('board recovers after transient error', async ({ page }) => {
    // Intercept getOrCreateBoard to return 500 on first load
    await page.route('**/parse/functions/getOrCreateBoard', (route) =>
      route.fulfill(ERROR_RESPONSE),
    );

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();

    // Verify error alert appears
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 5000 });

    // Remove the interception so next load succeeds
    await page.unroute('**/parse/functions/getOrCreateBoard');

    // Reload the page
    await page.reload();
    await selectProject(page, projectName);
    await page.locator(TAB_BOARD).click();

    // Verify board loads successfully — error alert should not be visible
    await expect(page.locator(ERROR_ALERT)).not.toBeVisible({ timeout: 5000 });

    // Verify the board heading is visible (successful load)
    await expect(page.getByText('Board')).toBeVisible({ timeout: 5000 });
  });
});

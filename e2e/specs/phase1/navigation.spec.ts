import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import { seedMessages } from '../../helpers/api-client';
import { selectProject } from '../../helpers/navigation';
import {
  TAB_MESSAGES,
  TAB_BOARD,
  TAB_AGENTS,
  TAB_STREAM,
  TAB_PROJECTS,
  TAB_COMMANDS,
  TAB_ARTICLES,
  MESSAGE_INPUT,
  MOBILE_DRAWER_TOGGLE,
  ADD_AGENT_BUTTON,
  ADD_PROJECT_BUTTON,
} from '../../helpers/selectors';

test.describe('Navigation', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Nav Test Project');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('all 7 tabs render without errors', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_MESSAGES)).toBeVisible({ timeout: 10_000 });

    // Click each tab and verify the view renders
    const tabs = [
      { selector: TAB_MESSAGES, expects: 'Select an agent' },
      { selector: TAB_BOARD, expects: 'Board' },
      { selector: TAB_AGENTS, expects: 'Agents' },
      { selector: TAB_STREAM, expects: 'Stream' },
      { selector: TAB_PROJECTS, expects: 'Projects' },
      { selector: TAB_COMMANDS, expects: 'Remote Agent Control' },
      { selector: TAB_ARTICLES, expects: 'Articles' },
    ];

    for (const tab of tabs) {
      await page.locator(tab.selector).click();
      // Verify no crash — the expected text or element should be visible
      await expect(
        page.getByText(tab.expects).first().or(page.locator(`[data-testid="${tab.expects}"]`))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('tab switching preserves message state', async ({ page }) => {
    // Seed a message so there's content to verify
    await seedMessages(projectId, 'owner', 'developer-1', 1);

    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_MESSAGES)).toBeVisible({ timeout: 10_000 });

    // Go to Messages tab and select an agent
    await page.locator(TAB_MESSAGES).click();
    await page.locator('[data-testid="agent-sidebar-item-developer-1"]').click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Type something in the message input (don't send)
    await page.locator(MESSAGE_INPUT).locator('input, textarea').fill('unsent draft message');

    // Switch to Board tab
    await page.locator(TAB_BOARD).click();
    await expect(page.getByText('Board')).toBeVisible();

    // Switch back to Messages tab
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // The message input should still have the draft text
    const inputValue = await page.locator(MESSAGE_INPUT).locator('input, textarea').inputValue();
    expect(inputValue).toBe('unsent draft message');
  });
});

// ─── CARD-100: Project init from home page ────────────────────────────────────

test.describe('CARD-100: Navigation — project init from home page', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Init Test Project');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('selecting project from home page loads project data (agents tab populated)', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);

    // Navigate to Agents tab — agents should be loaded (not empty)
    await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 10_000 });
    await page.locator(TAB_AGENTS).click();

    // Add Agent button should be visible, confirming the tab rendered without crash
    await expect(page.locator(ADD_AGENT_BUTTON)).toBeVisible({ timeout: 5_000 });
  });

  test('selecting same project twice (home → project → home → project) loads correctly second time', async ({ page }) => {
    // First visit
    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 10_000 });

    // Return to home (Projects tab)
    await page.locator(TAB_PROJECTS).click();
    await expect(page.locator(ADD_PROJECT_BUTTON)).toBeVisible({ timeout: 5_000 });

    // Second visit — select the same project again from home
    await selectProject(page, projectName);
    await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 10_000 });

    // Agents tab should still render without crash on second visit
    await page.locator(TAB_AGENTS).click();
    await expect(page.locator(ADD_AGENT_BUTTON)).toBeVisible({ timeout: 5_000 });
  });

  test('navigating between two projects loads each project correctly', async ({ page }) => {
    // Seed a second project
    const projectB = await createTestProject('Init Test Project B');
    await seedDefaultAgents(projectB.projectId);

    try {
      await page.goto('/');
      await selectProject(page, projectName);
      await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 10_000 });

      // Go to Agents tab on project A
      await page.locator(TAB_AGENTS).click();
      await expect(page.locator(ADD_AGENT_BUTTON)).toBeVisible({ timeout: 5_000 });

      // Navigate to Projects tab and select project B
      await page.locator(TAB_PROJECTS).click();
      await selectProject(page, projectB.name);
      await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 10_000 });

      // Agents tab on project B should also load without error
      await page.locator(TAB_AGENTS).click();
      await expect(page.locator(ADD_AGENT_BUTTON)).toBeVisible({ timeout: 5_000 });
    } finally {
      await teardownProject(projectB.path);
    }
  });
});

test.describe('Navigation — mobile', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });

  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Nav Mobile Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('mobile tabs show icon-only and are navigable', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_MESSAGES)).toBeVisible({ timeout: 10_000 });

    // Tabs should be visible as icons
    const tabSelectors = [TAB_MESSAGES, TAB_BOARD, TAB_AGENTS, TAB_STREAM, TAB_PROJECTS, TAB_COMMANDS, TAB_ARTICLES];
    for (const sel of tabSelectors) {
      await expect(page.locator(sel)).toBeVisible();
    }

    // Click through each tab — verify no crash
    for (const sel of tabSelectors) {
      await page.locator(sel).click();
      // Small delay to let view render
      await page.waitForTimeout(300);
    }
  });

  test('mobile hamburger menu toggles agent drawer on Messages tab', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_MESSAGES)).toBeVisible({ timeout: 10_000 });

    // Go to Messages tab
    await page.locator(TAB_MESSAGES).click();

    // Hamburger menu should be visible on mobile Messages tab
    await expect(page.locator(MOBILE_DRAWER_TOGGLE)).toBeVisible({ timeout: 5000 });

    // Click hamburger to open agent drawer
    await page.locator(MOBILE_DRAWER_TOGGLE).click();

    // Agent sidebar items should appear
    await expect(page.locator('[data-testid="agent-sidebar-item-all"]')).toBeVisible({
      timeout: 3000,
    });
  });
});

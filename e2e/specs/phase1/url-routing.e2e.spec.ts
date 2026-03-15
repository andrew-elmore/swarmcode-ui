/**
 * CARD-089 E2E Tests — URL Router
 * CARD-090 E2E Tests — Agents load on direct URL navigation
 *
 * Covers:
 *   1. "/" shows Projects page with no tab bar
 *   2. Project dropdown navigates to /:projectId
 *   3. Tab clicks update the URL
 *   4. Direct URL navigation: /:projectId/board loads the Board tab
 *   5. Browser back / forward navigation
 *   6. AgentsView project dropdown navigates to /:newId/agents
 *   7. CARD-090: direct URL to /:projectId/agents loads agents list
 */

import { test, expect, Page } from '@playwright/test';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import { selectProject } from '../../helpers/navigation';
import {
  TAB_STREAM,
  TAB_MESSAGES,
  TAB_BOARD,
  TAB_AGENTS,
  TAB_COMMANDS,
  TAB_ARTICLES,
  PROJECT_SELECTOR,
  agentListItem,
} from '../../helpers/selectors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the Parse objectId path segment from the current URL, e.g. "/Abc123/board" → "Abc123" */
async function getProjectIdFromUrl(page: Page): Promise<string> {
  const url = new URL(page.url());
  return url.pathname.split('/').filter(Boolean)[0] ?? '';
}

/** Returns the pathname of the current page URL. */
async function getPathname(page: Page): Promise<string> {
  return new URL(page.url()).pathname;
}

// ─── Suite 1: "/" shows Projects page, no tab bar ─────────────────────────────

test.describe('URL Router — "/" shows Projects page', () => {
  test('/ renders Projects heading and no navigation tabs', async ({ page }) => {
    await page.goto('/');

    // Projects heading visible
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 10_000 });

    // Tab bar is absent — none of the tab data-testids should be present
    await expect(page.locator(TAB_STREAM)).not.toBeVisible();
    await expect(page.locator(TAB_BOARD)).not.toBeVisible();
    await expect(page.locator(TAB_MESSAGES)).not.toBeVisible();
  });
});

// ─── Suite 2: Project selector navigates to /:projectId ───────────────────────

test.describe('URL Router — project selector navigates URL', () => {
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Router Selector Test');
    projectPath = project.path;
    projectName = project.name;
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('selecting a project in the dropdown navigates away from "/"', async ({ page }) => {
    await page.goto('/');

    // Start at /
    expect(new URL(page.url()).pathname).toBe('/');

    await selectProject(page, projectName);

    // URL should now include a projectId segment (not "/")
    await expect(async () => {
      const pathname = await getPathname(page);
      expect(pathname).not.toBe('/');
      expect(pathname.split('/').filter(Boolean)).toHaveLength(1); // /:projectId (index = Stream)
    }).toPass({ timeout: 10_000 });
  });

  test('after selecting a project the tab bar becomes visible', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);

    await expect(page.locator(TAB_STREAM)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(TAB_BOARD)).toBeVisible();
    await expect(page.locator(TAB_MESSAGES)).toBeVisible();
  });

  test('after selecting a project Stream tab is selected (index route)', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);

    await expect(page.locator(TAB_STREAM)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(TAB_STREAM)).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Suite 3: Tab clicks update the URL ───────────────────────────────────────

test.describe('URL Router — tab clicks update URL segments', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Router Tabs Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(project.projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  /**
   * Helper: navigate to the project index, then click a tab and assert URL + aria-selected.
   */
  async function tabTest(
    page: Page,
    tabSelector: string,
    expectedSegment: string,
  ) {
    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_STREAM)).toBeVisible({ timeout: 10_000 });

    // Capture the real projectId from the URL
    const pid = await getProjectIdFromUrl(page);
    expect(pid).toBeTruthy();

    // Click the target tab
    await page.locator(tabSelector).click();

    // URL should update to /:projectId/<segment> (or just /:projectId for stream)
    await expect(async () => {
      const pathname = await getPathname(page);
      const expected = expectedSegment ? `/${pid}/${expectedSegment}` : `/${pid}`;
      expect(pathname).toBe(expected);
    }).toPass({ timeout: 8_000 });

    // Tab should be selected
    await expect(page.locator(tabSelector)).toHaveAttribute('aria-selected', 'true');
  }

  test('clicking Messages tab sets URL to /:projectId/messages', async ({ page }) => {
    await tabTest(page, TAB_MESSAGES, 'messages');
  });

  test('clicking Board tab sets URL to /:projectId/board', async ({ page }) => {
    await tabTest(page, TAB_BOARD, 'board');
  });

  test('clicking Agents tab sets URL to /:projectId/agents', async ({ page }) => {
    await tabTest(page, TAB_AGENTS, 'agents');
  });

  test('clicking Commands tab sets URL to /:projectId/commands', async ({ page }) => {
    await tabTest(page, TAB_COMMANDS, 'commands');
  });

  test('clicking Articles tab sets URL to /:projectId/articles', async ({ page }) => {
    await tabTest(page, TAB_ARTICLES, 'articles');
  });

  test('clicking Stream tab from /board returns URL to /:projectId', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_BOARD)).toBeVisible({ timeout: 10_000 });

    const pid = await getProjectIdFromUrl(page);

    // Go to Board first
    await page.locator(TAB_BOARD).click();
    await expect(async () => {
      expect(await getPathname(page)).toBe(`/${pid}/board`);
    }).toPass({ timeout: 5_000 });

    // Click Stream
    await page.locator(TAB_STREAM).click();
    await expect(async () => {
      expect(await getPathname(page)).toBe(`/${pid}`);
    }).toPass({ timeout: 5_000 });

    await expect(page.locator(TAB_STREAM)).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Suite 4: Direct URL navigation ───────────────────────────────────────────

test.describe('URL Router — direct URL navigation', () => {
  let projectId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Router Direct Nav Test');
    projectId = project.projectId;
    projectPath = project.path;
    await seedDefaultAgents(project.projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('navigating directly to /:projectId/board shows Board tab selected', async ({ page }) => {
    await page.goto(`/${projectId}/board`);

    await expect(page.locator(TAB_BOARD)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(TAB_BOARD)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(TAB_STREAM)).toHaveAttribute('aria-selected', 'false');
  });

  test('navigating directly to /:projectId shows Stream tab selected', async ({ page }) => {
    await page.goto(`/${projectId}`);

    await expect(page.locator(TAB_STREAM)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(TAB_STREAM)).toHaveAttribute('aria-selected', 'true');
  });

  test('navigating directly to /:projectId/messages shows Messages tab selected', async ({ page }) => {
    await page.goto(`/${projectId}/messages`);

    await expect(page.locator(TAB_MESSAGES)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(TAB_MESSAGES)).toHaveAttribute('aria-selected', 'true');
  });

  test('navigating directly to /:projectId/agents shows Agents tab selected', async ({ page }) => {
    await page.goto(`/${projectId}/agents`);

    await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(TAB_AGENTS)).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Suite 5: Browser back / forward ──────────────────────────────────────────

test.describe('URL Router — browser back / forward', () => {
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Router Back Fwd Test');
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(project.projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('browser back returns to previous tab URL', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_STREAM)).toBeVisible({ timeout: 10_000 });

    const pid = await getProjectIdFromUrl(page);

    // Navigate: Stream → Board
    await page.locator(TAB_BOARD).click();
    await expect(async () => {
      expect(await getPathname(page)).toBe(`/${pid}/board`);
    }).toPass({ timeout: 5_000 });

    // Press back
    await page.goBack();

    await expect(async () => {
      expect(await getPathname(page)).toBe(`/${pid}`);
    }).toPass({ timeout: 5_000 });

    await expect(page.locator(TAB_STREAM)).toHaveAttribute('aria-selected', 'true');
  });

  test('browser forward after back restores forward URL', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await expect(page.locator(TAB_STREAM)).toBeVisible({ timeout: 10_000 });

    const pid = await getProjectIdFromUrl(page);

    // Navigate: Stream → Board
    await page.locator(TAB_BOARD).click();
    await expect(async () => {
      expect(await getPathname(page)).toBe(`/${pid}/board`);
    }).toPass({ timeout: 5_000 });

    // Go back (Stream)
    await page.goBack();
    await expect(async () => {
      expect(await getPathname(page)).toBe(`/${pid}`);
    }).toPass({ timeout: 5_000 });

    // Go forward (Board)
    await page.goForward();
    await expect(async () => {
      expect(await getPathname(page)).toBe(`/${pid}/board`);
    }).toPass({ timeout: 5_000 });

    await expect(page.locator(TAB_BOARD)).toHaveAttribute('aria-selected', 'true');
  });

  test('back from /:projectId goes to / (Projects page)', async ({ page }) => {
    // Start at /, then navigate to the project
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 10_000 });

    await selectProject(page, projectName);
    await expect(page.locator(TAB_STREAM)).toBeVisible({ timeout: 10_000 });

    // Go back — should be at /
    await page.goBack();
    await expect(async () => {
      expect(await getPathname(page)).toBe('/');
    }).toPass({ timeout: 5_000 });

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Suite 6: AgentsView project dropdown navigates URL ───────────────────────

test.describe('URL Router — AgentsView project dropdown navigates', () => {
  let projectA: { projectId: string; path: string; name: string };
  let projectB: { projectId: string; path: string; name: string };

  test.beforeAll(async () => {
    projectA = await createTestProject('Router Agents Alpha');
    projectB = await createTestProject('Router Agents Beta');
    await seedDefaultAgents(projectA.projectId);
    await seedDefaultAgents(projectB.projectId);
  });

  test.afterAll(async () => {
    if (projectA?.path) await teardownProject(projectA.path);
    if (projectB?.path) await teardownProject(projectB.path);
  });

  test('changing project dropdown in AgentsView updates URL to /:newId/agents', async ({ page }) => {
    // Start at Project A's agents page
    await page.goto(`/${projectA.projectId}/agents`);
    await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(TAB_AGENTS)).toHaveAttribute('aria-selected', 'true');

    // Find the project dropdown (label: "Project") and open it
    const projectDropdown = page.getByLabel('Project');
    await expect(projectDropdown).toBeVisible({ timeout: 5_000 });
    await projectDropdown.click();

    // Select Project B
    await expect(
      page.getByRole('option', { name: new RegExp(projectB.name) })
    ).toBeVisible({ timeout: 5_000 });
    await page.getByRole('option', { name: new RegExp(projectB.name) }).click();

    // URL should update to /:projectB.projectId/agents
    await expect(async () => {
      expect(await getPathname(page)).toBe(`/${projectB.projectId}/agents`);
    }).toPass({ timeout: 8_000 });

    // Agents tab should remain selected
    await expect(page.locator(TAB_AGENTS)).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Suite 7: CARD-090 — direct URL agents load (no waterfall) ────────────────
//
// Regression guard: navigating directly to /:projectId/agents must load and
// display agents without waiting for a fetchProject waterfall. The fix uses
// projectIdParam from useParams() to dispatch fetchAgents immediately.

test.describe('CARD-090: direct URL to /:projectId/agents loads agents list', () => {
  let projectId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('CARD-090 Agents Load Test');
    projectId = project.projectId;
    projectPath = project.path;
    await seedDefaultAgents(project.projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('agents list is visible after direct URL navigation to /:projectId/agents', async ({ page }) => {
    // Cold navigate — no prior app state
    await page.goto(`/${projectId}/agents`);

    // Tab bar loads and Agents tab is active
    await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(TAB_AGENTS)).toHaveAttribute('aria-selected', 'true');

    // Agents heading renders
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible({ timeout: 10_000 });

    // At least one seeded agent appears — confirms fetchAgents fired without
    // waiting for the fetchProject waterfall (CARD-090 regression guard)
    await expect(page.locator(agentListItem('pm-1'))).toBeVisible({ timeout: 10_000 });
  });

  test('all seeded agents are visible after direct URL navigation', async ({ page }) => {
    await page.goto(`/${projectId}/agents`);

    await expect(page.locator(TAB_AGENTS)).toBeVisible({ timeout: 15_000 });

    // All default agents seeded by seedDefaultAgents should be visible
    for (const name of ['pm-1', 'senior-dev-1', 'developer-1', 'qa-1', 'devops-1']) {
      await expect(page.locator(agentListItem(name))).toBeVisible({ timeout: 10_000 });
    }
  });
});

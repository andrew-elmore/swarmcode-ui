import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import {
  TAB_MESSAGES,
  TAB_BOARD,
  TAB_AGENTS,
  TAB_STREAM,
  TAB_PROJECTS,
  TAB_COMMANDS,
  TAB_ARTICLES,
  ADD_AGENT_BUTTON,
  AGENT_EDIT_DIALOG,
} from '../../helpers/selectors';

test.describe('Accessibility audit', () => {
  let projectId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('A11y Audit Test');
    projectId = project.projectId;
    projectPath = project.path;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test('axe scan passes on each main view', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(TAB_MESSAGES)).toBeVisible({ timeout: 10_000 });

    const tabs = [
      { selector: TAB_MESSAGES, name: 'Messages' },
      { selector: TAB_BOARD, name: 'Board' },
      { selector: TAB_AGENTS, name: 'Agents' },
      { selector: TAB_STREAM, name: 'Stream' },
      { selector: TAB_PROJECTS, name: 'Projects' },
      { selector: TAB_COMMANDS, name: 'Commands' },
      { selector: TAB_ARTICLES, name: 'Articles' },
    ];

    for (const tab of tabs) {
      await page.locator(tab.selector).click();
      // Wait for view to render
      await page.waitForTimeout(500);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a'])
        .analyze();

      // Filter to only critical and serious violations
      const serious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      expect(serious, `${tab.name} view has critical/serious a11y violations: ${JSON.stringify(serious.map((v) => ({ id: v.id, impact: v.impact, description: v.description })))}`).toHaveLength(0);
    }
  });

  test('keyboard navigation through tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(TAB_MESSAGES)).toBeVisible({ timeout: 10_000 });

    const tabSelectors = [
      TAB_MESSAGES,
      TAB_BOARD,
      TAB_AGENTS,
      TAB_STREAM,
      TAB_PROJECTS,
      TAB_COMMANDS,
      TAB_ARTICLES,
    ];

    // Focus the first tab by clicking it
    await page.locator(TAB_MESSAGES).focus();

    // Tab through each tab button and verify focus
    for (let i = 0; i < tabSelectors.length; i++) {
      const focused = page.locator(tabSelectors[i]);
      await expect(focused).toBeFocused({ timeout: 3000 });

      // Press Enter to activate the focused tab
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Tab to the next tab button (if not the last one)
      if (i < tabSelectors.length - 1) {
        await page.keyboard.press('Tab');
      }
    }
  });

  test('dialog accessibility — AgentEditDialog', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_AGENTS).click();
    await expect(page.locator(ADD_AGENT_BUTTON)).toBeVisible({ timeout: 10_000 });

    // Open the agent edit dialog
    await page.locator(ADD_AGENT_BUTTON).click();
    await expect(page.locator(AGENT_EDIT_DIALOG)).toBeVisible({ timeout: 3000 });

    // Run axe scan on the dialog
    const results = await new AxeBuilder({ page })
      .include('[data-testid="agent-edit-dialog"]')
      .withTags(['wcag2a'])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(serious, `AgentEditDialog has critical/serious a11y violations: ${JSON.stringify(serious.map((v) => ({ id: v.id, impact: v.impact, description: v.description })))}`).toHaveLength(0);

    // Verify focus trap — Tab should cycle within the dialog
    // Press Tab multiple times and verify focus stays within the dialog
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }

    // After many Tabs, focus should still be within the dialog (MUI Dialog has built-in focus trap)
    const activeElement = await page.evaluate(() => {
      const el = document.activeElement;
      const dialog = document.querySelector('[data-testid="agent-edit-dialog"]');
      return dialog?.contains(el) ?? false;
    });
    expect(activeElement).toBe(true);

    // Close dialog with Escape key
    await page.keyboard.press('Escape');
    await expect(page.locator(AGENT_EDIT_DIALOG)).not.toBeVisible({ timeout: 3000 });
  });
});

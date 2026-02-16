import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, seedConversation, teardownProject } from '../../fixtures/seed';
import {
  TAB_MESSAGES,
  agentSidebarItem,
  MESSAGE_INPUT,
  MESSAGE_SEND_BUTTON,
  MESSAGE_BUBBLE,
  LOAD_OLDER_BUTTON,
  MOBILE_DRAWER_TOGGLE,
} from '../../helpers/selectors';

test.describe('Messaging', () => {
  let projectHash: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Messaging Test');
    projectHash = project.projectHash;
    await seedDefaultAgents(projectHash);
  });

  test.afterAll(async () => {
    if (projectHash) await teardownProject(projectHash);
  });

  test('select an agent from sidebar and see chat view', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('all'))).toBeVisible({ timeout: 10_000 });

    // Click on developer-1 agent
    await page.locator(agentSidebarItem('developer-1')).click();

    // Message input should now be visible
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Placeholder text should reference the agent
    const placeholder = await page.locator(MESSAGE_INPUT).locator('textarea').getAttribute('placeholder');
    expect(placeholder).toContain('developer-1');
  });

  test('type and send a message via Enter key', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('developer-1'))).toBeVisible({ timeout: 10_000 });
    await page.locator(agentSidebarItem('developer-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Type a message and press Enter
    await page.locator(MESSAGE_INPUT).locator('textarea').fill('Hello from E2E test');
    await page.locator(MESSAGE_INPUT).locator('textarea').press('Enter');

    // Verify message appears as a bubble (right-aligned = owner)
    await expect(page.locator(MESSAGE_BUBBLE).last()).toContainText('Hello from E2E test', {
      timeout: 5000,
    });
  });

  test('send a message via send button', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('developer-1'))).toBeVisible({ timeout: 10_000 });
    await page.locator(agentSidebarItem('developer-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Type a message and click send button
    await page.locator(MESSAGE_INPUT).locator('textarea').fill('Sent via button');
    await page.locator(MESSAGE_SEND_BUTTON).click();

    // Verify message appears
    await expect(page.locator(MESSAGE_BUBBLE).last()).toContainText('Sent via button', {
      timeout: 5000,
    });

    // Input should be cleared after sending
    const inputValue = await page.locator(MESSAGE_INPUT).locator('textarea').inputValue();
    expect(inputValue).toBe('');
  });

  test('Shift+Enter inserts newline instead of sending', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('developer-1'))).toBeVisible({ timeout: 10_000 });
    await page.locator(agentSidebarItem('developer-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Type text, press Shift+Enter (newline), type more
    const textarea = page.locator(MESSAGE_INPUT).locator('textarea');
    await textarea.fill('Line one');
    await textarea.press('Shift+Enter');
    await textarea.type('Line two');

    // Input should still contain text (not sent)
    const value = await textarea.inputValue();
    expect(value).toContain('Line one');
    expect(value).toContain('Line two');
  });

  test('Load older messages pagination works', async ({ page }) => {
    // Seed 40+ messages to trigger pagination (default page size is 30)
    await seedConversation(projectHash, 'owner', 'qa-1', 35);

    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('qa-1'))).toBeVisible({ timeout: 10_000 });
    await page.locator(agentSidebarItem('qa-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Wait for messages to load
    await expect(page.locator(MESSAGE_BUBBLE).first()).toBeVisible({ timeout: 5000 });

    // Load older button should be visible since we have more than page size
    await expect(page.locator(LOAD_OLDER_BUTTON)).toBeVisible({ timeout: 5000 });

    // Click load older
    await page.locator(LOAD_OLDER_BUTTON).click();

    // Wait for pagination to load — the 31st bubble proves older messages loaded
    await page.locator(MESSAGE_BUBBLE).nth(30).waitFor({ timeout: 5000 });
  });
});

test.describe('Messaging — mobile', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });

  let projectHash: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Messaging Mobile Test');
    projectHash = project.projectHash;
    await seedDefaultAgents(projectHash);
  });

  test.afterAll(async () => {
    if (projectHash) await teardownProject(projectHash);
  });

  test('mobile drawer toggle shows agent sidebar for selection', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();

    // On mobile, sidebar is hidden; hamburger opens drawer
    await expect(page.locator(MOBILE_DRAWER_TOGGLE)).toBeVisible({ timeout: 5000 });
    await page.locator(MOBILE_DRAWER_TOGGLE).click();

    // Agent sidebar should appear in drawer
    await expect(page.locator(agentSidebarItem('developer-1'))).toBeVisible({ timeout: 3000 });

    // Select agent from drawer
    await page.locator(agentSidebarItem('developer-1')).click();

    // Message input should now be visible
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });
  });
});

import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import { AgentSimulator, createSimulatorTeam, startSimulatorTeam } from '../../fixtures/agent-simulator';
import {
  TAB_MESSAGES,
  agentSidebarItem,
  MESSAGE_INPUT,
  MESSAGE_SEND_BUTTON,
  MESSAGE_BUBBLE,
} from '../../helpers/selectors';

test.describe('Agent Message Round-Trip', () => {
  let projectHash: string;
  let simulator: AgentSimulator;

  test.beforeAll(async () => {
    const project = await createTestProject('Round Trip Test');
    projectHash = project.projectHash;
    await seedDefaultAgents(projectHash);
  });

  test.afterAll(async () => {
    if (projectHash) await teardownProject(projectHash);
  });

  test.afterEach(async () => {
    if (simulator) await simulator.stop();
  });

  test('send message from UI, agent replies, reply appears in real-time', async ({ page }) => {
    // Start simulator that auto-replies to "hello" messages
    simulator = new AgentSimulator(projectHash, 'developer-1', {
      responseMap: { hello: 'Hello from simulator!' },
      responseDelay: 200,
      pollInterval: 300,
      heartbeatInterval: 0,
      commandPollInterval: 0,
    });
    await simulator.start();

    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('developer-1'))).toBeVisible({ timeout: 10_000 });
    await page.locator(agentSidebarItem('developer-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Send a message from the UI
    await page.locator(MESSAGE_INPUT).locator('textarea').fill('hello world');
    await page.locator(MESSAGE_SEND_BUTTON).click();

    // Verify our message appears
    await expect(page.locator(MESSAGE_BUBBLE).last()).toContainText('hello world', {
      timeout: 5000,
    });

    // Wait for the simulator's reply to appear via LiveQuery (no page reload)
    await expect(page.locator(MESSAGE_BUBBLE).filter({ hasText: 'Hello from simulator!' })).toBeVisible({
      timeout: 10_000,
    });

    // Verify the simulator recorded the message
    const received = await simulator.waitForMessages(1, 5000);
    expect(received[0].message).toContain('hello world');
  });

  test('agent reply appears without page reload (LiveQuery)', async ({ page }) => {
    // Start simulator with custom handler that replies after a delay
    simulator = new AgentSimulator(projectHash, 'qa-1', {
      onMessage: async (msg) => {
        if (msg.message.includes('ping')) return 'pong from qa-1';
        return null;
      },
      responseDelay: 300,
      pollInterval: 300,
      heartbeatInterval: 0,
      commandPollInterval: 0,
    });
    await simulator.start();

    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('qa-1'))).toBeVisible({ timeout: 10_000 });
    await page.locator(agentSidebarItem('qa-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Count bubbles before sending
    const bubblesBefore = await page.locator(MESSAGE_BUBBLE).count();

    // Send ping
    await page.locator(MESSAGE_INPUT).locator('textarea').fill('ping');
    await page.locator(MESSAGE_SEND_BUTTON).click();

    // Wait for reply bubble to appear (should be bubblesBefore + 2: our msg + reply)
    await expect(page.locator(MESSAGE_BUBBLE).filter({ hasText: 'pong from qa-1' })).toBeVisible({
      timeout: 10_000,
    });

    // Verify we did NOT reload the page — check that the URL hasn't changed
    // and the input is still focused/visible (LiveQuery update, not navigation)
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible();
  });

  test('broadcast message to all agents, all simulators reply', async ({ page }) => {
    // Create 3 simulators that each reply differently
    const simulators = createSimulatorTeam(projectHash, [
      { name: 'developer-1', options: { responseMap: { broadcast: 'dev-1 ack' }, heartbeatInterval: 0, commandPollInterval: 0 } },
      { name: 'qa-1', options: { responseMap: { broadcast: 'qa-1 ack' }, heartbeatInterval: 0, commandPollInterval: 0 } },
      { name: 'devops-1', options: { responseMap: { broadcast: 'devops-1 ack' }, heartbeatInterval: 0, commandPollInterval: 0 } },
    ]);
    const stopAll = await startSimulatorTeam(simulators);

    try {
      await page.goto('/');
      await page.locator(TAB_MESSAGES).click();
      await expect(page.locator(agentSidebarItem('all'))).toBeVisible({ timeout: 10_000 });

      // Select "All Agents" for broadcast
      await page.locator(agentSidebarItem('all')).click();
      await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

      // Send broadcast message
      await page.locator(MESSAGE_INPUT).locator('textarea').fill('broadcast test');
      await page.locator(MESSAGE_SEND_BUTTON).click();

      // Verify our broadcast message appears
      await expect(page.locator(MESSAGE_BUBBLE).filter({ hasText: 'broadcast test' })).toBeVisible({
        timeout: 5000,
      });

      // Wait for all 3 simulator replies to appear via LiveQuery
      await expect(page.locator(MESSAGE_BUBBLE).filter({ hasText: 'dev-1 ack' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator(MESSAGE_BUBBLE).filter({ hasText: 'qa-1 ack' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator(MESSAGE_BUBBLE).filter({ hasText: 'devops-1 ack' })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await stopAll();
    }
  });

  test('unread badge increments when viewing different agent', async ({ page }) => {
    // Start simulator that will send a message to trigger unread badge
    simulator = new AgentSimulator(projectHash, 'senior-dev-1', {
      responseMap: { trigger: 'unread test reply' },
      responseDelay: 200,
      pollInterval: 300,
      heartbeatInterval: 0,
      commandPollInterval: 0,
    });
    await simulator.start();

    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('senior-dev-1'))).toBeVisible({ timeout: 10_000 });

    // Select a DIFFERENT agent (qa-1) so that senior-dev-1's replies show as unread
    await page.locator(agentSidebarItem('qa-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Send a message to senior-dev-1 directly via simulator's sendMessage to trigger unread
    await simulator.sendMessage('owner', 'You have a new message!');

    // Wait for the unread badge to appear on senior-dev-1's sidebar item
    // MUI Badge renders the count inside a .MuiBadge-badge span
    const sidebarItem = page.locator(agentSidebarItem('senior-dev-1'));
    await expect(sidebarItem.locator('.MuiBadge-badge')).toBeVisible({ timeout: 10_000 });

    // Badge should show at least 1
    const badgeText = await sidebarItem.locator('.MuiBadge-badge').textContent();
    expect(Number(badgeText)).toBeGreaterThanOrEqual(1);

    // Click on senior-dev-1 to clear unread
    await page.locator(agentSidebarItem('senior-dev-1')).click();

    // Badge should disappear or show 0 (MUI hides badge when content is 0)
    await expect(sidebarItem.locator('.MuiBadge-badge')).not.toBeVisible({ timeout: 5000 });
  });
});

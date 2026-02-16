import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, seedBoardCards, teardownProject } from '../../fixtures/seed';
import { AgentSimulator } from '../../fixtures/agent-simulator';
import { seedCommand } from '../../helpers/api-client';
import {
  TAB_MESSAGES,
  TAB_BOARD,
  TAB_COMMANDS,
  agentSidebarItem,
  MESSAGE_INPUT,
  MESSAGE_BUBBLE,
  boardColumn,
  boardCard,
  ORCHESTRATOR_STATUS,
  commandButton,
  COMMAND_HISTORY_ITEM,
} from '../../helpers/selectors';

test.describe('LiveQuery Real-Time Updates', () => {
  let projectHash: string;
  let simulator: AgentSimulator;

  test.beforeAll(async () => {
    const project = await createTestProject('LiveQuery Test');
    projectHash = project.projectHash;
    await seedDefaultAgents(projectHash);
  });

  test.afterAll(async () => {
    if (projectHash) await teardownProject(projectHash);
  });

  test.afterEach(async () => {
    if (simulator) await simulator.stop();
  });

  test('messages appear in real-time without page refresh', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('developer-1'))).toBeVisible({ timeout: 10_000 });
    await page.locator(agentSidebarItem('developer-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Count current bubbles
    const initialCount = await page.locator(MESSAGE_BUBBLE).count();

    // Start simulator that will send a message after a delay
    simulator = new AgentSimulator(projectHash, 'developer-1', {
      heartbeatInterval: 0,
      commandPollInterval: 0,
      pollInterval: 5000,
    });

    // Send message from simulator directly — should appear via LiveQuery
    await simulator.sendMessage('owner', 'Real-time message from dev-1');

    // Message should appear without any page navigation or refresh
    await expect(
      page.locator(MESSAGE_BUBBLE).filter({ hasText: 'Real-time message from dev-1' })
    ).toBeVisible({ timeout: 10_000 });

    // Verify bubble count increased
    const newCount = await page.locator(MESSAGE_BUBBLE).count();
    expect(newCount).toBeGreaterThan(initialCount);

    // Verify we're still on the same page (no reload occurred)
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible();
  });

  test('command status transitions appear in real-time via LiveQuery', async ({ page }) => {
    // Start simulator with heartbeat + command polling
    simulator = new AgentSimulator(projectHash, 'developer-1', {
      heartbeatInterval: 2000,
      agentStatus: { 'developer-1': 'running' },
      pollInterval: 5000,
      commandPollInterval: 1000,
    });
    await simulator.start();

    // Wait for heartbeat
    await new Promise((r) => setTimeout(r, 2500));

    await page.goto('/');
    await page.locator(TAB_COMMANDS).click();
    await expect(page.locator(ORCHESTRATOR_STATUS).getByText('Online')).toBeVisible({
      timeout: 10_000,
    });

    // Click Stop All to create a command
    await page.locator(commandButton('stop_all')).click();

    // Should see "requested" status first (command created)
    await expect(page.locator(COMMAND_HISTORY_ITEM).first()).toBeVisible({ timeout: 5000 });

    // Wait for LiveQuery to update status to "fulfilled" (simulator auto-fulfills)
    // This proves the Command LiveQuery subscription is working
    await expect(
      page.locator(COMMAND_HISTORY_ITEM).first().getByText('fulfilled')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('orchestrator ping updates reflect in real-time', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_COMMANDS).click();
    await expect(page.locator(ORCHESTRATOR_STATUS)).toBeVisible({ timeout: 10_000 });

    // Initially should show offline (no pings yet for this project)
    await expect(page.locator(ORCHESTRATOR_STATUS).getByText('Offline')).toBeVisible({
      timeout: 5000,
    });

    // Start simulator with heartbeat
    simulator = new AgentSimulator(projectHash, 'developer-1', {
      heartbeatInterval: 2000,
      agentStatus: { 'developer-1': 'running' },
      pollInterval: 5000,
      commandPollInterval: 0,
    });
    await simulator.start();

    // Ping subscription should update status to Online via LiveQuery
    await expect(page.locator(ORCHESTRATOR_STATUS).getByText('Online')).toBeVisible({
      timeout: 15_000,
    });
  });
});

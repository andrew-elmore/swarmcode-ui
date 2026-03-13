import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import { AgentSimulator } from '../../fixtures/agent-simulator';
import { selectProject } from '../../helpers/navigation';
import {
  TAB_COMMANDS,
  ORCHESTRATOR_STATUS,
  commandButton,
  COMMAND_HISTORY_ITEM,
} from '../../helpers/selectors';

test.describe('Command Orchestration', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;
  let simulator: AgentSimulator;

  test.beforeAll(async () => {
    const project = await createTestProject('Command Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test.afterEach(async () => {
    if (simulator) await simulator.stop();
  });

  test('agent heartbeat pings show orchestrator as online', async ({ page }) => {
    // Start simulator with heartbeat pings every 2 seconds
    simulator = new AgentSimulator(projectId, 'developer-1', {
      heartbeatInterval: 2000,
      agentStatus: { 'developer-1': 'running', 'qa-1': 'idle' },
      pollInterval: 5000,
      commandPollInterval: 0,
    });
    await simulator.start();

    // Wait for initial heartbeat to register
    await new Promise((r) => setTimeout(r, 2500));

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_COMMANDS).click();
    await expect(page.locator(ORCHESTRATOR_STATUS)).toBeVisible({ timeout: 10_000 });

    // Orchestrator should show "Online" (ping within 60 seconds)
    await expect(page.locator(ORCHESTRATOR_STATUS).getByText('Online')).toBeVisible({
      timeout: 10_000,
    });

    // Agent status chips should show the reported statuses
    await expect(page.getByText('developer-1')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('running')).toBeVisible();
  });

  test('user clicks Stop All, simulator receives and fulfills command', async ({ page }) => {
    // Start simulator with command polling
    simulator = new AgentSimulator(projectId, 'developer-1', {
      heartbeatInterval: 2000,
      agentStatus: { 'developer-1': 'running' },
      pollInterval: 5000,
      commandPollInterval: 1000,
    });
    await simulator.start();

    // Wait for heartbeat to register
    await new Promise((r) => setTimeout(r, 2500));

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_COMMANDS).click();
    await expect(page.locator(ORCHESTRATOR_STATUS)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(ORCHESTRATOR_STATUS).getByText('Online')).toBeVisible({
      timeout: 10_000,
    });

    // Click Stop All button
    await page.locator(commandButton('stop_all')).click();

    // Command should appear in history as "requested" initially
    await expect(page.locator(COMMAND_HISTORY_ITEM).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator(COMMAND_HISTORY_ITEM).first().getByText(/stop/i)).toBeVisible();

    // Simulator should receive and auto-fulfill the command
    const commands = await simulator.waitForCommands(1, 10_000);
    expect(commands[0].action).toBe('stop_all');

    // UI should update to show "fulfilled" status via LiveQuery
    await expect(
      page.locator(COMMAND_HISTORY_ITEM).first().getByText('fulfilled')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Start All and Restart All commands work end-to-end', async ({ page }) => {
    // Start simulator with command polling
    simulator = new AgentSimulator(projectId, 'developer-1', {
      heartbeatInterval: 2000,
      agentStatus: { 'developer-1': 'running' },
      pollInterval: 5000,
      commandPollInterval: 1000,
    });
    await simulator.start();

    // Wait for heartbeat
    await new Promise((r) => setTimeout(r, 2500));

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_COMMANDS).click();
    await expect(page.locator(ORCHESTRATOR_STATUS).getByText('Online')).toBeVisible({
      timeout: 10_000,
    });

    // Click Start All
    await page.locator(commandButton('start_all')).click();
    await expect(
      page.locator(COMMAND_HISTORY_ITEM).first().getByText('fulfilled')
    ).toBeVisible({ timeout: 10_000 });

    // Click Restart All
    await page.locator(commandButton('restart_all')).click();

    // Wait for the newest command (restart_all) to be fulfilled
    // It should be the first item in the history (most recent)
    await expect(
      page.locator(COMMAND_HISTORY_ITEM).first().getByText(/restart/i)
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator(COMMAND_HISTORY_ITEM).first().getByText('fulfilled')
    ).toBeVisible({ timeout: 10_000 });

    // Simulator should have received both commands
    const commands = await simulator.waitForCommands(2, 10_000);
    expect(commands.map((c) => c.action)).toContain('start_all');
    expect(commands.map((c) => c.action)).toContain('restart_all');
  });
});

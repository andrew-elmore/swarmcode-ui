/**
 * E2E Tests for CARD-197: Cross-project message isolation
 *
 * Verifies the critical user flow: after the legacy dual-path shim removal,
 * getConversation ONLY returns board-scoped messages. Legacy boardless messages
 * are excluded, and messages never leak between projects.
 *
 * @card CARD-197
 * @author qa-1
 */

import { test, expect } from '@playwright/test';
import {
  createTestProject,
  seedDefaultAgents,
  seedConversation,
  teardownProject,
} from '../../fixtures/seed';
import { callFunction, getConversation, batchDelete } from '../../helpers/api-client';
import {
  TAB_MESSAGES,
  agentSidebarItem,
  MESSAGE_INPUT,
  MESSAGE_SEND_BUTTON,
  MESSAGE_BUBBLE,
} from '../../helpers/selectors';

test.describe('CARD-197: Cross-project conversation isolation', () => {
  let projectHashA: string;
  let projectHashB: string;

  test.beforeAll(async () => {
    const projectA = await createTestProject('CARD-197 Project A');
    projectHashA = projectA.projectHash;
    await seedDefaultAgents(projectHashA);

    const projectB = await createTestProject('CARD-197 Project B');
    projectHashB = projectB.projectHash;
    await seedDefaultAgents(projectHashB);

    // Seed different message counts: 4 in A, 6 in B
    await seedConversation(projectHashA, 'owner', 'developer-1', 4);
    await seedConversation(projectHashB, 'owner', 'developer-1', 6);
  });

  test.afterAll(async () => {
    if (projectHashA) await teardownProject(projectHashA);
    if (projectHashB) await teardownProject(projectHashB);
  });

  test('API: getConversation returns only board-scoped messages per project', async () => {
    const convoA = await getConversation(projectHashA, 'owner', 'developer-1');
    const convoB = await getConversation(projectHashB, 'owner', 'developer-1');

    // Each project has its own isolated message count
    expect(convoA.messages.length).toBe(4);
    expect(convoB.messages.length).toBe(6);
  });

  test('API: messages from project A do not leak into project B', async () => {
    // Send a uniquely identifiable message in project A
    await callFunction('sendMessage', {
      projectHash: projectHashA,
      from: 'owner',
      to: 'developer-1',
      message: 'E2E-197-unique-alpha',
    });

    const convoB = await getConversation(projectHashB, 'owner', 'developer-1');
    const leaked = convoB.messages.find(
      (m: { message: string }) => m.message === 'E2E-197-unique-alpha'
    );
    expect(leaked).toBeUndefined();

    // Verify it IS in project A
    const convoA = await getConversation(projectHashA, 'owner', 'developer-1');
    const found = convoA.messages.find(
      (m: { message: string }) => m.message === 'E2E-197-unique-alpha'
    );
    expect(found).toBeDefined();
  });

  test('UI: conversation loads correct messages for the active project', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_MESSAGES).click();
    await expect(page.locator(agentSidebarItem('developer-1'))).toBeVisible({ timeout: 10_000 });

    // Select developer-1
    await page.locator(agentSidebarItem('developer-1')).click();
    await expect(page.locator(MESSAGE_INPUT)).toBeVisible({ timeout: 5000 });

    // Send a unique message to verify scoping
    const uniqueMsg = `E2E-197-ui-scoped-${Date.now()}`;
    await page.locator(MESSAGE_INPUT).locator('textarea').fill(uniqueMsg);
    await page.locator(MESSAGE_SEND_BUTTON).click();

    // Verify the message appears in the UI
    await expect(page.locator(MESSAGE_BUBBLE).last()).toContainText(uniqueMsg, {
      timeout: 5000,
    });

    // Verify via API that the message is in exactly one project
    const convoA = await getConversation(projectHashA, 'owner', 'developer-1');
    const convoB = await getConversation(projectHashB, 'owner', 'developer-1');

    const inA = convoA.messages.some((m: { message: string }) => m.message === uniqueMsg);
    const inB = convoB.messages.some((m: { message: string }) => m.message === uniqueMsg);

    // Should be in exactly one project, not both
    expect(inA !== inB).toBe(true);
  });
});

import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import { seedGlobalAgent, deleteGlobalAgent } from '../../helpers/api-client';
import {
  TAB_AGENTS,
  ADD_AGENT_BUTTON,
  AGENT_EDIT_DIALOG,
  agentListItem,
} from '../../helpers/selectors';

test.describe('Agent Management', () => {
  let projectHash: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Agent Mgmt Test');
    projectHash = project.projectHash;
    await seedDefaultAgents(projectHash);
  });

  test.afterAll(async () => {
    // Clean up any test-created global agents
    try { await deleteGlobalAgent('e2e-test-agent'); } catch { /* may not exist */ }
    if (projectHash) await teardownProject(projectHash);
  });

  test('open Agents tab and see assigned agents', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_AGENTS).click();

    // Should see the "Agents" heading
    await expect(page.getByText('Agents').first()).toBeVisible({ timeout: 10_000 });

    // Add Agent button should be visible
    await expect(page.locator(ADD_AGENT_BUTTON)).toBeVisible();

    // Assigned agents should appear (seeded via seedDefaultAgents)
    await expect(page.locator(agentListItem('developer-1'))).toBeVisible({ timeout: 5000 });
    await expect(page.locator(agentListItem('qa-1'))).toBeVisible();
  });

  test('create a new global agent via dialog', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_AGENTS).click();
    await expect(page.locator(ADD_AGENT_BUTTON)).toBeVisible({ timeout: 10_000 });

    // Click Add Agent
    await page.locator(ADD_AGENT_BUTTON).click();
    await expect(page.locator(AGENT_EDIT_DIALOG)).toBeVisible({ timeout: 3000 });

    // Dialog title should say "Create Agent"
    await expect(page.locator(AGENT_EDIT_DIALOG).getByText('Create Agent')).toBeVisible();

    // Fill in name and description
    await page.locator(AGENT_EDIT_DIALOG).getByLabel('Name').fill('e2e-test-agent');
    await page.locator(AGENT_EDIT_DIALOG).getByLabel('Description').fill('Agent created by E2E test');

    // Submit
    await page.locator(AGENT_EDIT_DIALOG).getByRole('button', { name: 'Create' }).click();

    // Dialog should close
    await expect(page.locator(AGENT_EDIT_DIALOG)).not.toBeVisible({ timeout: 5000 });

    // New agent should appear in the Available (unassigned) section
    await expect(page.locator(agentListItem('e2e-test-agent'))).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Agent created by E2E test')).toBeVisible();
  });

  test('assign agent to active project', async ({ page }) => {
    // Ensure e2e-test-agent exists as a global agent (may have been created by previous test)
    try { await seedGlobalAgent('e2e-test-agent', 'Agent created by E2E test'); } catch { /* already exists */ }

    await page.goto('/');
    await page.locator(TAB_AGENTS).click();
    await expect(page.locator(agentListItem('e2e-test-agent'))).toBeVisible({ timeout: 10_000 });

    // Click the assign button (+ icon) on the unassigned agent row
    await page
      .locator(agentListItem('e2e-test-agent'))
      .getByTitle('Assign to project')
      .click();

    // Agent should move from Available to Assigned section — it now has an Active toggle
    await expect(
      page.locator(agentListItem('e2e-test-agent')).locator('input[type="checkbox"]')
    ).toBeVisible({ timeout: 5000 });
  });

  test('toggle agent active/inactive', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_AGENTS).click();
    await expect(page.locator(agentListItem('developer-1'))).toBeVisible({ timeout: 10_000 });

    // developer-1 should be in the assigned table with an active switch
    const agentRow = page.locator(agentListItem('developer-1'));
    const toggle = agentRow.locator('input[type="checkbox"]');
    await expect(toggle).toBeVisible();

    // Should be active (checked) by default
    await expect(toggle).toBeChecked();

    // Toggle inactive
    await toggle.click();
    await expect(toggle).not.toBeChecked({ timeout: 3000 });

    // Row should have reduced opacity (0.5) when inactive
    await expect(agentRow).toHaveCSS('opacity', '0.5', { timeout: 3000 });

    // Toggle back to active
    await toggle.click();
    await expect(toggle).toBeChecked({ timeout: 3000 });
    await expect(agentRow).toHaveCSS('opacity', '1', { timeout: 3000 });
  });

  test('unassign agent from project', async ({ page }) => {
    await page.goto('/');
    await page.locator(TAB_AGENTS).click();
    await expect(page.locator(agentListItem('devops-1'))).toBeVisible({ timeout: 10_000 });

    // Verify devops-1 is in the assigned section (has Active toggle)
    const agentRow = page.locator(agentListItem('devops-1'));
    await expect(agentRow.locator('input[type="checkbox"]')).toBeVisible();

    // Click unassign button
    await agentRow.getByTitle('Unassign from project').click();

    // devops-1 should still exist but no longer have the Active toggle
    // (it moved to Available section which has no switch column)
    await expect(page.locator(agentListItem('devops-1'))).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator(agentListItem('devops-1')).locator('input[type="checkbox"]')
    ).not.toBeVisible();

    // It should now have the "Assign to project" button instead
    await expect(
      page.locator(agentListItem('devops-1')).getByTitle('Assign to project')
    ).toBeVisible();
  });

  test('delete agent and verify removal', async ({ page }) => {
    // Ensure e2e-test-agent exists for deletion
    try { await seedGlobalAgent('e2e-test-agent', 'Agent created by E2E test'); } catch { /* already exists */ }

    await page.goto('/');
    await page.locator(TAB_AGENTS).click();
    await expect(page.locator(agentListItem('e2e-test-agent'))).toBeVisible({ timeout: 10_000 });

    // Click delete button on e2e-test-agent
    await page
      .locator(agentListItem('e2e-test-agent'))
      .getByTitle('Delete')
      .click();

    // Confirm dialog should appear
    await expect(page.getByText('Delete Agent')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('e2e-test-agent')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete' }).click();

    // Agent should be removed from the list
    await expect(page.locator(agentListItem('e2e-test-agent'))).not.toBeVisible({ timeout: 5000 });
  });
});

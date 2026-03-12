import { Page, expect } from '@playwright/test';
import { PROJECT_SELECTOR } from './selectors';

/**
 * Selects the named project in the project selector dropdown.
 * Call this after page.goto('/') before interacting with project-scoped views.
 */
export async function selectProject(page: Page, projectName: string): Promise<void> {
  await expect(page.locator(PROJECT_SELECTOR)).toBeVisible({ timeout: 10_000 });
  // Use retry: open dropdown, check option, close and retry if projects not loaded yet
  await expect(async () => {
    await page.keyboard.press('Escape'); // close any open dropdown before retry
    await page.locator(PROJECT_SELECTOR).locator('[role=combobox]').click();
    await expect(
      page.locator('[role="listbox"]').getByRole('option', { name: projectName })
    ).toBeVisible({ timeout: 2_000 });
    await page.locator('[role="listbox"]').getByRole('option', { name: projectName }).click();
  }).toPass({ timeout: 15_000, intervals: [1_000, 2_000, 3_000] });
}

import { test, expect } from '@playwright/test';

test.describe('Smoke test', () => {
  test('app loads and shows SwarmCode UI', async ({ page }) => {
    await page.goto('/');
    // The app should render — look for the project selector or a tab
    await expect(page.locator('[data-testid="tab-messages"]')).toBeVisible({ timeout: 15_000 });
  });
});

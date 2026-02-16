// Global setup fixture: verify API and UI servers are running
// Playwright's webServer config handles starting both servers,
// but this fixture provides a health check and common test state.

import { healthCheck } from '../helpers/api-client';

export async function waitForServer(maxRetries = 30, intervalMs = 1000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    if (await healthCheck()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('API server did not become healthy within timeout');
}

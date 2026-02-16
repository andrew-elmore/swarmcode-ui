import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  outputDir: '../test-results',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ../swarmcode-api/start-test-server.js',
      port: 1337,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npx webpack serve --config webpack.config.cjs',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    {
      name: 'mobile-chrome',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        isMobile: true,
      },
    },
  ],
});

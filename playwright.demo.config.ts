import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/demo',
  workers: 1,
  timeout: 120000,
  use: {
    baseURL:
      process.env.DEMO_TEST_URL ||
      'http://127.0.0.1:4173/aura-space-apps-2026/',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.E2E_BROWSER_PATH
      ? { executablePath: process.env.E2E_BROWSER_PATH }
      : {},
  },
  webServer: process.env.DEMO_TEST_URL
    ? undefined
    : {
        command: 'node scripts/serve-demo.mjs',
        url: 'http://127.0.0.1:4173/aura-space-apps-2026/',
        reuseExistingServer: true,
      },
});

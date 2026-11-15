import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
export default defineConfig({
  testDir: './tests/web',
  workers: 1,
  timeout: 120000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL:
      process.env.E2E_BASE_URL ||
      `http://127.0.0.1:${process.env.WEB_PORT || '3000'}`,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    launchOptions: process.env.E2E_BROWSER_PATH
      ? { executablePath: process.env.E2E_BROWSER_PATH }
      : {},
    trace: 'off',
    screenshot: 'only-on-failure',
  },
});

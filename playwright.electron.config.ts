import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/electron',
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/electron', open: 'never' }]],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/performance',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/performance-results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run preview:test',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000
  }
});

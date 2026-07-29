import baseConfig from './playwright.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...baseConfig,
  testIgnore: undefined,
  testMatch: '**/visual.spec.ts'
});

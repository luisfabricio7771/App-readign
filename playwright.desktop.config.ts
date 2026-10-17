import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './desktop', testMatch: '**/smoke.spec.ts',
  timeout: 60000, expect: { timeout: 20000 }, workers: 1,
  outputDir: 'desktop-test-results',
  use: { trace: 'retain-on-failure' }
});

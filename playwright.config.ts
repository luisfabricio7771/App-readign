import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  projects: [
    { name: 'desktop', testMatch: '**/app.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', testMatch: '**/app.spec.ts', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'dev-worker', testMatch: '**/worker.spec.ts', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5174' } }
  ],
  webServer: [
    { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 30000 },
    { command: 'npm run dev -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: !process.env.CI, timeout: 30000 }
  ]
});

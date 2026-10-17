import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 960, height: 640 },
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'node scripts/serve.mjs dist --port=4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});

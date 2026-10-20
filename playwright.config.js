import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The smoke test walks the whole grass scene through software WebGL, so its
  // wall-clock cost tracks CPU rasterization speed rather than game logic. A
  // local run with swiftshader forced takes about 190 s; CI runners have fewer
  // cores, so they need a wider budget than a developer machine. Widen the
  // budget instead of trimming the walkthrough: every assertion still has to
  // pass, only the time allowed to reach them changes.
  timeout: process.env.CI ? 600_000 : 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 960, height: 640 },
    // Keep the UI viewport while reducing software WebGL rasterization cost.
    deviceScaleFactor: 0.5,
    // CI only: keep a trace for failed tests so flaky failures can be diagnosed
    // from the uploaded artifact. Screenshots are skipped because capturing the
    // software-rendered WebGL canvas would add to the CPU cost this suite is
    // already limited by; DOM snapshots, actions, console and network remain.
    trace: process.env.CI
      ? { mode: 'retain-on-failure', screenshots: false }
      : 'off',
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

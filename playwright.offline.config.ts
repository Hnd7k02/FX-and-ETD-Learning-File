/**
 * End-to-end tests of the single offline file release/forward-first.html (DECISIONS D-13).
 *
 * The file is opened over file:// with the network blocked; any request that leaves the file
 * fails the test (tests/offline/fixtures.ts). Run `npm run build` first.
 *
 * Projects: Chromium 1440 × 900 (work PC, Chrome/Edge) and WebKit as iPad in portrait
 * (820 × 1180) and landscape (1180 × 820). Locally without WebKit:
 * `npm run e2e -- --project=chromium-1440`.
 */
import { defineConfig, devices } from '@playwright/test';

// Local sandbox: reuse the preinstalled Chromium when present.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const ipad = devices['iPad Pro 11'];

export default defineConfig({
  testDir: 'tests/offline',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    trace: 'retain-on-failure',
    offline: true,
  },
  projects: [
    {
      name: 'chromium-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: 'webkit-ipad-portrait',
      use: { ...ipad, browserName: 'webkit', viewport: { width: 820, height: 1180 } },
    },
    {
      name: 'webkit-ipad-landscape',
      use: { ...ipad, browserName: 'webkit', viewport: { width: 1180, height: 820 } },
    },
  ],
});

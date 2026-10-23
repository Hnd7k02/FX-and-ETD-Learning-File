import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '/home/user/FX-and-ETD-Learning-File/tests/e2e',
  testMatch: /m07\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  outputDir: '/tmp/claude-0/-home-user-FX-and-ETD-Learning-File/ad15a29d-3cf1-54d8-ab98-df4ff5f18675/scratchpad/m07/pw-results',
  use: {
    baseURL: 'http://localhost:4400',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  },
  projects: [
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});

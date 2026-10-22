import base from '/home/user/FX-and-ETD-Learning-File/playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testDir: '/home/user/FX-and-ETD-Learning-File/tests/e2e',
  testMatch: 'glossary-about.spec.ts',
  webServer: undefined,
  reporter: 'list',
  outputDir: '/tmp/claude-0/-home-user-FX-and-ETD-Learning-File/ad15a29d-3cf1-54d8-ab98-df4ff5f18675/scratchpad/pw-results',
  use: { ...base.use, baseURL: 'http://localhost:4400', launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } },
});

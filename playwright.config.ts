import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

// process.cwd() over __dirname: stays valid if package.json ever gains
// "type": "module".
loadEnv({ path: resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  // The artifacts directory can be moved, so two Playwright runs in the same
  // repository (a shared working tree) do not clean each other's traces.
  outputDir: process.env['PW_OUTPUT_DIR'] ?? 'test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Auto-start the dev server when it is not already up.
  // The backend on :8080 is NOT managed here — it must be running separately.
  webServer: process.env['E2E_NO_WEBSERVER']
    ? undefined
    : {
        command: 'npm start',
        url: BASE_URL,
        reuseExistingServer: !process.env['CI'],
        timeout: 180_000,
        stdout: 'ignore',
      },

  use: {
    baseURL: BASE_URL,
    channel: 'chromium',
    // ⚠ Traces capture `fill()` values in plaintext, i.e. real credentials.
    //   /test-results/ is gitignored. Never share trace.zip or screenshots
    //   from a run that used real accounts.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },

  projects: [{ name: 'chromium' }],
});
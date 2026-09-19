import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Read from default .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests/e2e',
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  // Single worker — avoids parallel DB seed collisions
  fullyParallel: false,
  workers: 1,
  // Reporter to use.
  reporter: 'html',

  // globalSetup/globalTeardown run outside the Next.js app process.
  // They use direct Prisma access to seed and clean up isolated test data.
  globalSetup: './tests/e2e/global-setup-wrapper.js',
  globalTeardown: './tests/e2e/global-teardown-wrapper.js',

  // Shared settings for all the projects below.
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3000',

    // Collect trace when retrying the failed test.
    trace: 'on-first-retry',
  },

  // Chromium only for standard testing speed
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests.
  // No E2E_TEST_MODE env var — the application runs in standard mode.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

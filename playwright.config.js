const { defineConfig, devices } = require('@playwright/test');
const { loadEnvFile } = require('node:process');

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./reporters/jira-reporter.js'],
    ['./reporters/testrail-reporter.js'],
  ],

  use: {
    baseURL:
      process.env.ORANGEHRM_BASE_URL ||
      'https://opensource-demo.orangehrmlive.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
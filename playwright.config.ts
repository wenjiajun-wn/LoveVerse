import { defineConfig, devices } from '@playwright/test';
const browserChannel = process.platform === 'win32' ? 'msedge' : undefined;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: browserChannel } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: browserChannel },
    },
  ],
  webServer: {
    env: {
      LOVEVERSE_MODE: 'demo',
      LOVEVERSE_AI_ENABLED: 'true',
      LOVEVERSE_AI_PUBLIC_DEMO: 'true',
      DEEPSEEK_API_KEY: '',
    },
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120000,
  },
});

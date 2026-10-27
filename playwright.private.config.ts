import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
process.env.LOVEVERSE_E2E_DIR ||= path.join(tmpdir(), `loveverse-e2e-${randomUUID()}`);
export default defineConfig({
  testDir: './tests/private-e2e',
  outputDir: 'test-results/private',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  globalSetup: './tests/helpers/private-setup.ts',
  globalTeardown: './tests/helpers/private-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'private-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'private-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3101',
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: false,
    env: {
      LOVEVERSE_MODE: 'private',
      LOVEVERSE_ORIGIN: 'http://127.0.0.1:3101',
      LOVEVERSE_DATA_DIR: process.env.LOVEVERSE_E2E_DIR,
      LOVEVERSE_AI_ENABLED: 'true',
      DEEPSEEK_API_KEY: '', // 浏览器用显式 Mock；绝不读取开发者真实密钥。
    },
    timeout: 120000,
  },
});

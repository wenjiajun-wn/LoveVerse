import { defineConfig } from '@playwright/test';
import base from './playwright.private.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!server) throw Error('私人视觉配置缺少测试服务');

export default defineConfig({
  ...base,
  testDir: './tests/visual',
  outputDir: '.visual-review/runner',
  projects: [
    { name: 'private-390', use: { viewport: { width: 390, height: 1000 }, deviceScaleFactor: 1 } },
    { name: 'private-1440', use: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 } },
  ],
  use: { ...base.use, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai', locale: 'zh-CN', trace: 'off' },
  webServer: { ...server, env: { ...server.env, LOVEVERSE_AI_ENABLED: 'false', LOVEVERSE_AI_PUBLIC_DEMO: 'false', DEEPSEEK_API_KEY: '' } },
});

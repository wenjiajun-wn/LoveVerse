// 固定公开演示环境；不访问开发者私人存储，不调用模型。
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('请指定 before 或 after');
const destination = path.resolve('.visual-review', phase);
await mkdir(destination, { recursive: true });
const origin = 'http://127.0.0.1:3115';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3115'], {
  env: { ...process.env, LOVEVERSE_MODE: 'demo', LOVEVERSE_AI_ENABLED: 'false', LOVEVERSE_AI_PUBLIC_DEMO: 'false', DEEPSEEK_API_KEY: '', LOVEVERSE_ORIGIN: origin },
  windowsHide: true,
  stdio: 'ignore',
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('截图服务启动失败，请检查端口');
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('截图服务未就绪');
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
  const results = [];
  for (const width of [390, 1440]) {
    for (const tab of ['home', 'universe', 'photos', 'timeline', 'dates', 'games', 'diary', 'agent', 'companion']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-10-30T04:00:00Z'));
      await page.addInitScript(() => {
        window.__visualMetrics = { lcp: 0, cls: 0 };
        new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__visualMetrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__visualMetrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/#${tab}`, { waitUntil: 'networkidle' });
      await page.locator(`nav a[href="#${tab}"][aria-current="page"]`).waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
        await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
      });
      await page.screenshot({ path: path.join(destination, `${width}-${tab}.png`), fullPage: true, animations: 'disabled' });
      const metrics = await page.evaluate(() => ({ ...window.__visualMetrics, overflow: document.documentElement.scrollWidth > innerWidth, resources: performance.getEntriesByType('resource').map((resource) => ({ type: resource.initiatorType, transfer: resource.transferSize, encoded: resource.encodedBodySize })).reduce((sum, item) => ({ transfer: sum.transfer + item.transfer, encoded: sum.encoded + item.encoded }), { transfer: 0, encoded: 0 }) }));
      results.push({ width, tab, ...metrics, errors });
      await context.close();
    }
  }
  await writeFile(path.join(destination, 'metrics.json'), JSON.stringify({ phase, date: '2026-10-30', browser: browser.version(), note: '公开演示、独立冷浏览器上下文、本机实验室单次测量；非真实用户 INP 或 GPU 数据。', results }, null, 2));
  console.log(`${phase}: ${results.length} 张截图完成；横向溢出 ${results.filter((item) => item.overflow).length}，页面错误 ${results.reduce((sum, item) => sum + item.errors.length, 0)}。`);
} finally {
  await browser?.close();
  server.kill();
}

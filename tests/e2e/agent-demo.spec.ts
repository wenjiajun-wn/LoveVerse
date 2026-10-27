import { test, expect } from '@playwright/test';
test('公开模式 AI 入口仅说明，不发送模型请求', async ({ page }) => {
  let requested = false;
  page.on('request', (request) => {
    if (request.url().includes('/api/agent/') && request.method() === 'POST') requested = true;
  });
  await page.route('**/api/agent/demo', (route) =>
    route.fulfill({ json: { ok: true, data: { available: false } } }),
  );
  await page.goto('/#agent');
  await expect(page.getByRole('heading', { name: '让回忆，轻轻回应你。' })).toBeVisible();
  await expect(
    page.getByText('公开演示不调用模型、不读取私人回忆。', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '发送问题' })).toHaveCount(0);
  expect(requested).toBe(false);
});

test('公开 AI 无需登录、同意后提问并打开公开来源（Mock）', async ({ page }) => {
  await page.route('**/api/agent/demo', (route) => {
    if (route.request().method() === 'GET') return route.continue();
    return route.fulfill({
      json: {
        ok: true,
        data: {
          facts: [{ text: '海边 · 蓝色海岸', sources: ['public-source'] }],
          inferences: [],
          unknowns: [],
          citations: [
            {
              id: 'public-source',
              memoryId: 'trip',
              title: '和你一起，去看海',
              date: '2024-08-17',
              place: '海边 · 蓝色海岸',
              paragraph: 1,
              excerpt: '海风把头发吹得乱七八糟，我们沿着海岸走了很远。',
              revision: 'demo',
              sourcePath: 'demo:trip#part-1',
            },
          ],
        },
      },
    });
  });
  await page.goto('/#agent');
  await expect(page.getByRole('heading', { name: '公开 AI 演示 · 无需账号' })).toBeVisible();
  await page.getByLabel('想问我们的回忆').fill('第一次旅行去了哪里？');
  await expect(page.getByRole('button', { name: '发送问题' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /我同意将本次问题发送至 DeepSeek/ }).check();
  await page.getByRole('button', { name: '发送问题' }).click();
  await expect(page.getByRole('heading', { name: '明确记录的事实 · 原文摘录' })).toBeVisible();
  await page.locator('.agent-sources').getByRole('button').click();
  await expect(page.getByRole('dialog')).toContainText('AI 引用 · 片段 1');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-agent-demo.png`,
    fullPage: true,
  });
});

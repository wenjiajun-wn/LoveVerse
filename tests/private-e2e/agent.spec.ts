import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:3101';
const password = 'fixture-password-only-1234';
test('AI 双方逐条同意、问答来源、重试、清除导出和撤销（模型响应为 Mock）', async ({
  page,
  playwright,
}) => {
  await page.goto('/');
  await page.getByLabel('邮箱').fill('first@example.test');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录私人空间' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  const created = await page.request.post('/api/memories', {
    headers: { Origin: origin },
    data: {
      title: 'AI 测试的山顶',
      date: '2024-02-29',
      category: '旅行',
      place: '青山',
      tags: ['山'],
      story: '我们在青山看日出。',
      photos: [],
      color: 'blue',
      visibility: 'private',
    },
  });
  expect(created.ok()).toBe(true);
  const record = (await created.json()).data;
  await page.reload();
  await page.getByRole('link', { name: 'AI 回忆助手', exact: true }).click();
  await expect(page.getByRole('heading', { name: '让回忆，轻轻回应你。' })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送问题', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /AI 测试的山顶/ }).check();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '同意并保存我的选择' }).click();
  await expect(page.getByText('云端 AI 与回忆授权（1/2 人同意）')).toBeVisible();
  const partner = await playwright.request.newContext({ baseURL: origin });
  try {
    expect(
      (
        await partner.post('/api/auth/login', {
          headers: { Origin: origin },
          data: { email: 'second@example.test', password },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await partner.put('/api/agent/consent', {
          headers: { Origin: origin },
          data: {
            enabled: true,
            confirmed: true,
            selected: [{ id: record.id, revision: record.revision }],
          },
        })
      ).ok(),
    ).toBe(true);
    await page.getByRole('button', { name: '刷新双方授权状态' }).click();
    await expect(page.getByText('双方已同意 · 1 条当前版本回忆可用于问答')).toBeVisible();
    let attempts = 0;
    await page.route('**/api/agent/chat', async (route) => {
      attempts++;
      if (attempts === 1)
        return route.fulfill({
          status: 503,
          json: { ok: false, error: { code: 'AI_TIMEOUT', message: '模拟超时，请重试' } },
        });
      return route.fulfill({
        json: {
          ok: true,
          data: {
            facts: [{ text: record.story, sources: ['source-1'] }],
            inferences: [],
            unknowns: [],
            citations: [
              {
                id: 'source-1',
                memoryId: record.id,
                title: record.title,
                date: record.date,
                place: record.place,
                paragraph: 1,
                excerpt: record.story,
                revision: record.revision,
                sourcePath: `memory:${record.id}#part-1`,
              },
            ],
          },
        },
      });
    });
    await page.getByLabel('想问我们的回忆').fill('第一次爬山？');
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: '模拟超时' })).toBeVisible();
    await page.getByRole('button', { name: '重试发送' }).click();
    await expect(page.getByRole('heading', { name: '明确记录的事实 · 原文摘录' })).toBeVisible();
    await page.locator('.agent-sources').getByRole('button').click();
    await expect(page.getByRole('dialog')).toContainText('AI 引用 · 片段 1');
    await expect(page.getByRole('dialog')).toContainText('我们在青山看日出。');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.locator('.agent-sources').getByRole('button')).toBeFocused();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出聊天' }).click();
    expect((await downloaded).suggestedFilename()).toContain('LoveVerse');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/private/${test.info().project.name}-agent.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: '清除聊天' }).click();
    await expect(page.getByRole('heading', { name: '明确记录的事实 · 原文摘录' })).toHaveCount(0);
    await page.locator('summary').click();
    await page.getByRole('button', { name: '撤销我的同意并关闭 AI' }).click();
    await expect(page.getByText('等待双方同意；尚未向模型发送任何回忆。')).toBeVisible();
  } finally {
    await partner.put('/api/agent/consent', {
      headers: { Origin: origin },
      data: { enabled: false, confirmed: true, selected: [] },
    });
    await partner.dispose();
    await page.request.delete(`/api/memories/${record.id}`, {
      headers: { Origin: origin },
      data: { revision: record.revision, confirmed: true },
    });
  }
});

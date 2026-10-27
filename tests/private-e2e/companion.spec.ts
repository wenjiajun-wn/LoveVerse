import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
const origin = 'http://127.0.0.1:3101';
const createdMemories: string[] = [];
test.afterEach(async ({ page }) => {
  // 只清理本测试创建的虚构来源，避免污染 V2 对固定七颗星球的断言。
  for (const id of createdMemories.splice(0)) {
    const response = await page.request.get('/api/memories/' + id);
    if (response.ok()) {
      const record = (await response.json()).data;
      await page.request.delete('/api/memories/' + id, {
        headers: { Origin: origin },
        data: { revision: record.revision, confirmed: true },
      });
    }
  }
});
async function enter(page: Page) {
  await page.goto('/');
  await page.getByLabel('邮箱').fill('first@example.test');
  await page.getByLabel('密码', { exact: true }).fill('fixture-password-only-1234');
  await page.getByRole('button', { name: '登录私人空间' }).click();
  await expect(page.locator('.site-header')).toBeVisible();
}
async function createMemory(page: Page, title: string, photos: unknown[] = []) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const r = await page.request.post('/api/memories', {
    headers: { Origin: origin },
    data: {
      title,
      date: `2024-${date.slice(5)}`,
      category: '旅行',
      place: '虚构海边',
      tags: ['测试'],
      story: '这是一段虚构的海边回忆。',
      photos,
      color: 'blue',
      visibility: 'private',
    },
  });
  expect(r.ok()).toBe(true);
  const record = (await r.json()).data;
  createdMemories.push(record.id);
  return record;
}
test('回忆录筛选、章节编辑、主题预览和受保护 PDF（真实渲染）', async ({ page }, info) => {
  test.setTimeout(90000);
  await enter(page);
  const title = 'V4书-' + info.project.name + '-' + randomUUID().slice(0, 6);
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ad7bb5' } })
    .png()
    .toBuffer();
  const uploaded = await page.request.post('/api/uploads', {
    headers: { Origin: origin, 'Content-Type': 'image/png' },
    data: png,
  });
  expect(uploaded.ok()).toBe(true);
  const photo = (await uploaded.json()).data;
  await createMemory(page, title, [{ id: photo.id, alt: '虚构粉色图' }]);
  await page.reload();
  await page.getByRole('link', { name: 'Love Companion', exact: true }).click();
  await page.getByLabel('回忆录名称').fill(title);
  await page.getByLabel('筛选标签').fill('测试');
  await page.getByRole('checkbox', { name: new RegExp(title) }).check();
  await page.getByRole('button', { name: '生成回忆录', exact: true }).click();
  const card = page.locator('.v4-item').filter({ hasText: title });
  await card.getByRole('button', { name: '打开草稿' }).click();
  const dialog = page.getByRole('dialog', { name: '编辑回忆录' });
  await dialog.getByLabel('章节正文').fill('作者编辑的虚构测试文字。');
  await dialog
    .getByLabel('排版主题')
    .selectOption(info.project.name.includes('mobile') ? 'starlight' : 'paper');
  await dialog.getByRole('button', { name: '预览纪念册' }).click();
  await expect(dialog.getByText('作者编辑的虚构测试文字。')).toBeVisible();
  await page.screenshot({ path: info.outputPath('companion-book-preview.png'), fullPage: true });
  await expect(dialog.getByRole('button', { name: '导出完整 PDF' })).toBeDisabled();
  await dialog.getByRole('button', { name: '保存回忆录' }).click();
  await expect(dialog).not.toBeVisible();
  await card.getByRole('button', { name: '打开草稿' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整 PDF' }).click();
  const file = await download;
  await file.saveAs(info.outputPath('fixture-memory-book.pdf'));
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await file.failure()).toBe(null);
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const pdf = Buffer.concat(chunks);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(10000);
  await page.keyboard.press('Escape');
  await expect(card.getByRole('button', { name: '打开草稿' })).toBeFocused();
});
test('秘密计划、锁定胶囊、往年今日和双人游戏', async ({ page }, info) => {
  await enter(page);
  const title = 'V4回忆-' + info.project.name + '-' + randomUUID().slice(0, 6);
  await createMemory(page, title);
  await page.reload();
  await page.getByRole('link', { name: 'Love Companion', exact: true }).click();
  await page.getByRole('button', { name: '惊喜策划', exact: true }).click();
  await page.getByLabel('方案标题').fill(title + '秘密');
  await page.getByLabel('希望的惊喜').fill('安静地散步');
  await page.getByRole('button', { name: '生成私人惊喜方案' }).click();
  await expect(page.getByText(title + '秘密', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '时光胶囊', exact: true }).click();
  await page.getByLabel('胶囊名称').fill(title + '胶囊');
  await page.getByLabel('解锁日期').fill('2099-01-01');
  await page.getByLabel('未来才能读的信').fill('未来才可以看到的虚构正文');
  await page.getByRole('button', { name: '封存时光胶囊' }).click();
  await expect(page.getByText(title + '胶囊', { exact: true })).toBeVisible();
  const dashboard = (await (await page.request.get('/api/v4')).json()).data;
  expect(JSON.stringify(dashboard)).not.toContain('未来才可以看到的虚构正文');
  await page.getByRole('button', { name: '往年今日', exact: true }).click();
  await page
    .locator('.v4-item')
    .filter({ hasText: title })
    .getByRole('button', { name: '查看原始回忆' })
    .click();
  await expect(page.getByRole('dialog', { name: title })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '回忆猜谜', exact: true }).click();
  for (let i = 0; i < 6; i++) {
    if (await page.getByRole('button', { name: '成员 2 开始' }).isVisible()) break;
    await page.locator('.v4-answer-grid button').first().click();
  }
  await page.getByRole('button', { name: '成员 2 开始' }).click();
  for (let i = 0; i < 6; i++) {
    if (await page.getByRole('heading', { name: '挑战完成' }).isVisible()) break;
    await page.locator('.v4-answer-grid button').first().click();
  }
  await expect(page.getByRole('heading', { name: '挑战完成' })).toBeVisible();
  await page.getByRole('button', { name: '重新挑战' }).click();
  await expect(page.getByText(/成员 1 · 第 1/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name.includes('mobile')) await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('companion-quiz.png'), fullPage: true });
});

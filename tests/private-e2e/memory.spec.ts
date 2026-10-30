import { test, expect, type Page } from '@playwright/test';
const password = 'fixture-password-only-1234';
const origin = 'http://127.0.0.1:3101';
async function login(page: Page, email = 'first@example.test') {
  await page.goto('/');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录私人空间' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
}
async function openDiary(page: Page) {
  await page.getByRole('link', { name: '恋爱日记', exact: true }).click();
  await expect(page.getByRole('button', { name: '新建回忆' })).toBeVisible();
}
test('未登录时私人页面无正文，所有接口和照片拒绝访问', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '登录私人空间' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  for (const url of [
    '/api/auth/session',
    '/api/memories',
    '/api/anniversaries',
    '/api/uploads',
    '/api/uploads/00000000-0000-4000-8000-000000000000',
  ]) {
    const response = await request.get(url);
    expect(response.status()).toBe(401);
  }
  expect((await request.get('/private/auth/users.json')).status()).toBe(404);
});
test('日记 CRUD、图片上传、搜索、详情与删除确认', async ({ page }) => {
  await login(page);
  await openDiary(page);
  await page.getByRole('button', { name: '新建回忆' }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('标题', { exact: true }).fill('浏览器测试的海风');
  await editor.getByLabel('回忆日期').fill('2026-05-20');
  await editor.getByLabel('地点', { exact: true }).fill('青岛');
  await editor.getByLabel('标签（逗号分隔）').fill('旅行, 心动');
  await editor.getByLabel('Markdown 正文').fill('# 海风\n\n我们一起**散步**。');
  await expect(editor.getByRole('region', { name: 'Markdown 实时预览' })).toContainText('散步');
  await editor.getByLabel('上传照片').setInputFiles('public/demo/cafe.jpg');
  await expect(editor.getByRole('button', { name: '从回忆移除照片' })).toBeVisible();
  await editor.screenshot({ path: `test-results/private/${test.info().project.name}-editor.png` });
  await editor.getByRole('button', { name: '保存回忆' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '浏览器测试的海风' })).toBeVisible();
  await page.screenshot({
    path: `test-results/private/${test.info().project.name}-diary.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const name of ['照片墙', '时间轴']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: '浏览器测试的海风' })).toBeVisible();
  }
  await page.getByRole('link', { name: '恋爱宇宙', exact: true }).click();
  await expect(page.getByRole('button', { name: /探索.*浏览器测试的海风/ })).toBeVisible();
  await openDiary(page);

  await page.getByLabel('搜索回忆').fill('海风');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('mark').first()).toHaveText('海风');
  await page.getByRole('button', { name: /2026-05-20.*浏览器测试的海风/ }).click();
  await expect(page.getByRole('dialog')).toContainText('散步');
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '编辑回忆', exact: true }).click();
  await expect(page.getByLabel('Markdown 正文')).toHaveValue('# 海风\n\n我们一起**散步**。');
  await page.getByLabel('标题', { exact: true }).fill('已编辑的海风');
  await page.getByRole('button', { name: '保存回忆' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const name of ['照片墙', '时间轴']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: '已编辑的海风' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '浏览器测试的海风' })).toHaveCount(0);
  }
  await openDiary(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '删除回忆', exact: true }).click();
  await expect(page.getByRole('heading', { name: '已编辑的海风' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除回忆', exact: true }).click();
  await expect(page.getByRole('heading', { name: '已编辑的海风' })).toHaveCount(0);
  for (const name of ['照片墙', '时间轴']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: '已编辑的海风' })).toHaveCount(0);
  }
});
test('七段真实回忆星图分页且旧页面动态显示', async ({ page, request }) => {
  await login(page);
  const records = [];
  for (let i = 0; i < 7; i++) {
    const response = await page.request.post('/api/memories', {
      headers: { Origin: origin },
      data: {
        title: `分页回忆 ${i}`,
        date: '2026-05-20',
        category: '旅行',
        place: '山间',
        tags: [],
        story: '分页测试正文',
        photos: [],
        color: 'blue',
        visibility: 'private',
      },
    });
    expect(response.status()).toBe(201);
    records.push((await response.json()).data);
  }
  const publicHtml = await (await request.get('/')).text();
  expect(publicHtml).not.toContain('分页测试正文');
  expect((await request.get('/api/memories')).status()).toBe(401);
  await page.reload();
  await page.getByRole('button', { name: '进入我们的宇宙' }).click();
  await expect(page.getByRole('button', { name: /^探索旅行：分页回忆/ })).toHaveCount(6);
  await page.getByRole('button', { name: '下一组' }).click();
  await expect(page.getByRole('button', { name: /^探索旅行：分页回忆/ })).toHaveCount(1);
  await page.getByRole('link', { name: '照片墙', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^分页回忆/ })).toHaveCount(7);
  await page.getByRole('link', { name: '时间轴', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^分页回忆/ })).toHaveCount(7);
  for (const r of records)
    await page.request.delete(`/api/memories/${r.id}`, {
      headers: { Origin: origin },
      data: { revision: r.revision, confirmed: true },
    });
});
test('纪念日经确认导入后跨独立会话同步且保留 localStorage', async ({ page, browser }) => {
  const mobile = test.info().project.name.includes('mobile');
  await login(page, mobile ? 'second@example.test' : 'first@example.test');
  const title = `同步纪念日-${test.info().project.name}`;
  const legacy = [{ id: crypto.randomUUID(), title, date: '2027-05-20', yearly: true }];
  await page.evaluate(
    (value) => localStorage.setItem('loveverse.anniversaries.v1', JSON.stringify(value)),
    legacy,
  );
  await page.getByRole('link', { name: '纪念日', exact: true }).click();
  const importButton = page.getByRole('button', { name: '确认导入旧版纪念日' });
  // 两个设备项目使用不同账号，分别验证一次性导入。
  await expect(importButton).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await importButton.click();
  await expect(page.getByRole('status')).toContainText('导入成功');
  expect(await page.evaluate(() => localStorage.getItem('loveverse.anniversaries.v1'))).toBe(
    JSON.stringify(legacy),
  );
  const other = await browser.newContext();
  const second = await other.newPage();
  await login(second, mobile ? 'first@example.test' : 'second@example.test');
  await second.getByRole('link', { name: '纪念日', exact: true }).click();
  await expect(second.getByRole('heading', { name: title })).toBeVisible();
  await other.close();
});
test('退出登录后旧 cookie 无法访问私人照片或日记', async ({ page }) => {
  await login(page);
  const previous = (await page.context().cookies()).find((c) => c.name === 'loveverse_session')!;
  await openDiary(page);
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('button', { name: '登录私人空间' })).toBeVisible();
  const response = await page.request.get('/api/memories', {
    headers: { Cookie: `${previous.name}=${previous.value}` },
  });
  expect(response.status()).toBe(401);
});

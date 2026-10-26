import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 13, 25)');
});
test('星球弹窗可以键盘关闭并恢复焦点', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '进入我们的宇宙' }).click();
  const planet = page.getByRole('button', { name: '探索第一次相遇：故事开始的地方' });
  await planet.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('那天下了一点小雨');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(planet).toBeFocused();
  expect(errors).toEqual([]);
});
test('相册筛选与照片放大', async ({ page }) => {
  await page.goto('/#photos');
  await page.getByRole('button', { name: '第一次旅行', exact: true }).click();
  await page.getByRole('button', { name: /和你一起，去看海/ }).click();
  await expect(page.getByRole('dialog')).toContainText('海风把头发');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('button', { name: /把日落分给你一半/ })).toHaveCount(0);
});
test('自定义纪念日保存、刷新与删除', async ({ page }) => {
  await page.goto('/#dates');
  await page.getByLabel('纪念日名称').fill('我们的测试旅行');
  await page.getByLabel('日期', { exact: true }).fill('2027-06-18');
  await page.getByRole('button', { name: /保存纪念日/ }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '我们的测试旅行' })).toBeVisible();
  await page.getByRole('button', { name: '删除我们的测试旅行' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '我们的测试旅行' })).toHaveCount(0);
});
test('两位玩家回答后计算真实默契', async ({ page }) => {
  await page.goto('/#games');
  await page.getByRole('button', { name: /默契实验室/ }).click();
  for (const option of ['去海边看日落', '一个拥抱', '相机'])
    await page.getByRole('button', { name: new RegExp(option) }).click();
  await expect(page.getByRole('heading', { name: '现在，把屏幕交给 TA。' })).toBeVisible();
  await page.getByRole('button', { name: '我准备好了' }).click();
  for (const option of ['去海边看日落', '一个拥抱', '相机'])
    await page.getByRole('button', { name: new RegExp(option) }).click();
  await expect(page.getByRole('heading', { name: '默契值 100%' })).toBeVisible();
});
test('回忆问答计分与盲盒重新抽取', async ({ page }) => {
  await page.goto('/#games');
  await page.getByRole('button', { name: /回忆放映室/ }).click();
  for (const option of ['街角咖啡馆', '海边', '5 月 20 日'])
    await page.getByRole('button', { name: new RegExp(option) }).click();
  await expect(page.getByRole('heading', { name: '回忆命中 3 / 3' })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: /心动盲盒/ }).click();
  await page.getByRole('button', { name: '拆开盲盒' }).click();
  await expect(page.getByRole('heading', { name: '今天的小小约定' })).toBeVisible();
  const first = await page.locator('[aria-live="polite"]').textContent();
  await page.getByRole('button', { name: '再抽一个' }).click();
  await expect(page.locator('[aria-live="polite"]')).not.toHaveText(first!);
});
test('所有页面在窄屏中无横向溢出', async ({ page }) => {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ['home', 'universe', 'photos', 'timeline', 'dates', 'games']) {
      await page.goto('/#' + tab);
      await expect(page.getByRole('navigation')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});
test('保存桌面和手机页面供视觉检查', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '进入我们的宇宙' })).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-home.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/#photos');
  await expect(page.getByRole('heading', { name: '把心动，定格在这里。' })).toBeVisible();
  for (const photo of await page.getByRole('main').getByRole('img').all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toHaveJSProperty('complete', true);
    await expect
      .poll(() => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  }
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-photos.png`,
    fullPage: true,
    animations: 'disabled',
  });
});

import { test, expect } from '@playwright/test';
test('私人首页和纪念日不回退演示身份、日期或照片', async ({ page, request }) => {
  expect((await request.get('/api/auth/session')).status()).toBe(401);
  await page.goto('/');
  await page.getByLabel('邮箱').fill('first@example.test');
  await page.getByLabel('密码', { exact: true }).fill('fixture-password-only-1234');
  await page.getByRole('button', { name: '登录私人空间' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByText('请设置情侣称呼')).toBeVisible();
  await expect(page.getByText('尚未设置相恋日期，请在服务器配置后重启。')).toBeVisible();
  expect(await page.locator('img[src^="/demo/"]').count()).toBe(0);
  await expect(page.locator('body')).not.toContainText('小宇 & 星星');
  await page.getByRole('link', { name: '纪念日', exact: true }).click();
  await expect(page.getByText('尚未设置相恋日期，请在服务器配置后重启。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '我们的恋爱纪念日', exact: true })).toHaveCount(0);
});

import { test, expect } from '@playwright/test';
test('公开 Companion 不加载私人状态与 API', async ({ page }) => {
  let reads = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/v4') reads++;
  });
  await page.goto('/#companion');
  await expect(
    page.getByRole('heading', { name: 'Love Companion · 只属于你们的下一章' }),
  ).toBeVisible();
  expect(reads).toBe(0);
  expect((await page.request.get('/api/v4')).status()).toBe(403);
  const skip=page.locator('.skip-link');
  await expect(skip).toHaveCSS('clip-path','inset(50%)');
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS('clip-path','none');
});

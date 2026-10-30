import { test, expect } from '@playwright/test';

for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
  test(`前端可读性与九入口导航 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#companion');
    await expect(page.getByRole('link', { name: 'Love Companion', exact: true })).toHaveAttribute('aria-current', 'page');
    const nav = page.getByRole('navigation', { name: '主导航' });
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(9);
    for (const link of await links.all()) {
      await link.focus();
      await expect(link).toBeFocused();
      await expect.poll(() => link.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const parent = element.parentElement!.getBoundingClientRect();
        return box.left >= parent.left - 1 && box.right <= parent.right + 1 && box.height >= 44 && parseFloat(getComputedStyle(element).fontSize) >= 12;
      })).toBe(true);
      await link.press('Enter');
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.v4-page')).toHaveCSS('align-content', 'start');
    await page.screenshot({ path: `test-results/frontend-after/${test.info().project.name}-${width}-companion.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('相册完整保留高竖图比例，时间轴正文可读', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/demo/cafe.jpg', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="800"><rect width="200" height="800" fill="#807090"/></svg>',
  }));
  await page.goto('/#photos');
  const photo = page.locator('.photo-card img').first();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => {
    const rect = img.getBoundingClientRect();
    return img.complete && Math.abs(rect.height / rect.width - 4) < 0.02;
  })).toBe(true);
  await page.getByRole('link', { name: '时间轴', exact: true }).click();
  await expect(page.locator('.timeline-item .photo-caption p').first()).toHaveCSS('font-size', '15px');
});



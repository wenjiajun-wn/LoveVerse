import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test('虚构账号的私人空态视觉对照', async ({ page }, info) => {
  const phase = process.env.LOVEVERSE_VISUAL_PHASE || 'before';
  if (!['before', 'after'].includes(phase)) throw Error('无效截图阶段');
  const destination = path.resolve('.visual-review', phase);
  await mkdir(destination, { recursive: true });
  await page.clock.setFixedTime(new Date('2026-10-30T04:00:00Z'));
  await page.goto('/');
  await page.getByLabel('邮箱').fill('first@example.test');
  await page.getByLabel('密码', { exact: true }).fill('fixture-password-only-1234');
  await page.getByRole('button', { name: '登录私人空间' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  for (const tab of ['diary', 'agent', 'companion']) {
    await page.locator(`nav a[href="#${tab}"]`).click();
    await expect(page.locator(`nav a[href="#${tab}"]`)).toHaveAttribute('aria-current', 'page');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
    });
    expect(await page.locator('img[src^="/demo/"]').count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(destination, `${info.project.name}-${tab}.png`), fullPage: true, animations: 'disabled' });
  }
});

import { test, expect } from '@playwright/test';

test('桌面全局容器居中、导航不挤压，宽屏各页面布局完整', async ({ page }) => {
  for (const width of [768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tab of ['home', 'photos', 'timeline', 'dates', 'games', 'diary', 'agent']) {
      await page.goto('/#' + tab);
      await expect(page.getByRole('navigation')).toBeVisible();
      if (tab === 'agent') await expect(page.locator('.agent-page')).toBeVisible();
      else if (tab === 'home') await expect(page.locator('.hero')).toBeVisible();
      else await expect(page.locator('.page-section')).toBeVisible();
      const layout = await page.evaluate(() => {
        const bounds = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect();
        const header = bounds('.site-header');
        const footer = bounds('footer');
        const content = bounds('main > .page-section, main > .hero');
        const nav = bounds('.site-header nav');
        const brand = bounds('.brand');
        const links = [...document.querySelectorAll('.site-header nav a')].map((a) =>
          a.getBoundingClientRect(),
        );
        return {
          centered: [header, footer, content].every(
            (r) => Math.abs(r.left + r.width / 2 - innerWidth / 2) < 1,
          ),
          noOverflow: document.documentElement.scrollWidth <= innerWidth,
          linksFit: links.every((r) => r.left >= nav.left - 1 && r.right <= nav.right + 1),
          brandClear: nav.top >= brand.bottom - 1 || nav.left >= brand.right - 1,
        };
      });
      expect(layout, `${width}px / ${tab}`).toEqual({
        centered: true,
        noOverflow: true,
        linksFit: true,
        brandClear: true,
      });
    }
    if ([1024, 1920, 2560].includes(width)) {
      await page.screenshot({
        path: `test-results/layout-${test.info().project.name}-${width}-agent.png`,
        fullPage: true,
      });
    }
  }
});

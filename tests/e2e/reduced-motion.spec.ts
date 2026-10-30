import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

test('减少动态效果不下载 Three.js，普通模式仍按需加载', async ({ page }) => {
  const directory = path.resolve('.next/static/chunks');
  const threeChunks = readdirSync(directory).filter(
    (name) =>
      name.endsWith('.js') &&
      readFileSync(path.join(directory, name), 'utf8').includes('THREE.WebGLRenderer'),
  );
  expect(threeChunks.length).toBeGreaterThan(0);
  const requested = new Set<string>();
  page.on('request', (request) => {
    const name = new URL(request.url()).pathname.split('/').pop()!;
    if (threeChunks.includes(name)) requested.add(name);
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(requested.size).toBe(0);
  await expect(page.locator('.starfield canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await expect.poll(() => requested.size).toBeGreaterThan(0);
});

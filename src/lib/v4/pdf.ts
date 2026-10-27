import 'server-only';
import { chromium, type Browser } from 'playwright-core';
import sharp from 'sharp';
import { authorize, type IdentityContext } from '../auth/session';
import { getPhoto } from '../memory/uploads';
import { unwrap } from '../agent/consent';
import { AppError } from '../memory/errors';
import { loadV4, owned, ownerOf, sameRevision } from './store';
import type { V4Book } from './model';
import { uuid } from '../memory/model';

export const escapeHTML = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function bookHTML(book: V4Book, images: Map<string, string>) {
  const e = escapeHTML;
  const photo = (p: { id: string; alt: string }) =>
    images.has(p.id)
      ? `<figure><img src="${images.get(p.id)}"/><figcaption>${e(p.alt)}</figcaption></figure>`
      : '';
  const dark = book.theme === 'starlight';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${e(book.title)}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
  @page{size:A4;margin:20mm 18mm 24mm}*{box-sizing:border-box}body{font-family:'Noto Serif CJK SC','Microsoft YaHei',sans-serif;color:#282139;font-size:12pt;line-height:1.85}h1{font-size:32pt;line-height:1.4}h2{font-size:23pt}section{break-before:page}h2,figcaption{break-after:avoid}.cover{min-height:235mm;padding:22mm 12mm;background:${dark ? '#141a35' : '#f7eee1'};color:${dark ? '#f4e9ff' : '#593e39'};border:1px solid #b796ad;text-align:center}.kicker{letter-spacing:4px;font-size:10pt}.text{white-space:pre-wrap;overflow-wrap:anywhere}figure{margin:8mm 0;break-inside:avoid}img{max-width:100%;max-height:140mm;object-fit:contain}figcaption,.source{font-size:9pt;color:#756580;overflow-wrap:anywhere}.cover img{max-height:100mm}.source{margin-top:8mm;border-top:1px solid #ddd;padding-top:4mm}</style></head><body>
  <div class="cover"><p class="kicker">LOVEVERSE · OUR MEMORY BOOK</p><h1>${e(book.title)}</h1><p>${book.sources
    .map((s) => s.date)
    .sort()
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .map(e)
    .join(' — ')}</p>${book.photos[0] ? photo(book.photos[0]) : ''}<p>每一页，都是我们。</p></div>
  ${book.chapters.length ? book.chapters.map((c, i) => `<section><p class="kicker">CHAPTER ${i + 1}</p><h2>${e(c.title)}</h2><p>${e(c.date)} · ${e(c.place)}</p><div class="text">${e(c.content)}</div>${c.photos.map(photo).join('')}<p class="source">来源 Memory ID：${e(c.memoryId)}<br>原始版本：${e(book.sources.find((s) => s.id === c.memoryId)?.revision ?? '')}<br>章节文字可由作者编辑，请以原始记忆核实。</p></section>`).join('') : `<section><div class="text">${e(book.content)}</div>${book.photos.map(photo).join('')}</section>`}
  </body></html>`;
}
let rendering = false;
export async function exportBookPDF(ctx: IdentityContext, id: string, revision: string) {
  await authorize(ctx);
  uuid.parse(id);
  uuid.parse(revision);
  if (rendering) throw new AppError('BUSY', '正在排版另一份回忆录，请稍后重试', 503);
  rendering = true;
  let browser: Browser | undefined;
  try {
    const book = owned((await loadV4()).books, id, ownerOf(ctx));
    sameRevision(book, revision);
    const images = new Map<string, string>();
    for (const p of book.photos) {
      const bytes = unwrap(await getPhoto(ctx, p.id));
      const jpg = await sharp(bytes)
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();
      images.set(p.id, 'data:image/jpeg;base64,' + jpg.toString('base64'));
    }
    browser = await chromium.launch({
      headless: true,
      timeout: 15000,
      ...(process.env.LOVEVERSE_PDF_BROWSER
        ? { executablePath: process.env.LOVEVERSE_PDF_BROWSER }
        : process.platform === 'win32'
          ? { channel: 'msedge' }
          : { executablePath: '/usr/bin/chromium' }),
    });
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(bookHTML(book, images), { waitUntil: 'load', timeout: 15000 });
    const timeout = setTimeout(() => {
      void browser?.close();
    }, 20000);
    let bytes: Buffer;
    try {
      bytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="width:100%;text-align:center;font-size:9px;color:#807080">LoveVerse · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      });
    } finally {
      clearTimeout(timeout);
    }
    await authorize(ctx);
    sameRevision(owned((await loadV4()).books, id, ownerOf(ctx)), revision);
    return bytes;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      'PDF',
      'PDF 导出失败，请确认服务器已安装 Chromium 和中文字体，草稿已保留',
      503,
    );
  } finally {
    await browser?.close();
    rendering = false;
  }
}

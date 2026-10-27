import 'server-only';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { uuid } from './model';
import { atomicWrite, listFiles, readFile, removeFile, withLock } from './storage';
import { AppError } from './errors';
import { controlled } from './service';
import type { IdentityContext } from '../auth/session';
import { MemoryRepository } from './repository';
export const MAX_UPLOAD = 8 * 1024 * 1024;
export function uploadPhoto(ctx: IdentityContext, bytes: Buffer, mime: string) {
  return controlled(ctx, async () => {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(mime) ||
      bytes.length > MAX_UPLOAD ||
      !bytes.length
    )
      throw new AppError('UPLOAD', '仅支持不超过 8MB 的 JPEG、PNG 或 WebP 图片', 413);
    let output: Buffer;
    try {
      const image = sharp(bytes, { limitInputPixels: 16000000, animated: false });
      const meta = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format || '') || (meta.pages || 1) > 1)
        throw Error();
      output = await image
        .rotate()
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new AppError('UPLOAD', '图片无法解码，或超过 1600 万像素限制');
    }
    if (output.length > MAX_UPLOAD) throw new AppError('UPLOAD', '图片处理后仍然过大', 413);
    return withLock(async () => {
      if ((await listFiles('uploads')).length >= 2000)
        throw new AppError('LIMIT', '照片数量达到 2000 张上限', 413);
      const id = randomUUID();
      await atomicWrite('uploads', `${id}.webp`, output);
      return { id, alt: '回忆照片', url: `/api/uploads/${id}` };
    });
  });
}
export function getPhoto(ctx: IdentityContext, id: string) {
  return controlled(ctx, async () => {
    uuid.parse(id);
    const file = await readFile('uploads', `${id}.webp`, MAX_UPLOAD);
    if (!file) throw new AppError('NOT_FOUND', '照片不存在', 404);
    return file;
  });
}
export function listPhotos(ctx: IdentityContext) {
  return controlled(ctx, async () =>
    (await listFiles('uploads'))
      .filter((n) => /^[a-f0-9-]{36}\.webp$/.test(n))
      .map((n) => ({ id: n.slice(0, -5), url: `/api/uploads/${n.slice(0, -5)}` })),
  );
}
export function deletePhoto(ctx: IdentityContext, id: string, confirmed: boolean) {
  return controlled(ctx, async () => {
    uuid.parse(id);
    if (confirmed !== true) throw new AppError('CONFIRM', '删除照片需要确认');
    return withLock(async () => {
      const records = await new MemoryRepository().list();
      if (records.some((m) => m.photos.some((p) => p.id === id)))
        throw new AppError('CONFLICT', '这张照片仍被回忆引用，请先从回忆中移除', 409);
      await removeFile('uploads', `${id}.webp`, true);
      return { id };
    });
  });
}

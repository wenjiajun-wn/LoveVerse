import 'server-only';
import { createHash } from 'node:crypto';
import { readFile, atomicWrite, withLock } from '../memory/storage';
import { AppError } from '../memory/errors';
import { v4StateSchema, type V4State } from './model';
import type { IdentityContext } from '../auth/session';
export const ownerOf = (ctx: IdentityContext) =>
  createHash('sha256').update(ctx.userId.toLowerCase()).digest('hex');
export async function loadV4(): Promise<V4State> {
  const file = await readFile('state', 'loveverse-v4.json', 8 * 1024 * 1024);
  if (!file)
    return { books: [], plans: [], capsules: [], reminders: {}, notifications: [], lastRun: null };
  try {
    return v4StateSchema.parse(JSON.parse(file.toString()));
  } catch {
    throw new AppError('CORRUPT', 'V4 私人数据损坏，请从备份恢复', 422);
  }
}
export function mutateV4<T>(work: (state: V4State) => T | Promise<T>) {
  return withLock(async () => {
    const state = await loadV4();
    const result = await work(state);
    const json = JSON.stringify(v4StateSchema.parse(state));
    if (Buffer.byteLength(json) > 8 * 1024 * 1024)
      throw new AppError('LIMIT', 'V4 草稿总容量已达上限，请先导出并删除旧草稿', 413);
    await atomicWrite('state', 'loveverse-v4.json', json, true);
    return result;
  });
}
export function owned<T extends { id: string; owner: string }>(
  items: T[],
  id: string,
  owner: string,
) {
  const item = items.find((x) => x.id === id && x.owner === owner);
  if (!item) throw new AppError('NOT_FOUND', '记录不存在或你无权访问', 404);
  return item;
}
export function sameRevision(item: { revision: string }, revision: string) {
  if (item.revision !== revision) throw new AppError('CONFLICT', '内容已被更新，请刷新后重试', 409);
}

import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { IdentityContext } from '../auth/session';
import {
  anniversarySchema,
  anniversaryStateSchema,
  type Anniversary,
  type AnniversaryState,
} from './model';
import { controlled } from './service';
import { atomicWrite, readFile, withLock } from './storage';
import { AppError } from './errors';
const emptyRevision = '00000000-0000-4000-8000-000000000000';
async function readState(): Promise<AnniversaryState> {
  const file = await readFile('state', 'anniversaries.json');
  if (!file) return { items: [], imports: [], revision: emptyRevision };
  try {
    return anniversaryStateSchema.parse(JSON.parse(file.toString()));
  } catch {
    throw new AppError('CORRUPT', '纪念日文件损坏，请从备份恢复', 422);
  }
}
export function getAnniversaries(ctx: IdentityContext) {
  return controlled(ctx, async () => {
    const state = await readState();
    return {
      items: state.items,
      revision: state.revision,
      imported: state.imports.includes(importKey(ctx.userId)),
    };
  });
}
function importKey(user: string) {
  return createHash('sha256').update(`v1:${user}`).digest('hex');
}
export function mergeAnniversaries(existing: Anniversary[], incoming: Anniversary[]) {
  const merged = [...existing];
  for (const item of incoming) {
    if (
      !merged.some(
        (m) => m.title === item.title && m.date === item.date && m.yearly === item.yearly,
      )
    )
      merged.push({ ...item, id: randomUUID() });
  }
  return merged;
}
export function saveAnniversaries(ctx: IdentityContext, input: unknown) {
  return controlled(ctx, async () => {
    const data = z
      .object({ items: z.array(anniversarySchema).max(500), revision: z.string().uuid() })
      .strict()
      .parse(input);
    if (new Set(data.items.map((x) => x.id)).size !== data.items.length)
      throw new AppError('VALIDATION', '纪念日 ID 不能重复');
    return withLock(async () => {
      const state = await readState();
      if (state.revision !== data.revision)
        throw new AppError('CONFLICT', '纪念日已在另一台设备更新，请重新加载后再修改', 409);
      const next = { ...state, items: data.items, revision: randomUUID() };
      await atomicWrite('state', 'anniversaries.json', JSON.stringify(next), true);
      return {
        items: next.items,
        revision: next.revision,
        imported: next.imports.includes(importKey(ctx.userId)),
      };
    });
  });
}
export function importAnniversaries(ctx: IdentityContext, input: unknown) {
  return controlled(ctx, async () => {
    const data = z
      .object({ items: z.array(anniversarySchema).max(500), confirmed: z.literal(true) })
      .strict()
      .parse(input);
    return withLock(async () => {
      const state = await readState();
      const key = importKey(ctx.userId);
      if (state.imports.includes(key))
        throw new AppError('ALREADY_IMPORTED', '此账号已导入过旧版纪念日，不会重复导入', 409);
      const next = anniversaryStateSchema.parse({
        items: mergeAnniversaries(state.items, data.items),
        imports: [...state.imports, key],
        revision: randomUUID(),
      });
      await atomicWrite('state', 'anniversaries.json', JSON.stringify(next), true);
      return { items: next.items, revision: next.revision, imported: true };
    });
  });
}

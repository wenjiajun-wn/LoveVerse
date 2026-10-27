import 'server-only';
import { authorize, type IdentityContext } from '../auth/session';
import { MemoryRepository } from './repository';
import { searchMemories as search } from './search';
import type { MemoryInput, SearchQuery } from './model';
import { AppError, type Result } from './errors';
import { ZodError } from 'zod';
export async function controlled<T>(
  context: IdentityContext,
  action: () => Promise<T>,
): Promise<Result<T>> {
  try {
    await authorize(context);
    return { ok: true, data: await action() };
  } catch (error) {
    if (error instanceof AppError)
      return { ok: false, error: { code: error.code, message: error.message } };
    if (error instanceof ZodError)
      return {
        ok: false,
        error: { code: 'VALIDATION', message: '输入不符合要求，请检查日期、长度和必填字段' },
      };
    return {
      ok: false,
      error: { code: 'STORAGE', message: '存储操作失败，原有内容未被主动覆盖，请检查磁盘或备份' },
    };
  }
}
// 唯一面向 API / 未来 Agent 的入口；不接受请求传入的 userId 作为身份。
export class MemoryService {
  private repository = new MemoryRepository();
  listMemories(ctx: IdentityContext) {
    return controlled(ctx, () => this.repository.list());
  }
  getMemory(ctx: IdentityContext, id: string) {
    return controlled(ctx, () => this.repository.get(id));
  }
  searchMemories(ctx: IdentityContext, query: SearchQuery) {
    return controlled(ctx, async () => search(await this.repository.list(), query));
  }
  createMemory(ctx: IdentityContext, input: MemoryInput) {
    return controlled(ctx, () => this.repository.create(input));
  }
  updateMemory(ctx: IdentityContext, id: string, input: MemoryInput, revision: string) {
    return controlled(ctx, () => this.repository.update(id, input, revision));
  }
  deleteMemory(ctx: IdentityContext, id: string, revision: string, confirmed: boolean) {
    return controlled(ctx, async () => {
      if (confirmed !== true) throw new AppError('CONFIRM', '删除回忆需要明确确认');
      return this.repository.delete(id, revision);
    });
  }
}
export const memoryService = new MemoryService();

import 'server-only';
import { randomUUID } from 'node:crypto';
import { memoryInputSchema, uuid, type MemoryInput, type MemoryRecord } from './model';
import { parseMemory, serializeMemory } from './markdown';
import { atomicWrite, listFiles, readFile, removeFile, withLock } from './storage';
import { AppError } from './errors';
export class MemoryRepository {
  async list(): Promise<MemoryRecord[]> {
    const names = (await listFiles('memories')).filter((name) => name.endsWith('.md'));
    if (names.length > 1000) throw new AppError('LIMIT', '最多支持 1000 条回忆', 422);
    const records = [];
    for (const name of names) records.push(await this.get(name.slice(0, -3)));
    return records.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  }
  async get(id: string): Promise<MemoryRecord> {
    uuid.parse(id);
    const file = await readFile('memories', `${id}.md`);
    if (!file) throw new AppError('NOT_FOUND', '回忆不存在', 404);
    const record = parseMemory(file.toString('utf8'));
    if (record.id !== id) throw new AppError('CORRUPT', '文件名与回忆 ID 不一致', 422);
    return record;
  }
  async create(input: MemoryInput) {
    const data = memoryInputSchema.parse(input);
    return withLock(async () => {
      if ((await listFiles('memories')).filter((n) => n.endsWith('.md')).length >= 1000)
        throw new AppError('LIMIT', '回忆数量达到上限', 422);
      await this.checkPhotos(data);
      const now = new Date().toISOString();
      const id = randomUUID();
      const text = serializeMemory({ ...data, id, createdAt: now, updatedAt: now, metadata: {} });
      await atomicWrite('memories', `${id}.md`, text);
      return parseMemory(text);
    });
  }
  async update(id: string, input: MemoryInput, revision: string) {
    uuid.parse(id);
    const data = memoryInputSchema.parse(input);
    return withLock(async () => {
      const old = await this.get(id);
      if (old.revision !== revision)
        throw new AppError('CONFLICT', '这段回忆已被另一台设备修改，请重新打开后合并内容', 409);
      await this.checkPhotos(data);
      const text = serializeMemory({ ...old, ...data, updatedAt: new Date().toISOString() });
      await atomicWrite('memories', `${id}.md`, text, true);
      return parseMemory(text);
    });
  }
  async delete(id: string, revision: string) {
    uuid.parse(id);
    return withLock(async () => {
      const old = await this.get(id);
      if (old.revision !== revision)
        throw new AppError('CONFLICT', '回忆已更新，请重新确认删除', 409);
      await removeFile('memories', `${id}.md`, true);
      return { id };
    });
  }
  private async checkPhotos(data: MemoryInput) {
    for (const photo of data.photos)
      if (!(await readFile('uploads', `${photo.id}.webp`, 8 * 1024 * 1024)))
        throw new AppError('PHOTO', '照片不存在，请重新上传');
  }
}

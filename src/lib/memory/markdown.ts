import 'server-only';
import { createHash } from 'node:crypto';
import { parseDocument, stringify } from 'yaml';
import { memoryInputSchema, memoryMetaSchema, type MemoryRecord } from './model';
import { AppError } from './errors';
export const revisionOf = (text: string) => createHash('sha256').update(text).digest('hex');
export function parseMemory(text: string): MemoryRecord {
  if (Buffer.byteLength(text) > 200000) throw new AppError('LIMIT', '回忆文件过大', 413);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match || match[1].length > 30000)
    throw new AppError('CORRUPT', 'Markdown frontmatter 无效', 422);
  try {
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length) throw Error();
    const metadata = memoryMetaSchema.parse(document.toJS({ maxAliasCount: 0 }));
    const input = memoryInputSchema.parse({
      title: metadata.title,
      date: metadata.date,
      category: metadata.category,
      place: metadata.place,
      tags: metadata.tags,
      photos: metadata.photos,
      color: metadata.color,
      visibility: metadata.visibility,
      story: match[2],
    });
    return {
      ...input,
      id: metadata.id,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      metadata,
      revision: revisionOf(text),
    };
  } catch {
    throw new AppError('CORRUPT', '回忆元数据损坏，请从备份恢复', 422);
  }
}
export function serializeMemory(record: Omit<MemoryRecord, 'revision'>) {
  const { story, metadata, ...fields } = record;
  const meta = { ...metadata, ...fields };
  delete (meta as Record<string, unknown>).story;
  delete (meta as Record<string, unknown>).revision;
  // 正文只存一份，避免 frontmatter story 与 Markdown 正文发生分歧。
  const text = `---\n${stringify(meta, { lineWidth: 0 })}---\n${story}`;
  parseMemory(text);
  return text;
}

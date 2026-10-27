import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './errors';
type Bucket = 'memories' | 'uploads' | 'backups' | 'auth' | 'sessions' | 'state';
const buckets: Bucket[] = ['memories', 'uploads', 'backups', 'auth', 'sessions', 'state'];
export function storageRoot() {
  const root = path.resolve(/* turbopackIgnore: true */ process.env.LOVEVERSE_DATA_DIR || path.join(process.cwd(), 'private'));
  const forbidden = ['public', '.next', '.git', 'src', 'node_modules'].map((p) =>
    path.join(/* turbopackIgnore: true */ process.cwd(), p).toLowerCase(),
  );
  if (
    root.toLowerCase() === process.cwd().toLowerCase() ||
    forbidden.some((p) => root.toLowerCase() === p || root.toLowerCase().startsWith(p + path.sep))
  )
    throw new AppError('CONFIG', '私人存储目录不能位于源码或公开目录', 503);
  return root;
}
async function noLinks(target: string) {
  const parsed = path.parse(target);
  const parts = target.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      const info = await fs.lstat(/* turbopackIgnore: true */ current);
      if (info.isSymbolicLink()) throw new AppError('PATH', '不允许符号链接路径');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
}
export async function safePath(bucket: Bucket, name: string) {
  if (
    !buckets.includes(bucket) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,150}$/.test(name) ||
    name.includes('..')
  )
    throw new AppError('PATH', '非法文件路径');
  const root = storageRoot();
  const dir = path.join(/* turbopackIgnore: true */ root, bucket);
  await noLinks(dir);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(/* turbopackIgnore: true */ dir, name);
  await noLinks(file);
  return file;
}
export async function readFile(
  bucket: Bucket,
  name: string,
  limit = 256000,
): Promise<Buffer | null> {
  const file = await safePath(bucket, name);
  try {
    const handle = await fs.open(/* turbopackIgnore: true */ file, 'r');
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > limit)
        throw new AppError('CORRUPT', '文件过大或数据损坏，已停止读取', 422);
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}
export async function listFiles(bucket: Bucket) {
  const file = await safePath(bucket, 'placeholder');
  const names = await fs.readdir(/* turbopackIgnore: true */ path.dirname(file));
  if (names.length > 5000) throw new AppError('LIMIT', '私人目录文件数量超过限制', 422);
  return names;
}
// 调用方在事务锁内读-改-写；临时文件和目标在同一文件系统。
export async function atomicWrite(
  bucket: Bucket,
  name: string,
  data: string | Buffer,
  backup = false,
) {
  const file = await safePath(bucket, name);
  const old = backup ? await readFile(bucket, name, 8 * 1024 * 1024) : null;
  if (old) await atomicWrite('backups', `${Date.now()}-${randomUUID()}-${name}`, old);
  const temp = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temp, file);
  } catch (e) {
    await fs.unlink(temp).catch(() => {});
    throw e;
  }
}
export async function removeFile(bucket: Bucket, name: string, backup = false) {
  const old = await readFile(bucket, name, 8 * 1024 * 1024);
  if (!old) return;
  if (backup) await atomicWrite('backups', `${Date.now()}-${randomUUID()}-${name}`, old);
  await fs.unlink(await safePath(bucket, name));
}
export async function withLock<T>(work: () => Promise<T>): Promise<T> {
  const root = storageRoot();
  await noLinks(root);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const lock = path.join(root, '.write-lock');
  const deadline = Date.now() + 4000;
  while (true) {
    try {
      await fs.mkdir(lock);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (Date.now() > deadline)
        throw new AppError('BUSY', '存储繁忙或存在恢复锁，请稍后重试', 503);
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  try {
    return await work();
  } finally {
    await fs.rmdir(lock);
  }
}

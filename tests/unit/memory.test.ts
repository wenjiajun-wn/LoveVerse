import { getCoupleProfile } from '../../src/lib/auth/couple';
import { GET as sessionRoute } from '../../src/app/api/auth/session/route';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { hashPassword, verifyPassword } from '../../src/lib/auth/password';
import {
  authenticate,
  login,
  logout,
  sessionCookie,
  type IdentityContext,
} from '../../src/lib/auth/session';
import { atomicWrite, listFiles, safePath, withLock } from '../../src/lib/memory/storage';
import { parseMemory, serializeMemory } from '../../src/lib/memory/markdown';
import { MemoryRepository } from '../../src/lib/memory/repository';
import { memoryService } from '../../src/lib/memory/service';
import { searchMemories } from '../../src/lib/memory/search';
import {
  getAnniversaries,
  importAnniversaries,
  saveAnniversaries,
} from '../../src/lib/memory/anniversaries';
import { getPhoto, uploadPhoto, deletePhoto } from '../../src/lib/memory/uploads';
import { checkOrigin } from '../../src/lib/auth/config';
import type { MemoryInput } from '../../src/lib/memory/model';
import { GET as listRoute, POST as createRoute } from '../../src/app/api/memories/route';
import { GET as photoRoute } from '../../src/app/api/uploads/[id]/route';
import { POST as uploadRoute } from '../../src/app/api/uploads/route';
import { GET as datesRoute } from '../../src/app/api/anniversaries/route';
import { POST as importRoute } from '../../src/app/api/anniversaries/import/route';
import {
  GET as detailRoute,
  PUT as updateRoute,
  DELETE as deleteRoute,
} from '../../src/app/api/memories/[id]/route';
const password = 'fictional-test-password-only';
const email = 'member@example.test';
const input: MemoryInput = {
  title: '一起去海边',
  date: '2024-02-29',
  category: '旅行',
  place: '青岛',
  tags: ['日落', '海边'],
  story: '# 那一天\n\n海风与**你**。\n\n---\n保留末尾换行\n',
  photos: [],
  color: 'blue',
  visibility: 'private',
};
let root: string;
let passwordHash: string;
let ctx: IdentityContext;
let cookie: string;
const repository = new MemoryRepository();
beforeAll(async () => {
  passwordHash = await hashPassword(password);
});
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'loveverse-unit-'));
  process.env.LOVEVERSE_DATA_DIR = root;
  process.env.LOVEVERSE_MODE = 'private';
  process.env.LOVEVERSE_ORIGIN = 'http://localhost:3000';
  await atomicWrite('auth', 'users.json', JSON.stringify([{ email, passwordHash }]));
  const token = await login(email, password);
  cookie = `loveverse_session=${token}`;
  ctx = await authenticate(new Request('http://localhost:3000', { headers: { cookie } }));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (
    path.dirname(root) !== path.resolve(tmpdir()) ||
    !path.basename(root).startsWith('loveverse-unit-')
  )
    throw Error('测试清理路径无效');
  await fs.rm(root, { recursive: true, force: true });
  delete process.env.LOVEVERSE_DATA_DIR;
  delete process.env.LOVEVERSE_MODE;
  delete process.env.LOVEVERSE_ORIGIN;
});
describe('Markdown 与安全文件仓库', () => {
  it('往返保留正文、数组、日期及扩展 metadata', () => {
    const record = {
      ...input,
      id: randomUUID(),
      createdAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
      metadata: { custom: { source: '手写日记', mood: ['温暖'] } },
    };
    const text = serializeMemory(record);
    const parsed = parseMemory(text);
    expect(parsed.story).toBe(input.story);
    expect(parsed.tags).toEqual(input.tags);
    expect(parsed.metadata.custom).toEqual(record.metadata.custom);
  });
  it('创建、读取、更新、删除并保留原文备份', async () => {
    const created = await repository.create(input);
    expect((await repository.list())[0].id).toBe(created.id);
    const file = await safePath('memories', `${created.id}.md`);
    const custom = serializeMemory({
      ...created,
      metadata: { ...created.metadata, source: '不能丢失' },
    });
    await fs.writeFile(file, custom);
    const current = await repository.get(created.id);
    const updated = await repository.update(
      created.id,
      { ...input, title: '新的标题' },
      current.revision,
    );
    expect(updated.metadata.source).toBe('不能丢失');
    expect(updated.story).toBe(input.story);
    await repository.delete(updated.id, updated.revision);
    await expect(repository.get(updated.id)).rejects.toMatchObject({ status: 404 });
    expect((await listFiles('backups')).length).toBe(2);
  });
  it('并发编辑只接受同一 revision 的一次更新', async () => {
    const m = await repository.create(input);
    const results = await Promise.allSettled([
      repository.update(m.id, { ...input, title: 'A' }, m.revision),
      repository.update(m.id, { ...input, title: 'B' }, m.revision),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('拒绝路径遍历、Windows 路径、伪造 ID', async () => {
    for (const id of ['../secret', '..\\auth\\users', 'C:\\secret', '%2e%2e', 'con', ''])
      await expect(repository.get(id)).rejects.toThrow();
    await expect(safePath('memories', '../users.json')).rejects.toThrow();
  });
  it('拒绝把私人目录指向 public', async () => {
    process.env.LOVEVERSE_DATA_DIR = path.resolve('public/private');
    await expect(repository.list()).rejects.toMatchObject({ code: 'CONFIG' });
  });
  it('拒绝符号链接目录', async () => {
    const outside = path.join(root, 'outside');
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(root, 'memories'), 'junction');
    await expect(repository.list()).rejects.toMatchObject({ code: 'PATH' });
  });
  it('损坏 Markdown 不会被读取或覆盖', async () => {
    const m = await repository.create(input);
    const file = await safePath('memories', `${m.id}.md`);
    await fs.writeFile(file, '损坏的文件');
    await expect(repository.update(m.id, input, m.revision)).rejects.toMatchObject({
      code: 'CORRUPT',
    });
    expect(await fs.readFile(file, 'utf8')).toBe('损坏的文件');
  });
  it('拒绝重复 YAML 字段、别名和非法可见性', () => {
    expect(() => parseMemory('---\ntitle: a\ntitle: b\n---\ntext')).toThrow();
    expect(() => parseMemory('---\na: &a [1]\nb: *a\n---\ntext')).toThrow();
  });
  it('失败事务释放锁，原数据仍可继续写入', async () => {
    await expect(
      withLock(async () => {
        throw Error('测试故障');
      }),
    ).rejects.toThrow('测试故障');
    expect((await repository.create(input)).title).toBe(input.title);
  });
});
describe('身份与 API 权限', () => {
  it('密码验证与 cookie 属性', async () => {
    expect(await verifyPassword(password, passwordHash)).toBe(true);
    expect(await verifyPassword('错误密码', passwordHash)).toBe(false);
    expect(sessionCookie('test')).toContain('HttpOnly; SameSite=Strict');
    process.env.LOVEVERSE_ORIGIN = 'https://love.example.com';
    expect(sessionCookie('test')).toContain('Secure');
  });
  it('伪造上下文不能调用未来 Agent 服务', async () => {
    const result = await memoryService.listMemories({
      userId: email,
      role: 'member',
      expiresAt: Date.now() + 100000,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  });
  it('有效上下文支持六个 MemoryService 方法', async () => {
    const created = await memoryService.createMemory(ctx, input);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await memoryService.getMemory(ctx, created.data.id)).ok).toBe(true);
    expect((await memoryService.listMemories(ctx)).ok).toBe(true);
    expect((await memoryService.searchMemories(ctx, { q: '海风' })).ok).toBe(true);
    const updated = await memoryService.updateMemory(
      ctx,
      created.data.id,
      { ...input, title: '修改' },
      created.data.revision,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(
      await memoryService.deleteMemory(ctx, created.data.id, updated.data.revision, false),
    ).toMatchObject({ ok: false, error: { code: 'CONFIRM' } });
    expect(
      (await memoryService.deleteMemory(ctx, created.data.id, updated.data.revision, true)).ok,
    ).toBe(true);
  });
  it('全部私人读写路由在未登录时拒绝访问', async () => {
    const id = randomUUID();
    const context = { params: Promise.resolve({ id }) };
    for (const [method, route] of [
      ['GET', listRoute],
      ['POST', createRoute],
      ['GET', datesRoute],
      ['POST', importRoute],
      ['POST', uploadRoute],
    ] as const)
      expect((await route(new Request('http://localhost:3000/api/test', { method }))).status).toBe(
        401,
      );
    for (const [method, route] of [
      ['GET', detailRoute],
      ['PUT', updateRoute],
      ['DELETE', deleteRoute],
      ['GET', photoRoute],
    ] as const)
      expect(
        (await route(new Request('http://localhost:3000/api/test', { method }), context)).status,
      ).toBe(401);
  });
  it('demo 即使携带有效 cookie 也不能读取私人数据', async () => {
    await repository.create(input);
    process.env.LOVEVERSE_MODE = 'demo';
    const response = await listRoute(
      new Request('http://localhost:3000/api/memories', { headers: { cookie } }),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(input.story);
  });
  it('注销会撤销会话，包括旧 Agent context', async () => {
    await logout(ctx);
    expect(await memoryService.listMemories(ctx)).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    await expect(
      authenticate(new Request('http://localhost:3000', { headers: { cookie } })),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('会话过期不能访问', async () => {
    const file = (await listFiles('sessions'))[0];
    const location = await safePath('sessions', file);
    const data = JSON.parse(await fs.readFile(location, 'utf8'));
    data.expiresAt = 0;
    await fs.writeFile(location, JSON.stringify(data));
    await expect(
      authenticate(new Request('http://localhost:3000', { headers: { cookie } })),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('修改密码配置后旧会话立即失效', async () => {
    await atomicWrite(
      'auth',
      'users.json',
      JSON.stringify([{ email, passwordHash: await hashPassword('changed-fixture-password-123') }]),
    );
    expect(await memoryService.listMemories(ctx)).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });
  it('同源写入校验且拒绝跨域', async () => {
    expect(() =>
      checkOrigin(
        new Request('http://localhost:3000', { headers: { origin: 'https://evil.example' } }),
      ),
    ).toThrow();
    const response = await createRoute(
      new Request('http://localhost:3000/api/memories', {
        method: 'POST',
        headers: { cookie, origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    );
    expect(response.status).toBe(403);
  });
  it('连续错误登录受到持久限速', async () => {
    for (let i = 0; i < 10; i++)
      await expect(login(email, 'wrong')).rejects.toMatchObject({ status: 401 });
    await expect(login(email, password)).rejects.toMatchObject({ status: 429 });
  });
});
describe('搜索、图片、纪念日', () => {
  it('全文关键词与日期地点分类标签组合筛选', async () => {
    const m = await repository.create(input);
    expect(
      searchMemories([m], {
        q: '海风 你',
        from: '2024-02-01',
        to: '2024-02-29',
        place: '青',
        category: '旅行',
        tag: '日落',
      }),
    ).toHaveLength(1);
    expect(searchMemories([m], { q: '不存在' })).toEqual([]);
    expect(() => searchMemories([m], { from: '2025-01-01', to: '2024-01-01' })).toThrow();
  });
  it('图片重新编码后仅通过鉴权路由读取，引用中的图片不能删除', async () => {
    const bytes = await sharp({
      create: { width: 16, height: 16, channels: 3, background: 'pink' },
    })
      .png()
      .toBuffer();
    const uploaded = await uploadPhoto(ctx, bytes, 'image/png');
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    const id = uploaded.data.id;
    const photo = await getPhoto(ctx, id);
    expect(photo.ok).toBe(true);
    if (photo.ok) expect((await sharp(photo.data).metadata()).format).toBe('webp');
    const unauthorized = await photoRoute(new Request('http://localhost:3000'), {
      params: Promise.resolve({ id }),
    });
    expect(unauthorized.status).toBe(401);
    const authorized = await photoRoute(
      new Request('http://localhost:3000', { headers: { cookie } }),
      { params: Promise.resolve({ id }) },
    );
    expect(authorized.headers.get('cache-control')).toContain('no-store');
    await repository.create({ ...input, photos: [{ id, alt: '照片' }] });
    expect(await deletePhoto(ctx, id, true)).toMatchObject({
      ok: false,
      error: { code: 'CONFLICT' },
    });
  });
  it('拒绝伪装图片、SVG 和超过大小的上传', async () => {
    expect(
      (await uploadPhoto(ctx, Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml')).ok,
    ).toBe(false);
    expect((await uploadPhoto(ctx, Buffer.from('fake png'), 'image/png')).ok).toBe(false);
    expect((await uploadPhoto(ctx, Buffer.alloc(8 * 1024 * 1024 + 1), 'image/png')).ok).toBe(false);
  });
  it('纪念日必须确认导入、只导入一次、相同内容去重', async () => {
    const item = { id: randomUUID(), title: '旅行', date: '2027-01-01', yearly: false };
    expect((await importAnniversaries(ctx, { items: [item], confirmed: false })).ok).toBe(false);
    const result = await importAnniversaries(ctx, {
      items: [item, { ...item, id: randomUUID() }],
      confirmed: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.items).toHaveLength(1);
    expect(await importAnniversaries(ctx, { items: [item], confirmed: true })).toMatchObject({
      ok: false,
      error: { code: 'ALREADY_IMPORTED' },
    });
    const state = await getAnniversaries(ctx);
    expect(state.ok && state.data.imported).toBe(true);
  });
  it('同步纪念日时检测其他设备的写入冲突', async () => {
    const first = await getAnniversaries(ctx);
    if (!first.ok) throw Error();
    expect((await saveAnniversaries(ctx, { items: [], revision: first.data.revision })).ok).toBe(
      true,
    );
    expect(
      await saveAnniversaries(ctx, { items: [], revision: first.data.revision }),
    ).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  });
});

describe('私人情侣配置', () => {
  it('空值或非法日期不回退演示身份和日期', async () => {
    vi.stubEnv('LOVEVERSE_COUPLE_NAMES', '');
    vi.stubEnv('LOVEVERSE_COUPLE_START', '');
    expect(await getCoupleProfile(ctx)).toEqual({ names: null, start: null });
    vi.stubEnv('LOVEVERSE_COUPLE_START', '2025-02-29');
    expect((await getCoupleProfile(ctx)).start).toBeNull();
  });
  it('认证后返回真实配置，未登录及伪造身份不得读取', async () => {
    vi.stubEnv('LOVEVERSE_COUPLE_NAMES', '测试甲 & 测试乙');
    vi.stubEnv('LOVEVERSE_COUPLE_START', '2024-02-29');
    const unauth = await sessionRoute(new Request('http://localhost:3000/api/auth/session'));
    expect(unauth.status).toBe(401);
    expect(await unauth.text()).not.toContain('测试甲');
    await expect(
      getCoupleProfile({ userId: email, role: 'member', expiresAt: Date.now() + 1000 }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const result = await sessionRoute(
      new Request('http://localhost:3000/api/auth/session', { headers: { cookie } }),
    );
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect((await result.json()).data.couple).toEqual({
      names: '测试甲 & 测试乙',
      start: '2024-02-29',
    });
  });
});

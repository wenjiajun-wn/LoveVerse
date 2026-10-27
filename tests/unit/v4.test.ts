import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../../src/lib/auth/password';
import { authenticate, login, type IdentityContext } from '../../src/lib/auth/session';
import { atomicWrite } from '../../src/lib/memory/storage';
import { memoryService } from '../../src/lib/memory/service';
import { unwrap } from '../../src/lib/agent/consent';
import { dispatchV4, getV4Dashboard } from '../../src/lib/v4/service';
import { v4Input } from '../../src/lib/v4/model';
import type { V4Book, V4Plan } from '../../src/lib/v4/model';
import { GET as dashboardRoute, POST as actionRoute } from '../../src/app/api/v4/route';
import { POST as jobRoute } from '../../src/app/api/internal/reminders/route';
import { POST as pdfRoute } from '../../src/app/api/v4/books/[id]/pdf/route';
import { GET as capsulePhotoRoute } from '../../src/app/api/v4/capsules/[id]/photos/[photo]/route';
import { saveConsent } from '../../src/lib/agent/consent';
import { companionTask } from '../../src/lib/agent/companion';
import { runReminderJob, dateInZone, dueReminders } from '../../src/lib/v4/reminders';
import { saveAnniversaries, getAnniversaries } from '../../src/lib/memory/anniversaries';
import { loadV4 } from '../../src/lib/v4/store';
import { uploadPhoto, getPhoto, deletePhoto } from '../../src/lib/memory/uploads';
import { bookHTML } from '../../src/lib/v4/pdf';
import { externalAdapter } from '../../src/lib/v4/notifications';
import sharp from 'sharp';
import type { AIProvider } from '../../src/lib/agent/provider';

let root: string;
let alice: IdentityContext;
let bob: IdentityContext;
async function member(email: string) {
  const token = await login(email, 'fictional-private-test-password');
  return authenticate(
    new Request('http://localhost:3000', {
      headers: { cookie: 'loveverse_session=' + token },
    }),
  );
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'loveverse-v4-test-'));
  process.env.LOVEVERSE_DATA_DIR = root;
  process.env.LOVEVERSE_MODE = 'private';
  process.env.LOVEVERSE_ORIGIN = 'http://localhost:3000';
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.LOVEVERSE_AI_ENABLED;
  const hashed = await hashPassword('fictional-private-test-password');
  await atomicWrite(
    'auth',
    'users.json',
    JSON.stringify([
      { email: 'alice@example.test', passwordHash: hashed },
      { email: 'bob@example.test', passwordHash: hashed },
    ]),
  );
  alice = await member('alice@example.test');
  bob = await member('bob@example.test');
});
afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.LOVEVERSE_SCHEDULER_TOKEN;
  if (!root.startsWith(path.join(tmpdir(), 'loveverse-v4-test-')))
    throw new Error('测试目录不符合预期');
  await fs.rm(root, { recursive: true, force: true });
  delete process.env.LOVEVERSE_DATA_DIR;
  delete process.env.LOVEVERSE_MODE;
  delete process.env.LOVEVERSE_ORIGIN;
});
const makeMemory = () =>
  memoryService
    .createMemory(alice, {
      title: '海边',
      date: '2024-02-29',
      category: '旅行',
      place: '青岛',
      tags: ['海'],
      story: '我们一起看海。',
      photos: [],
      color: 'blue',
      visibility: 'private',
    })
    .then(unwrap);
async function consent(record: Awaited<ReturnType<typeof makeMemory>>) {
  process.env.LOVEVERSE_AI_ENABLED = 'true';
  for (const ctx of [alice, bob])
    await saveConsent(ctx, {
      enabled: true,
      confirmed: true,
      selected: [{ id: record.id, revision: record.revision }],
    });
}
const mockProvider = (value: unknown): AIProvider => ({
  complete: vi.fn(async () => ({
    message: { role: 'assistant' as const, content: JSON.stringify(value) },
    tokens: 100,
  })),
});
describe('V4 完整集成与安全边界', () => {
  it('离线错过的提醒会补偿且重启重跑不重复；恶意任务参数不能控制时间', async () => {
    process.env.LOVEVERSE_SCHEDULER_TOKEN = 'b'.repeat(64);
    const state = unwrap(await getAnniversaries(alice));
    unwrap(
      await saveAnniversaries(alice, {
        revision: state.revision,
        items: [{ id: randomUUID(), title: '补偿测试', date: '2025-02-28', yearly: true }],
      }),
    );
    unwrap(
      await dispatchV4(alice, {
        action: 'reminders.save',
        enabled: true,
        daysBefore: [0, 1],
        timeZone: 'Asia/Shanghai',
      }),
    );
    const data = await loadV4();
    Object.values(data.reminders)[0].since = '2025-02-26T00:00:00Z';
    data.lastRun = '2025-02-26T00:00:00Z';
    await atomicWrite('state', 'loveverse-v4.json', JSON.stringify(data));
    expect(
      (await runReminderJob('Bearer ' + 'b'.repeat(64), new Date('2025-03-01T04:00:00Z'))).created,
    ).toBe(2);
    expect(
      (await runReminderJob('Bearer ' + 'b'.repeat(64), new Date('2025-03-01T05:00:00Z'))).created,
    ).toBe(0);
    const response = await jobRoute(
      new Request('http://localhost:3000/api/internal/reminders', {
        method: 'POST',
        headers: { Authorization: 'wrong' },
        body: JSON.stringify({ now: '2099-01-01' }),
      }),
    );
    expect(response.status).toBe(401);
  });
  it('合法会话无法越权导出另一成员的 PDF，非法来源路径在服务端被拒绝', async () => {
    const record = await makeMemory();
    const book = unwrap(
      await dispatchV4(alice, { action: 'book.create', title: '私有书册', memoryIds: [record.id] }),
    ) as V4Book;
    const token = await login('bob@example.test', 'fictional-private-test-password');
    const request = () =>
      new Request('http://localhost:3000/api/v4/books/' + book.id + '/pdf', {
        method: 'POST',
        headers: {
          cookie: 'loveverse_session=' + token,
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ revision: book.revision }),
      });
    expect((await pdfRoute(request(), { params: Promise.resolve({ id: book.id }) })).status).toBe(
      404,
    );
    expect(
      (
        await dispatchV4(alice, {
          action: 'book.create',
          title: '路径',
          memoryIds: ['../../private/auth/users.json'],
        })
      ).ok,
    ).toBe(false);
  });
  it('没有记忆时不请求模型，虚构引用被拒绝', async () => {
    const record = await makeMemory();
    await consent(record);
    const provider = mockProvider({
      chapters: [{ memoryId: record.id, quote: '我们去巴黎结婚了。' }],
    });
    await expect(companionTask(alice, 'book', [], {}, provider)).rejects.toMatchObject({
      code: 'NO_EVIDENCE',
    });
    expect(provider.complete).not.toHaveBeenCalled();
    await expect(companionTask(alice, 'book', [record], {}, provider)).rejects.toMatchObject({
      code: 'AI_CITATION',
    });
  });
  it('AI 回忆录引用真实来源，生成失败不写入草稿；撤销后不返回结果', async () => {
    const record = await makeMemory();
    await consent(record);
    const provider = mockProvider({ chapters: [{ memoryId: record.id, quote: '一起看海' }] });
    const book = unwrap(
      await dispatchV4(
        alice,
        { action: 'book.create', title: '真实故事', memoryIds: [record.id], aiIntro: true },
        provider,
      ),
    ) as V4Book;
    expect(book.chapters[0].content).toBe('一起看海');
    const failing: AIProvider = {
      complete: async () => {
        throw Error('provider unavailable');
      },
    };
    expect(
      (
        await dispatchV4(
          alice,
          { action: 'book.create', title: '失败', memoryIds: [record.id], aiIntro: true },
          failing,
        )
      ).ok,
    ).toBe(false);
    expect(unwrap(await getV4Dashboard(alice)).books).toHaveLength(1);
    const revoke: AIProvider = {
      complete: async () => {
        await saveConsent(bob, { enabled: false, confirmed: true, selected: [] });
        return {
          message: {
            role: 'assistant',
            content: JSON.stringify({ chapters: [{ memoryId: record.id, quote: '看海' }] }),
          },
          tokens: 10,
        };
      },
    };
    await expect(companionTask(alice, 'book', [record], {}, revoke)).rejects.toMatchObject({
      code: 'CONSENT',
    });
    expect(unwrap(await memoryService.getMemory(alice, record.id)).story).toBe(record.story);
  });
  it('惊喜限制预算和时间，不能访问另一成员的方案或调用写工具', async () => {
    const record = await makeMemory();
    await consent(record);
    const payload = {
      theme: '海边散步',
      schedule: [{ activity: '散步', minutes: 60, cost: 100 }],
      checklist: ['带水'],
      copy: '一起散步吧',
      verify: ['核实天气'],
      memories: [{ memoryId: record.id, quote: '看海' }],
    };
    await expect(
      companionTask(
        alice,
        'surprise',
        [record],
        { budget: 50, availableMinutes: 180 },
        mockProvider(payload),
      ),
    ).rejects.toMatchObject({ code: 'AI_BUDGET' });
    await expect(
      companionTask(
        alice,
        'surprise',
        [record],
        { budget: 500, availableMinutes: 30 },
        mockProvider(payload),
      ),
    ).rejects.toMatchObject({ code: 'AI_BUDGET' });
    const plan = unwrap(
      await dispatchV4(
        alice,
        {
          action: 'plan.create',
          title: '只给我',
          budget: 500,
          place: '海边',
          wishes: '散步',
          memoryIds: [record.id],
          useAI: true,
        },
        mockProvider(payload),
      ),
    ) as V4Plan;
    expect(plan.content).toContain('备用金：400.00');
    expect(JSON.stringify(unwrap(await getV4Dashboard(bob)))).not.toContain('只给我');
    expect(
      (
        await dispatchV4(bob, {
          action: 'plan.update',
          id: plan.id,
          revision: plan.revision,
          content: '盗改',
        })
      ).ok,
    ).toBe(false);
    const toolProvider: AIProvider = {
      complete: async () => ({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'write', type: 'function', function: { name: 'delete_memory', arguments: '{}' } },
          ],
        },
        tokens: 10,
      }),
    };
    await expect(companionTask(alice, 'book', [record], {}, toolProvider)).rejects.toMatchObject({
      code: 'AI_RESPONSE',
    });
  });
  it('章节筛选、编辑排序、重新生成和并发删除保留来源', async () => {
    const record = await makeMemory();
    expect(
      (
        await dispatchV4(alice, {
          action: 'book.create',
          title: '过滤',
          memoryIds: [record.id],
          filters: { place: '不存在' },
        })
      ).ok,
    ).toBe(false);
    const book = unwrap(
      await dispatchV4(alice, { action: 'book.create', title: '书', memoryIds: [record.id] }),
    ) as V4Book;
    const chapter = book.chapters[0];
    expect(
      (
        await dispatchV4(alice, {
          action: 'book.update',
          id: book.id,
          revision: book.revision,
          title: '书',
          content: '',
          chapters: [{ ...chapter, date: '2020-01-01' }],
        })
      ).ok,
    ).toBe(false);
    const regenerated = unwrap(
      await dispatchV4(alice, {
        action: 'book.regenerate',
        id: book.id,
        revision: book.revision,
        chapterId: chapter.id,
      }),
    );
    expect(regenerated).toMatchObject({ content: record.story });
    const updated = unwrap(
      await dispatchV4(alice, {
        action: 'book.update',
        id: book.id,
        revision: book.revision,
        title: '新版',
        content: '',
        chapters: [{ ...chapter, content: '手动草稿' }],
        theme: 'paper',
      }),
    ) as V4Book;
    expect(updated.sources).toEqual(book.sources);
    expect(
      (
        await dispatchV4(alice, {
          action: 'book.delete',
          id: book.id,
          revision: book.revision,
          confirmed: true,
        })
      ).ok,
    ).toBe(false);
    expect(bookHTML(updated, new Map())).not.toContain('<script>');
    expect(bookHTML({ ...updated, title: '<script>alert(1)</script>' }, new Map())).toContain(
      '&lt;script&gt;',
    );
  });
  it('封存附件无法走图库或胶囊路径提前获取，到期后双方可读', async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#abc' } })
      .png()
      .toBuffer();
    const photo = unwrap(await uploadPhoto(alice, bytes, 'image/png'));
    const created = unwrap(
      await dispatchV4(alice, {
        action: 'capsule.create',
        title: '封存',
        content: '未来正文',
        unlockDate: '2099-01-01',
        photos: [{ id: photo.id, alt: '照片' }],
      }),
    );
    expect(JSON.stringify(created)).not.toContain('未来正文');
    expect(JSON.stringify(created)).not.toContain(photo.id);
    const capsule = (await loadV4()).capsules[0];
    expect((await getPhoto(bob, capsule.photos[0].id)).ok).toBe(false);
    const token = await login('bob@example.test', 'fictional-private-test-password');
    const req = new Request('http://localhost:3000/api/v4/capsules', {
      headers: { cookie: 'loveverse_session=' + token },
    });
    const params = { params: Promise.resolve({ id: capsule.id, photo: capsule.photos[0].id }) };
    expect((await capsulePhotoRoute(req, params)).status).toBe(404);
    const state = await loadV4();
    state.capsules[0].unlockDate = '2000-01-01';
    await atomicWrite('state', 'loveverse-v4.json', JSON.stringify(state));
    const response = await capsulePhotoRoute(req, params);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(unwrap(await getV4Dashboard(bob)).capsules[0].content).toBe('未来正文');
    expect(
      (
        await dispatchV4(bob, {
          action: 'capsule.delete',
          id: capsule.id,
          revision: capsule.revision,
          confirmed: true,
        })
      ).ok,
    ).toBe(false);
  });
  it('照片被回忆录引用时禁止删除；非法 PDF 路径和匿名请求被拒绝', async () => {
    const record = await makeMemory();
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const photo = unwrap(await uploadPhoto(alice, bytes, 'image/png'));
    const book = unwrap(
      await dispatchV4(alice, { action: 'book.create', title: '书', memoryIds: [record.id] }),
    ) as V4Book;
    unwrap(
      await dispatchV4(alice, {
        action: 'book.update',
        id: book.id,
        revision: book.revision,
        title: '书',
        content: '',
        chapters: [{ ...book.chapters[0], photos: [{ id: photo.id, alt: '图' }] }],
      }),
    );
    expect((await deletePhoto(alice, photo.id, true)).ok).toBe(false);
    const req = new Request('http://localhost:3000/api/v4/books/id/pdf', { method: 'POST' });
    expect(
      (await pdfRoute(req, { params: Promise.resolve({ id: '../../etc/passwd' }) })).status,
    ).toBe(401);
  });
  it('调度任务需要独立凭据，并发执行去重，关闭后不再新增通知', async () => {
    process.env.LOVEVERSE_SCHEDULER_TOKEN = 'a'.repeat(64);
    const now = new Date();
    const today = dateInZone(now, 'Asia/Shanghai');
    const state = unwrap(await getAnniversaries(alice));
    unwrap(
      await saveAnniversaries(alice, {
        revision: state.revision,
        items: [{ id: randomUUID(), title: '纪念日', date: today, yearly: true }],
      }),
    );
    unwrap(
      await dispatchV4(alice, {
        action: 'reminders.save',
        enabled: true,
        daysBefore: [0],
        timeZone: 'Asia/Shanghai',
      }),
    );
    expect(
      (
        await jobRoute(
          new Request('http://localhost:3000/api/internal/reminders', { method: 'POST' }),
        )
      ).status,
    ).toBe(401);
    const results = await Promise.all([
      runReminderJob('Bearer ' + 'a'.repeat(64)),
      runReminderJob('Bearer ' + 'a'.repeat(64)),
    ]);
    expect(results.reduce((n, r) => n + r.created, 0)).toBe(1);
    expect(unwrap(await getV4Dashboard(bob)).notifications).toHaveLength(0);
    const dashboard = unwrap(await getV4Dashboard(alice));
    expect(dashboard.notifications).toHaveLength(1);
    unwrap(
      await dispatchV4(alice, { action: 'notification.read', id: dashboard.notifications[0].id }),
    );
    expect(unwrap(await getV4Dashboard(alice)).notifications[0].read).toBe(true);
    unwrap(await dispatchV4(alice, { action: 'reminders.save', enabled: false, daysBefore: [0] }));
    expect((await runReminderJob('Bearer ' + 'a'.repeat(64))).created).toBe(0);
  });
  it('日期使用时区与平年闰日规则，补偿错过的提醒且不提前首次周年', () => {
    const event = { id: randomUUID(), title: '闰日', date: '2024-02-29', yearly: true };
    const pref = {
      enabled: true,
      daysBefore: [0, 1, 7, 30] as (0 | 1 | 7 | 30)[],
      timeZone: 'Asia/Shanghai',
    };
    expect(
      dueReminders([event], pref, '2025-02-27', '2025-02-28').map((d) => d.daysBefore),
    ).toEqual([1, 0]);
    expect(
      dueReminders([{ ...event, date: '2099-02-28' }], pref, '2025-02-28', '2025-02-28'),
    ).toHaveLength(0);
    expect(dateInZone(new Date('2026-01-01T00:30:00Z'), 'America/Los_Angeles')).toBe('2025-12-31');
  });
  it('公开模式和外部通知适配器不产生私人或外部副作用', async () => {
    await expect(
      externalAdapter('qq-official').send(
        { id: 'test', recipient: 'test', title: 't', body: 'b' },
        { bothMembersApproved: true, recipientOptedIn: true },
      ),
    ).rejects.toMatchObject({ code: 'CHANNEL_DISABLED' });
    process.env.LOVEVERSE_MODE = 'demo';
    expect((await dashboardRoute(new Request('http://localhost:3000/api/v4'))).status).toBe(403);
    await expect(runReminderJob(null)).rejects.toMatchObject({ code: 'PRIVATE_DISABLED' });
  });
});
describe('V4 私人体验', () => {
  it('私人 API 不允许匿名访问或跨站写入', async () => {
    const unauthenticated = await dashboardRoute(new Request('http://localhost:3000/api/v4'));
    expect(unauthenticated.status).toBe(401);
    const token = await login('alice@example.test', 'fictional-private-test-password');
    const forbidden = await actionRoute(
      new Request('http://localhost:3000/api/v4', {
        method: 'POST',
        headers: {
          cookie: 'loveverse_session=' + token,
          origin: 'https://untrusted.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reminders.save', enabled: true, daysBefore: [7] }),
      }),
    );
    expect(forbidden.status).toBe(403);
  });
  it('校验动作格式、日期和确认字段', () => {
    expect(
      v4Input.safeParse({
        action: 'capsule.create',
        title: '明天',
        content: '希望',
        unlockDate: 'not-a-date',
      }).success,
    ).toBe(false);
    expect(
      v4Input.safeParse({ action: 'book.delete', id: randomUUID(), confirmed: false }).success,
    ).toBe(false);
    expect(
      v4Input.safeParse({ action: 'reminders.save', enabled: true, daysBefore: [999] }).success,
    ).toBe(false);
  });
  it('回忆录保留真实来源，另一位成员看不到自己的私人草稿', async () => {
    const record = unwrap(
      await memoryService.createMemory(alice, {
        title: '一起看海',
        date: '2024-06-01',
        category: '旅行',
        place: '青岛',
        tags: ['海边'],
        story: '海风很温柔。',
        photos: [],
        color: 'blue',
        visibility: 'private',
      }),
    );
    const book = unwrap(
      await dispatchV4(alice, {
        action: 'book.create',
        title: '我们的夏天',
        memoryIds: [record.id],
        aiIntro: false,
      }),
    ) as V4Book;
    expect('content' in book && book.content).toContain('海风很温柔');
    expect(unwrap(await getV4Dashboard(alice)).books).toHaveLength(1);
    expect(unwrap(await getV4Dashboard(bob)).books).toHaveLength(0);
    const denied = await dispatchV4(bob, {
      action: 'book.delete',
      id: book.id,
      revision: book.revision,
      confirmed: true,
    });
    expect(denied.ok).toBe(false);
    const updated = unwrap(
      await dispatchV4(alice, {
        action: 'book.update',
        id: book.id,
        revision: book.revision,
        title: '夏天',
        content: '# 修订版本',
      }),
    ) as V4Book;
    const stale = await dispatchV4(alice, {
      action: 'book.update',
      id: book.id,
      revision: book.revision,
      title: '旧版本',
      content: '覆盖',
    });
    expect(stale.ok).toBe(false);
    expect(unwrap(await getV4Dashboard(alice)).books[0].revision).toBe(updated.revision);
  });
  it('时光胶囊解锁前不返回正文，惊喜方案按创建者隔离', async () => {
    unwrap(
      await dispatchV4(alice, {
        action: 'capsule.create',
        title: '未来的信',
        content: '不能提前出现的文字',
        unlockDate: '2099-01-01',
      }),
    );
    const capsule = unwrap(await getV4Dashboard(bob)).capsules[0];
    expect(capsule.unlocked).toBe(false);
    expect(capsule.content).toBe(null);
    const plan = unwrap(
      await dispatchV4(alice, {
        action: 'plan.create',
        title: '秘密计划',
        budget: 500,
        currency: 'CNY',
        place: '北京',
        wishes: '温馨的约会',
        memoryIds: [],
        useAI: false,
      }),
    ) as V4Plan;
    expect(unwrap(await getV4Dashboard(bob)).plans).toHaveLength(0);
    expect(
      (
        await dispatchV4(bob, {
          action: 'plan.delete',
          id: plan.id,
          revision: plan.revision,
          confirmed: true,
        })
      ).ok,
    ).toBe(false);
  });
  it('提醒设置按成员隔离，默认不启用', async () => {
    expect(unwrap(await getV4Dashboard(alice)).reminders.enabled).toBe(false);
    unwrap(
      await dispatchV4(alice, {
        action: 'reminders.save',
        enabled: true,
        daysBefore: [0, 7],
      }),
    );
    expect(unwrap(await getV4Dashboard(alice)).reminders.daysBefore).toEqual([7, 0]);
    expect(unwrap(await getV4Dashboard(bob)).reminders.enabled).toBe(false);
  });
  it('没有双方同意时 AI 不能外发回忆', async () => {
    const result = await dispatchV4(alice, {
      action: 'plan.create',
      title: '惊喜',
      budget: 200,
      currency: 'CNY',
      place: '上海',
      wishes: '安静晚餐',
      memoryIds: [],
      useAI: true,
    });
    expect(result.ok).toBe(false);
    expect(unwrap(await getV4Dashboard(alice)).plans).toHaveLength(0);
  });
});

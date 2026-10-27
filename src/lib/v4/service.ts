import 'server-only';
import { randomUUID } from 'node:crypto';
import type { IdentityContext } from '../auth/session';
import { authorize } from '../auth/session';
import { controlled, memoryService } from '../memory/service';
import { atomicWrite, listFiles } from '../memory/storage';
import { loadV4 as load, mutateV4, ownerOf, owned as requireOwner, sameRevision } from './store';
import { companionTask } from '../agent/companion';
import type { AIProvider } from '../agent/provider';
import { getPhoto } from '../memory/uploads';
import { searchMemories } from '../memory/search';
import { shareable } from '../agent/consent';
import { dateInZone } from './reminders';
import { AppError } from '../memory/errors';
import { todayInShanghai, nextAnniversary, daysBetween } from '../dates';
import { getAnniversaries } from '../memory/anniversaries';
import { unwrap } from '../agent/consent';
import { v4Input, type V4Dashboard, type V4Input } from './model';

async function memories(ctx: IdentityContext, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw new AppError('VALIDATION', '回忆不能重复选择');
  return Promise.all(unique.map(async (id) => unwrap(await memoryService.getMemory(ctx, id))));
}
const sources = (records: Awaited<ReturnType<typeof memories>>) =>
  records.map(({ id, revision, title, date }) => ({ id, revision, title, date }));

export function getV4Dashboard(ctx: IdentityContext) {
  return controlled(ctx, async (): Promise<V4Dashboard> => {
    const state = await load();
    const owner = ownerOf(ctx);
    const today = todayInShanghai();
    const entries = unwrap(await memoryService.listMemories(ctx));
    const dates = unwrap(await getAnniversaries(ctx)).items;
    const preference = state.reminders[owner] ?? {
      enabled: false,
      daysBefore: [0, 1, 7],
      timeZone: 'Asia/Shanghai',
    };
    const upcoming = preference.enabled
      ? dates.flatMap((occasion) => {
          const next = occasion.yearly
            ? nextAnniversary(occasion.date, dateInZone(new Date(), preference.timeZone))
            : occasion.date;
          const days = daysBetween(dateInZone(new Date(), preference.timeZone), next);
          const noticeWindow = Math.max(0, ...preference.daysBefore);
          return next >= occasion.date && days >= 0 && days <= noticeWindow
            ? [{ id: occasion.id, title: occasion.title, date: next, days }]
            : [];
        })
      : [];
    return {
      books: state.books.filter((x) => x.owner === owner),
      plans: state.plans.filter((x) => x.owner === owner),
      capsules: state.capsules.map(({ content, photos, owner: creator, ...item }) => ({
        ...item,
        unlocked: item.unlockDate <= today,
        canDelete: creator === owner,
        photos: item.unlockDate <= today ? photos : [],
        content: item.unlockDate <= today ? content : null,
      })),
      reminders: preference,
      notifications: state.notifications
        .filter((n) => n.owner === owner)
        .slice(-100)
        .reverse(),
      schedulerLastRun: state.lastRun,
      upcoming,
      todayMemories: entries
        .filter(shareable)
        .filter((r) => r.date.slice(5) === today.slice(5) && r.date < today)
        .map((r) => ({ id: r.id, title: r.title, date: r.date, place: r.place }))
        .slice(0, 12),
      quiz: entries
        .filter(shareable)
        .slice(0, 30)
        .map((r) => ({
          id: r.id,
          title: r.title,
          date: r.date,
          place: r.place,
        })),
    };
  });
}

export function dispatchV4(
  ctx: IdentityContext,
  value: unknown,
  provider?: AIProvider,
  signal?: AbortSignal,
) {
  return controlled(ctx, async () => {
    const input: V4Input = v4Input.parse(value);
    const owner = ownerOf(ctx);
    await authorize(ctx);
    const mutate = <T>(work: (state: import('./model').V4State) => T | Promise<T>) =>
      mutateV4(async (state) => {
        await authorize(ctx);
        return work(state);
      });
    switch (input.action) {
      case 'book.create': {
        const records = await memories(ctx, input.memoryIds);
        if (input.filters && searchMemories(records, input.filters).length !== records.length)
          throw new AppError('VALIDATION', '所选回忆不符合筛选条件');
        let chapters = records.map((r) => ({
          id: randomUUID(),
          memoryId: r.id,
          title: r.title,
          date: r.date,
          place: r.place,
          content: r.story,
          photos: r.photos,
        }));
        if (chapters.some((c) => c.content.length > 20000))
          throw new AppError('LIMIT', '单章超过 20000 字，请先精简来源或分册', 413);
        const photos = [
          ...new Map(records.flatMap((r) => r.photos).map((p) => [p.id, p])).values(),
        ];
        if (photos.length > 40)
          throw new AppError('LIMIT', '每册最多 40 张不同照片，请分册生成', 413);
        if (input.aiIntro) {
          const result = await companionTask(ctx, 'book', records, {}, provider, signal);
          if (!('chapters' in result)) throw new AppError('AI_RESPONSE', '章节生成失败', 502);
          chapters = result.chapters.map((f) => ({
            ...chapters.find((c) => c.memoryId === f.memoryId)!,
            content: f.quote,
          }));
        }
        const content =
          '这些章节来自已保存的真实回忆；AI 仅排列与摘录，手动修改请自行核实。\n\n' +
          chapters.map((c) => c.content).join('\n\n');
        return mutate((state) => {
          if (state.books.length >= 100) throw new AppError('LIMIT', '回忆录已达到数量上限', 413);
          const item = {
            id: randomUUID(),
            owner,
            title: input.title,
            content: content.slice(0, 35000),
            chapters,
            theme: input.theme,
            photos,
            sources: sources(records),
            createdAt: new Date().toISOString(),
            revision: randomUUID(),
          };
          state.books.push(item);
          return item;
        });
      }
      case 'book.update':
        return mutate(async (state) => {
          const item = requireOwner(state.books, input.id, owner);
          if (item.revision !== input.revision)
            throw new AppError('CONFLICT', '草稿已改变，请刷新', 409);
          item.title = input.title;
          item.content = input.content;
          if (input.chapters) {
            if (new Set(input.chapters.map((c) => c.id)).size !== input.chapters.length)
              throw new AppError('VALIDATION', '章节不能重复');
            for (const c of input.chapters) {
              const old = item.chapters.find((x) => x.id === c.id && x.memoryId === c.memoryId);
              if (!old || old.date !== c.date || old.place !== c.place)
                throw new AppError('VALIDATION', '不能修改章节来源、原始日期与地点');
              for (const p of c.photos) unwrap(await getPhoto(ctx, p.id));
            }
            item.chapters = input.chapters;
            item.photos = [
              ...new Map(input.chapters.flatMap((c) => c.photos).map((p) => [p.id, p])).values(),
            ];
            if (item.photos.length > 40) throw new AppError('LIMIT', '每册最多 40 张不同照片', 413);
          }
          if (input.theme) item.theme = input.theme;
          item.revision = randomUUID();
          return item;
        });
      case 'book.delete':
        return mutate((state) => {
          sameRevision(requireOwner(state.books, input.id, owner), input.revision);
          state.books = state.books.filter((x) => x.id !== input.id);
          return { deleted: true };
        });
      case 'plan.create': {
        const records = await memories(ctx, input.memoryIds);
        let result = {
          theme: input.title,
          schedule: [
            {
              activity: '一起重温所选回忆，安排散步与手写信交流（待确认）',
              minutes: Math.min(60, input.availableMinutes),
              cost: Math.round(input.budget * 0.6 * 100) / 100,
            },
          ],
          checklist: ['确认对方的时间与偏好', '准备手写信', '确认交通与天气'],
          copy: '想和你一起，把普通的一天变成新的回忆。',
          verify: [
            '价格为预算上限，不是商家报价；自行核实营业时间、天气、交通与预订条件',
            '剩余预算作为备用金；不执行购买、付款或消息发送',
          ],
          memories: records.map((r) => ({ memoryId: r.id, quote: r.story.slice(0, 400) })),
        };
        if (input.useAI) {
          const generated = await companionTask(ctx, 'surprise', records, input, provider, signal);
          if (!('schedule' in generated)) throw new AppError('AI_RESPONSE', '策划生成失败', 502);
          result = generated;
        }
        let elapsed = 0;
        const content = [
          '# ' + result.theme,
          '以下是未来活动建议，未经执行或核实。',
          '## 活动与预算安排',
          ...result.schedule.map((s) => {
            const start = elapsed;
            elapsed += s.minutes;
            return `- 第 ${start}–${elapsed} 分钟：${s.activity} · 预算 ${s.cost} ${input.currency}`;
          }),
          `备用金：${(input.budget - result.schedule.reduce((n, s) => n + s.cost, 0)).toFixed(2)} ${input.currency}`,
          '## 准备清单',
          ...result.checklist.map((s) => '- ' + s),
          '## 可编辑邀约文案',
          result.copy,
          '## 需要人工核实',
          ...result.verify.map((s) => '- ' + s),
          '## 真实回忆来源',
          ...result.memories.map((f) => `来源 ${f.memoryId}：${f.quote}`),
        ].join('\n\n');
        return mutate((state) => {
          if (state.plans.length >= 100) throw new AppError('LIMIT', '惊喜方案已达到数量上限', 413);
          const item = {
            id: randomUUID(),
            owner,
            title: input.title,
            content,
            availableMinutes: input.availableMinutes,
            budget: input.budget,
            currency: input.currency,
            date: input.date ?? null,
            place: input.place,
            sources: sources(records),
            createdAt: new Date().toISOString(),
            revision: randomUUID(),
          };
          state.plans.push(item);
          return item;
        });
      }
      case 'plan.update':
        return mutate((state) => {
          const item = requireOwner(state.plans, input.id, owner);
          if (item.revision !== input.revision)
            throw new AppError('CONFLICT', '方案已改变，请刷新', 409);
          item.content = input.content;
          item.revision = randomUUID();
          return item;
        });
      case 'plan.delete':
        return mutate((state) => {
          sameRevision(requireOwner(state.plans, input.id, owner), input.revision);
          state.plans = state.plans.filter((x) => x.id !== input.id);
          return { deleted: true };
        });
      case 'capsule.create': {
        if (input.unlockDate <= todayInShanghai())
          throw new AppError('VALIDATION', '时光胶囊必须设置未来的解锁日期', 422);
        return mutate(async (state) => {
          if (state.capsules.length >= 100)
            throw new AppError('LIMIT', '时光胶囊已达到数量上限', 413);
          if ((await listFiles('sealed')).length + input.photos.length > 2000)
            throw new AppError('LIMIT', '封存附件达到上限，请管理员归档备份后再创建', 413);
          const photos = [];
          for (const p of input.photos) {
            const bytes = unwrap(await getPhoto(ctx, p.id));
            const id = randomUUID();
            await atomicWrite('sealed', id + '.webp', bytes);
            photos.push({ id, alt: p.alt });
          }
          const item = {
            id: randomUUID(),
            owner,
            title: input.title,
            content: input.content,
            unlockDate: input.unlockDate,
            photos,
            revision: randomUUID(),
            createdAt: new Date().toISOString(),
          };
          state.capsules.push(item);
          return { ...item, owner: undefined, content: null, photos: [] };
        });
      }
      case 'capsule.delete':
        return mutate((state) => {
          sameRevision(requireOwner(state.capsules, input.id, owner), input.revision);
          state.capsules = state.capsules.filter((x) => x.id !== input.id);
          return { deleted: true };
        });
      case 'book.regenerate': {
        const book = requireOwner((await load()).books, input.id, owner);
        sameRevision(book, input.revision);
        const chapter = book.chapters.find((c) => c.id === input.chapterId);
        if (!chapter) throw new AppError('NOT_FOUND', '章节不存在', 404);
        const r = unwrap(await memoryService.getMemory(ctx, chapter.memoryId));
        let content = r.story;
        if (input.useAI) {
          const result = await companionTask(ctx, 'book', [r], {}, provider, signal);
          if ('chapters' in result) content = result.chapters[0].quote;
        }
        if (content.length > 20000) throw new AppError('LIMIT', '章节过长', 413);
        // 仅返回预览，必须由用户保存；来源版本仍保留快照，重新生成时禁止来源已经改变。
        if (!book.sources.some((s) => s.id === r.id && s.revision === r.revision))
          throw new AppError('CONFLICT', '原始回忆已更新，请重新创建回忆录', 409);
        return { ...chapter, content };
      }
      case 'notification.read':
        return mutate((state) => {
          const n = requireOwner(state.notifications, input.id, owner);
          n.read = true;
          return { read: true };
        });
      case 'reminders.save':
        return mutate((state) => {
          state.reminders[owner] = {
            enabled: input.enabled,
            timeZone: input.timeZone,
            since: state.reminders[owner]?.enabled
              ? state.reminders[owner].since
              : new Date().toISOString(),
            daysBefore: [...new Set(input.daysBefore)].sort((a, b) => b - a),
          };
          return state.reminders[owner];
        });
    }
  });
}

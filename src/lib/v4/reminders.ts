import 'server-only';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { requirePrivate } from '../auth/config';
import { AppError } from '../memory/errors';
import { readFile } from '../memory/storage';
import { anniversaryStateSchema, type Anniversary } from '../memory/model';
import { dateValue, nextAnniversary, daysBetween } from '../dates';
import { mutateV4 } from './store';
import type { V4ReminderPreference } from './model';

export function dateInZone(now: Date, zone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
const plusDays = (date: string, days: number) =>
  new Date(dateValue(date) + days * 86400000).toISOString().slice(0, 10);
export function dueReminders(
  items: Anniversary[],
  pref: V4ReminderPreference,
  from: string,
  to: string,
) {
  if (!pref.enabled) return [];
  const result: Array<{ event: Anniversary; occurrence: string; due: string; daysBefore: number }> =
    [];
  for (let date = from; date <= to; date = plusDays(date, 1))
    for (const event of items) {
      const occurrence = event.yearly ? nextAnniversary(event.date, date) : event.date;
      if (occurrence < event.date) continue;
      const days = daysBetween(date, occurrence);
      if (pref.daysBefore.includes(days as 0 | 1 | 7 | 30))
        result.push({ event, occurrence, due: date, daysBefore: days });
    }
  return result;
}
// 只持有任务凭据的进程可执行；没有用户身份伪造或 MemoryService/AI 访问能力。
export async function runReminderJob(authorization: string | null, now = new Date()) {
  requirePrivate();
  const token = process.env.LOVEVERSE_SCHEDULER_TOKEN;
  if (!token || !/^[a-f0-9]{64,128}$/.test(token))
    throw new AppError('CONFIG', '提醒任务凭据未配置', 503);
  const given = authorization?.replace(/^Bearer /, '') ?? '';
  if (
    Buffer.byteLength(given) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(token))
  )
    throw new AppError('UNAUTHORIZED', '任务认证失败', 401);
  return mutateV4(async (state) => {
    const raw = await readFile('state', 'anniversaries.json');
    const items = raw ? anniversaryStateSchema.parse(JSON.parse(raw.toString())).items : [];
    const accountFile = await readFile('auth', 'users.json');
    if (!accountFile) throw new AppError('CONFIG', '私人账号未初始化', 503);
    const users = z
      .array(z.object({ email: z.string().email() }))
      .max(2)
      .parse(JSON.parse(accountFile.toString()));
    const members = new Set(
      users.map((u) => createHash('sha256').update(u.email.toLowerCase()).digest('hex')),
    );
    let created = 0;
    const keys = new Set(state.notifications.map((n) => n.key));
    for (const [owner, pref] of Object.entries(state.reminders)) {
      if (!members.has(owner) || !pref.enabled) continue;
      const today = dateInZone(now, pref.timeZone);
      const start = pref.since ? dateInZone(new Date(pref.since), pref.timeZone) : today;
      const previous = state.lastRun ? dateInZone(new Date(state.lastRun), pref.timeZone) : start;
      const from = [start, previous, plusDays(today, -366)].sort().at(-1)!;
      for (const due of dueReminders(items, pref, from, today)) {
        const key = createHash('sha256')
          .update(`${owner}:${due.event.id}:${due.occurrence}:${due.daysBefore}`)
          .digest('hex');
        if (keys.has(key)) continue;
        state.notifications.push({
          id: randomUUID(),
          owner,
          key,
          title: due.event.title,
          date: due.occurrence,
          daysBefore: due.daysBefore,
          createdAt: now.toISOString(),
          read: false,
        });
        keys.add(key);
        created++;
      }
    }
    state.lastRun = now.toISOString();
    // 保留超过补偿窗口的去重记录；超过容量时整笔失败，不能悄悄丢通知。
    state.notifications = state.notifications.filter(
      (n) => Date.parse(n.createdAt) >= now.getTime() - 400 * 86400000,
    );
    if (state.notifications.length > 10000)
      throw new AppError('LIMIT', '通知记录达到上限，请管理员归档', 413);
    return { processed: true, created };
  });
}

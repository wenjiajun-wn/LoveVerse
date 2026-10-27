import 'server-only';
import { z } from 'zod';
import { authorize, type IdentityContext } from '../auth/session';
import { atomicWrite, readFile, withLock } from '../memory/storage';
import { AppError } from '../memory/errors';
const schema = z.object({
  hour: z.number(),
  hourly: z.number(),
  day: z.number(),
  daily: z.number(),
});
// 全空间共享限额，失败也计入，重启不重置；不记录问题、邮箱或原文。
export async function reserveBudget(ctx: IdentityContext) {
  await authorize(ctx);
  return reserveCounter('agent-budget.json');
}
export async function reserveDemoBudget() {
  if (
    process.env.LOVEVERSE_MODE === 'private' ||
    process.env.LOVEVERSE_AI_PUBLIC_DEMO !== 'true' ||
    process.env.LOVEVERSE_AI_ENABLED !== 'true'
  )
    throw new AppError('DEMO_DISABLED', '公开 AI 演示尚未启用', 403);
  return reserveCounter('agent-demo-budget.json');
}
async function reserveCounter(name: 'agent-budget.json' | 'agent-demo-budget.json') {
  await withLock(async () => {
    const now = Date.now();
    const hour = Math.floor(now / 3600000);
    const day = Math.floor(now / 86400000);
    const file = await readFile('state', name);
    const old = file
      ? schema.parse(JSON.parse(file.toString()))
      : { hour, hourly: 0, day, daily: 0 };
    const current = {
      hour,
      day,
      hourly: old.hour === hour ? old.hourly : 0,
      daily: old.day === day ? old.daily : 0,
    };
    if (current.hourly >= 6 || current.daily >= 30)
      throw new AppError('RATE_LIMIT', 'AI 使用达到本小时或今日限额，请稍后再试', 429);
    current.hourly++;
    current.daily++;
    await atomicWrite('state', name, JSON.stringify(current));
  });
}

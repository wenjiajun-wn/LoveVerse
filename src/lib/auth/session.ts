import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { atomicWrite, readFile, removeFile, withLock } from '../memory/storage';
import { AppError } from '../memory/errors';
import { appOrigin, requirePrivate } from './config';
import { verifyPassword } from './password';
export const COOKIE = 'loveverse_session';
const accountsSchema = z
  .array(
    z
      .object({
        email: z.string().email(),
        passwordHash: z.string().regex(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/),
      })
      .strict(),
  )
  .min(1)
  .max(2);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export type IdentityContext = Readonly<{ userId: string; role: 'member'; expiresAt: number }>;
const contexts = new WeakMap<IdentityContext, string>();
async function accounts() {
  const file = await readFile('auth', 'users.json');
  if (!file) throw new AppError('CONFIG', '私人账号未初始化，请先运行设置命令', 503);
  try {
    return accountsSchema.parse(JSON.parse(file.toString()));
  } catch {
    throw new AppError('CONFIG', '账号配置损坏', 503);
  }
}
const sessionSchema = z.object({
  userId: z.string(),
  expiresAt: z.number(),
  credential: z.string(),
});
async function sessionFor(key: string) {
  requirePrivate();
  appOrigin();
  const data = await readFile('sessions', `${key}.json`);
  if (!data) throw new AppError('UNAUTHORIZED', '请先登录私人空间', 401);
  let session;
  try {
    session = sessionSchema.parse(JSON.parse(data.toString()));
  } catch {
    throw new AppError('UNAUTHORIZED', '会话无效，请重新登录', 401);
  }
  const user = (await accounts()).find((a) => a.email === session.userId);
  if (!user || session.expiresAt <= Date.now() || session.credential !== digest(user.passwordHash))
    throw new AppError('UNAUTHORIZED', '会话已过期，请重新登录', 401);
  return session;
}
export async function authenticate(request: Request): Promise<IdentityContext> {
  requirePrivate();
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE + '='))
    ?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new AppError('UNAUTHORIZED', '请先登录私人空间', 401);
  const key = digest(token);
  const session = await sessionFor(key);
  const context = Object.freeze({
    userId: session.userId,
    role: 'member' as const,
    expiresAt: session.expiresAt,
  });
  contexts.set(context, key);
  return context;
}
export async function authorize(context: IdentityContext) {
  const key = contexts.get(context);
  if (!key) throw new AppError('UNAUTHORIZED', '工具调用缺少有效身份上下文', 401);
  await sessionFor(key);
}
// 仅服务端使用：绑定 AI 同意到当前账号集合；密码或成员变化后重新征求同意。
export async function consentMembers(context: IdentityContext) {
  await authorize(context);
  const users = await accounts();
  return {
    self: digest(context.userId.toLowerCase()),
    members: [...new Set(users.map((u) => digest(u.email.toLowerCase())))].sort(),
    fingerprint: digest(
      users
        .map((u) => `${u.email}:${u.passwordHash}`)
        .sort()
        .join('|'),
    ),
  };
}
export async function login(email: string, password: string) {
  requirePrivate();
  appOrigin();
  return withLock(async () => {
    const file = await readFile('auth', 'attempts.json');
    let attempts: { count: number; reset: number };
    try {
      attempts = file
        ? z
            .object({ count: z.number().int().nonnegative(), reset: z.number() })
            .parse(JSON.parse(file.toString()))
        : { count: 0, reset: Date.now() + 15 * 60000 };
    } catch {
      throw new AppError('CONFIG', '登录限速记录损坏，请管理员检查', 503);
    }
    if (attempts.reset <= Date.now()) attempts = { count: 0, reset: Date.now() + 15 * 60000 };
    if (attempts.count >= 10)
      throw new AppError('RATE_LIMIT', '尝试次数过多，请 15 分钟后再试', 429);
    attempts.count++;
    await atomicWrite('auth', 'attempts.json', JSON.stringify(attempts));
    const users = await accounts();
    const user = users.find((a) => a.email.toLowerCase() === email.toLowerCase());
    const valid = await verifyPassword(password, user?.passwordHash ?? users[0].passwordHash);
    if (!valid || !user) throw new AppError('UNAUTHORIZED', '邮箱或密码不正确', 401);
    const token = randomBytes(32).toString('hex');
    await atomicWrite(
      'sessions',
      `${digest(token)}.json`,
      JSON.stringify({
        userId: user.email,
        credential: digest(user.passwordHash),
        expiresAt: Date.now() + 12 * 3600000,
      }),
    );
    await atomicWrite(
      'auth',
      'attempts.json',
      JSON.stringify({ count: 0, reset: Date.now() + 15 * 60000 }),
    );
    return token;
  });
}
export async function logout(context: IdentityContext) {
  await authorize(context);
  const key = contexts.get(context)!;
  await withLock(() => removeFile('sessions', `${key}.json`));
  contexts.delete(context);
}
export function sessionCookie(token: string, clear = false) {
  return `${COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 43200}${appOrigin().protocol === 'https:' ? '; Secure' : ''}`;
}

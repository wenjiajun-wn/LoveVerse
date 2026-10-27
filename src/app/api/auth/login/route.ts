import { z } from 'zod';
import { boundedBody, handle, privateHeaders } from '@/lib/api';
import { checkOrigin, requirePrivate } from '@/lib/auth/config';
import { login, sessionCookie } from '@/lib/auth/session';
import { AppError } from '@/lib/memory/errors';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return handle(async () => {
    requirePrivate();
    checkOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new AppError('CONTENT_TYPE', '登录请求必须为 JSON', 415);
    let body;
    try {
      body = JSON.parse((await boundedBody(request, 2048)).toString());
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('JSON', '登录格式无效');
    }
    const data = z
      .object({ email: z.string().email().max(160), password: z.string().min(1).max(256) })
      .strict()
      .parse(body);
    const token = await login(data.email, data.password);
    return Response.json(
      { ok: true, data: { email: data.email } },
      { headers: { ...privateHeaders, 'Set-Cookie': sessionCookie(token) } },
    );
  });
}

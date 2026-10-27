import 'server-only';
import { ZodError } from 'zod';
import { AppError, type Result } from './memory/errors';
import { authenticate, type IdentityContext } from './auth/session';
import { checkOrigin } from './auth/config';
export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie',
};
const codes: Record<string, number> = {
  UNAUTHORIZED: 401,
  PRIVATE_DISABLED: 403,
  ORIGIN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ALREADY_IMPORTED: 409,
  RATE_LIMIT: 429,
  LIMIT: 413,
  CORRUPT: 422,
  CONFIG: 503,
  BUSY: 503,
  STORAGE: 500,
};
export function jsonResult<T>(result: Result<T>, success = 200) {
  return Response.json(result, {
    status: result.ok ? success : codes[result.error.code] || 400,
    headers: privateHeaders,
  });
}
export async function handle(action: () => Promise<Response>): Promise<Response> {
  try {
    return await action();
  } catch (e) {
    if (e instanceof AppError)
      return Response.json(
        { ok: false, error: { code: e.code, message: e.message } },
        { status: e.status, headers: privateHeaders },
      );
    if (e instanceof ZodError)
      return jsonResult({
        ok: false,
        error: { code: 'VALIDATION', message: '输入格式无效，请检查必填字段、长度和日期' },
      });
    return jsonResult({
      ok: false,
      error: { code: 'STORAGE', message: '服务暂时不可用，请检查配置或存储' },
    });
  }
}
export function privateRoute(
  request: Request,
  action: (ctx: IdentityContext) => Promise<Response>,
) {
  return handle(async () => {
    const context = await authenticate(request);
    if (!['GET', 'HEAD'].includes(request.method)) checkOrigin(request);
    return action(context);
  });
}
export async function boundedBody(request: Request, max = 220000) {
  const length = request.headers.get('content-length');
  if (length && Number(length) > max) throw new AppError('LIMIT', '请求内容过大', 413);
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new AppError('LIMIT', '请求内容过大', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AppError('CONTENT_TYPE', '请求必须为 JSON', 415);
  try {
    return JSON.parse((await boundedBody(request)).toString());
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('JSON', 'JSON 格式无效');
  }
}

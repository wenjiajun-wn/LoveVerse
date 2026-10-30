import type { Result } from './memory/errors';
export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ClientError('NETWORK', '网络连接失败，请重试；尚未确认的修改不会丢弃');
  }
  if (response.status === 401 && !url.endsWith('/login'))
    window.dispatchEvent(new Event('loveverse-auth-lost'));
  let result: Result<T>;
  try {
    result = await response.json();
    if (
      !result ||
      typeof result.ok !== 'boolean' ||
      (!result.ok &&
        (typeof result.error?.code !== 'string' || typeof result.error?.message !== 'string'))
    )
      throw Error();
  } catch {
    throw new ClientError('RESPONSE', '服务返回了无效响应，请稍后重试；尚未确认的修改不会丢弃');
  }
  if (!result.ok) {
    throw new ClientError(result.error.code, result.error.message);
  }
  if (!response.ok) throw new ClientError('RESPONSE', '请求未成功，请稍后重试');
  return result.data;
}

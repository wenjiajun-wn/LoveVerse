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
  const result: Result<T> = await response.json();
  if (!result.ok) {
    if (response.status === 401 && !url.endsWith('/login'))
      window.dispatchEvent(new Event('loveverse-auth-lost'));
    throw new ClientError(result.error.code, result.error.message);
  }
  return result.data;
}

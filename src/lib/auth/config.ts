import 'server-only';
import { AppError } from '../memory/errors';
export function privateMode() {
  return process.env.LOVEVERSE_MODE === 'private';
}
export function requirePrivate() {
  if (!privateMode()) throw new AppError('PRIVATE_DISABLED', '公开演示环境不提供私人数据接口', 403);
}
export function appOrigin() {
  const raw = process.env.LOVEVERSE_ORIGIN;
  if (!raw) throw new AppError('CONFIG', '请先配置私人站点地址', 503);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError('CONFIG', '私人站点地址无效', 503);
  }
  if (
    url.origin !== raw ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  )
    throw new AppError('CONFIG', '远程私人站点必须使用 HTTPS 且仅填写 origin', 503);
  return url;
}
export function checkOrigin(request: Request) {
  if (
    request.headers.get('origin') !== appOrigin().origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new AppError('ORIGIN', '请求来源不受信任', 403);
}

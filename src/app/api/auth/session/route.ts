import { getCoupleProfile } from '@/lib/auth/couple';
import { handle, jsonResult, privateHeaders, privateRoute } from '@/lib/api';
import { authenticate, logout, sessionCookie } from '@/lib/auth/session';
import { privateMode } from '@/lib/auth/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return handle(async () => {
    if (!privateMode()) return jsonResult({ ok: true, data: { mode: 'demo', user: null } });
    const user = await authenticate(request);
    return jsonResult({
      ok: true,
      data: { mode: 'private', user: { email: user.userId }, couple: await getCoupleProfile(user) },
    });
  });
}
export function DELETE(request: Request) {
  return privateRoute(request, async (ctx) => {
    await logout(ctx);
    return Response.json(
      { ok: true, data: null },
      { headers: { ...privateHeaders, 'Set-Cookie': sessionCookie('', true) } },
    );
  });
}

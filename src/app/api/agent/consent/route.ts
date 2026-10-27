import { privateRoute, jsonBody, jsonResult } from '@/lib/api';
import { consentStatus, saveConsent } from '@/lib/agent/consent';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult({ ok: true, data: await consentStatus(ctx) }),
  );
}
export async function PUT(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult({ ok: true, data: await saveConsent(ctx, await jsonBody(request)) }),
  );
}

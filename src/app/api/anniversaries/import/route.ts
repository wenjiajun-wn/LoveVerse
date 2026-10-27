import { jsonBody, jsonResult, privateRoute } from '@/lib/api';
import { importAnniversaries } from '@/lib/memory/anniversaries';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult(await importAnniversaries(ctx, await jsonBody(request))),
  );
}

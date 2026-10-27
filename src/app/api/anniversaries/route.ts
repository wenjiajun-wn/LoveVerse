import { jsonBody, jsonResult, privateRoute } from '@/lib/api';
import { getAnniversaries, saveAnniversaries } from '@/lib/memory/anniversaries';
export const runtime = 'nodejs';
export function GET(request: Request) {
  return privateRoute(request, async (ctx) => jsonResult(await getAnniversaries(ctx)));
}
export function PUT(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult(await saveAnniversaries(ctx, await jsonBody(request))),
  );
}

import { jsonBody, jsonResult, privateRoute } from '@/lib/api';
import { dispatchV4, getV4Dashboard } from '@/lib/v4/service';
export const runtime = 'nodejs';
export function GET(request: Request) {
  return privateRoute(request, async (ctx) => jsonResult(await getV4Dashboard(ctx)));
}
export function POST(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult(
      await dispatchV4(ctx, await jsonBody(request, 1024 * 1024), undefined, request.signal),
    ),
  );
}

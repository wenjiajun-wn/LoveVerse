import { jsonBody, jsonResult, privateRoute } from '@/lib/api';
import { memoryService } from '@/lib/memory/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult(
      await memoryService.searchMemories(
        ctx,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    ),
  );
}
export function POST(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult(await memoryService.createMemory(ctx, await jsonBody(request)), 201),
  );
}

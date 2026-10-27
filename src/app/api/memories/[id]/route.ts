import { z } from 'zod';
import { jsonBody, jsonResult, privateRoute } from '@/lib/api';
import { memoryService } from '@/lib/memory/service';
import { memoryInputSchema } from '@/lib/memory/model';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export function GET(request: Request, context: Context) {
  return privateRoute(request, async (ctx) =>
    jsonResult(await memoryService.getMemory(ctx, (await context.params).id)),
  );
}
export function PUT(request: Request, context: Context) {
  return privateRoute(request, async (ctx) => {
    const body = z
      .object({ input: memoryInputSchema, revision: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(await jsonBody(request));
    return jsonResult(
      await memoryService.updateMemory(ctx, (await context.params).id, body.input, body.revision),
    );
  });
}
export function DELETE(request: Request, context: Context) {
  return privateRoute(request, async (ctx) => {
    const body = z
      .object({ revision: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) })
      .strict()
      .parse(await jsonBody(request));
    return jsonResult(
      await memoryService.deleteMemory(
        ctx,
        (await context.params).id,
        body.revision,
        body.confirmed,
      ),
    );
  });
}

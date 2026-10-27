import { z } from 'zod';
import { jsonBody, jsonResult, privateHeaders, privateRoute } from '@/lib/api';
import { deletePhoto, getPhoto } from '@/lib/memory/uploads';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export function GET(request: Request, context: Context) {
  return privateRoute(request, async (ctx) => {
    const result = await getPhoto(ctx, (await context.params).id);
    return result.ok
      ? new Response(new Uint8Array(result.data), {
          headers: {
            ...privateHeaders,
            'Content-Type': 'image/webp',
            'Content-Disposition': 'inline; filename="memory.webp"',
            'Content-Security-Policy': "default-src 'none'; sandbox",
          },
        })
      : jsonResult(result);
  });
}
export function DELETE(request: Request, context: Context) {
  return privateRoute(request, async (ctx) => {
    const body = z
      .object({ confirmed: z.literal(true) })
      .strict()
      .parse(await jsonBody(request));
    return jsonResult(await deletePhoto(ctx, (await context.params).id, body.confirmed));
  });
}

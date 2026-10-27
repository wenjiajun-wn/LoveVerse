import { boundedBody, jsonResult, privateRoute } from '@/lib/api';
import { listPhotos, MAX_UPLOAD, uploadPhoto } from '@/lib/memory/uploads';
export const runtime = 'nodejs';
export function GET(request: Request) {
  return privateRoute(request, async (ctx) => jsonResult(await listPhotos(ctx)));
}
export function POST(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult(
      await uploadPhoto(
        ctx,
        await boundedBody(request, MAX_UPLOAD),
        request.headers.get('content-type') || '',
      ),
      201,
    ),
  );
}

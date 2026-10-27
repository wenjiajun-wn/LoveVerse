import { privateRoute, jsonBody, jsonResult } from '@/lib/api';
import { answerQuestion } from '@/lib/agent/service';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return privateRoute(request, async (ctx) =>
    jsonResult({
      ok: true,
      data: await answerQuestion(ctx, await jsonBody(request), request.signal),
    }),
  );
}

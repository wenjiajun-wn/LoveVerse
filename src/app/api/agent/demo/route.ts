import { handle, jsonBody, jsonResult } from '@/lib/api';
import { checkOrigin } from '@/lib/auth/config';
import { answerDemoQuestion, demoAvailable } from '@/lib/agent/demo';
export const runtime = 'nodejs';
export async function GET() {
  return jsonResult({ ok: true, data: { available: demoAvailable() } });
}
export async function POST(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    return jsonResult({
      ok: true,
      data: await answerDemoQuestion(await jsonBody(request), request.signal),
    });
  });
}

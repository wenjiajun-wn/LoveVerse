import { handle, privateHeaders } from '@/lib/api';
import { runReminderJob } from '@/lib/v4/reminders';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return handle(async () =>
    Response.json(
      { ok: true, data: await runReminderJob(request.headers.get('authorization')) },
      { headers: privateHeaders },
    ),
  );
}

import { jsonBody, privateHeaders, privateRoute } from '@/lib/api';
import { exportBookPDF } from '@/lib/v4/pdf';
import { z } from 'zod';
export const runtime = 'nodejs';
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return privateRoute(request, async (ctx) => {
    const { revision } = z
      .object({ revision: z.string().uuid() })
      .strict()
      .parse(await jsonBody(request));
    const pdf = await exportBookPDF(ctx, (await params).id, revision);
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...privateHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="LoveVerse-memory-book.pdf"',
      },
    });
  });
}

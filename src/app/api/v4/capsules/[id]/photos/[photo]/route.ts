import { privateRoute, privateHeaders } from '@/lib/api';
import { loadV4 } from '@/lib/v4/store';
import { uuid } from '@/lib/memory/model';
import { readFile } from '@/lib/memory/storage';
import { AppError } from '@/lib/memory/errors';
import { todayInShanghai } from '@/lib/dates';
export const runtime = 'nodejs';
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; photo: string }> },
) {
  return privateRoute(request, async () => {
    const { id, photo } = await params;
    uuid.parse(id);
    uuid.parse(photo);
    const capsule = (await loadV4()).capsules.find((c) => c.id === id);
    if (
      !capsule ||
      capsule.unlockDate > todayInShanghai() ||
      !capsule.photos.some((p) => p.id === photo)
    )
      throw new AppError('NOT_FOUND', '附件不存在或尚未解锁', 404);
    const bytes = await readFile('sealed', photo + '.webp', 8 * 1024 * 1024);
    if (!bytes) throw new AppError('NOT_FOUND', '附件不存在', 404);
    return new Response(new Uint8Array(bytes), {
      headers: { ...privateHeaders, 'Content-Type': 'image/webp' },
    });
  });
}

import { LoveVerse } from '@/components/love-verse';
import { MemoryProvider } from '@/components/memory-provider';
import { privateMode } from '@/lib/auth/config';
export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <MemoryProvider mode={privateMode() ? 'private' : 'demo'}>
      <LoveVerse />
    </MemoryProvider>
  );
}

import 'server-only';
import { dateValue } from '../dates';
import type { CoupleProfile } from '../couple';
import { authorize, type IdentityContext } from './session';

/** Only authenticated callers may read server configuration. Missing/invalid fields stay empty. */
export async function getCoupleProfile(ctx: IdentityContext): Promise<CoupleProfile> {
  await authorize(ctx);
  const names = process.env.LOVEVERSE_COUPLE_NAMES?.trim();
  const start = process.env.LOVEVERSE_COUPLE_START?.trim();
  let validStart: string | null = null;
  try {
    if (start) {
      dateValue(start);
      validStart = start;
    }
  } catch {
    /* no demo fallback */
  }
  return { names: names && names.length <= 80 ? names : null, start: validStart };
}

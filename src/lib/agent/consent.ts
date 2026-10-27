import 'server-only';
import { z } from 'zod';
import { consentMembers, type IdentityContext } from '../auth/session';
import { atomicWrite, readFile, withLock } from '../memory/storage';
import { memoryService } from '../memory/service';
import { AppError, type Result } from '../memory/errors';
import { uuid, type MemoryRecord } from '../memory/model';
import type { ConsentStatus } from './types';

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok)
    throw new AppError(
      result.error.code,
      result.error.message,
      result.error.code === 'UNAUTHORIZED' ? 401 : 400,
    );
  return result.data;
}
const selection = z.object({ id: uuid, revision: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const consentInput = z
  .object({
    enabled: z.boolean(),
    confirmed: z.literal(true),
    selected: z.array(selection).max(1000),
  })
  .strict();
const grant = z.object({ enabled: z.boolean(), selected: z.array(selection).max(1000) }).strict();
const schema = z.object({ fingerprint: z.string(), grants: z.record(z.string(), grant) }).strict();
async function load(ctx: IdentityContext) {
  const identities = await consentMembers(ctx);
  const file = await readFile('state', 'agent-consent.json', 512000);
  const parsed = file ? schema.safeParse(JSON.parse(file.toString())) : null;
  if (parsed && !parsed.success) throw new AppError('CONFIG', 'AI 同意记录损坏，请管理员检查', 503);
  const state =
    parsed?.success && parsed.data.fingerprint === identities.fingerprint
      ? parsed.data
      : { fingerprint: identities.fingerprint, grants: {} as z.infer<typeof schema>['grants'] };
  return { ...identities, state };
}
export const aiEnabled = () => process.env.LOVEVERSE_AI_ENABLED === 'true';
export function shareable(record: MemoryRecord) {
  return (
    record.metadata.secret !== true &&
    record.metadata.sensitivity !== 'secret' &&
    record.metadata.allowThirdParty !== false
  );
}
export async function consentStatus(ctx: IdentityContext): Promise<ConsentStatus> {
  const { self, members, state } = await load(ctx);
  const approvals = members.filter((m) => state.grants[m]?.enabled).length;
  const ready = aiEnabled() && members.length === 2 && approvals === 2;
  const records = unwrap(await memoryService.listMemories(ctx));
  const sharedIds = ready
    ? records
        .filter(
          (r) =>
            shareable(r) &&
            members.every((m) =>
              state.grants[m]?.selected.some((s) => s.id === r.id && s.revision === r.revision),
            ),
        )
        .map((r) => r.id)
    : [];
  return {
    available: aiEnabled(),
    enabled: state.grants[self]?.enabled ?? false,
    ready,
    memberCount: members.length,
    approvals,
    selected: state.grants[self]?.selected ?? [],
    sharedIds,
  };
}
export async function saveConsent(ctx: IdentityContext, value: unknown) {
  const input = consentInput.parse(value);
  await withLock(async () => {
    const { self, state } = await load(ctx);
    for (const item of input.enabled ? input.selected : []) {
      const record = unwrap(await memoryService.getMemory(ctx, item.id));
      if (!shareable(record) || record.revision !== item.revision)
        throw new AppError('CONFLICT', '回忆已更新或禁止第三方共享，请刷新后重新选择', 409);
    }
    state.grants[self] = { enabled: input.enabled, selected: input.enabled ? input.selected : [] };
    await atomicWrite('state', 'agent-consent.json', JSON.stringify(state), true);
  });
  return consentStatus(ctx);
}
export async function requireConsent(ctx: IdentityContext) {
  const status = await consentStatus(ctx);
  if (!status.ready)
    throw new AppError('CONSENT', '请先由双方分别同意启用云端 AI；管理员也需启用 AI 配置', 403);
  return status;
}
export async function sharedRecord(ctx: IdentityContext, id: string, revision?: string) {
  const status = await requireConsent(ctx);
  if (!status.sharedIds.includes(id))
    throw new AppError('FORBIDDEN', '该来源尚未获得双方当前版本授权', 403);
  const record = unwrap(await memoryService.getMemory(ctx, id));
  // 再检查版本，防止从许可快照到读取之间出现编辑。
  const { members, state } = await load(ctx);
  if (
    !shareable(record) ||
    (revision && record.revision !== revision) ||
    !members.every(
      (m) =>
        state.grants[m]?.enabled &&
        state.grants[m].selected.some((s) => s.id === id && s.revision === record.revision),
    )
  )
    throw new AppError('FORBIDDEN', '来源已变更，请重新授权后提问', 403);
  return record;
}

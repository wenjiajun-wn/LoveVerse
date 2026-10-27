import 'server-only';
import { z } from 'zod';
import { AppError } from '../memory/errors';
export type ToolDefinition = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
};
export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
};
export interface AIProvider {
  complete(
    messages: Message[],
    tools: ToolDefinition[],
    signal: AbortSignal,
  ): Promise<{ message: Message; tokens: number; model?: string }>;
}
const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.literal('assistant'),
          content: z.string().max(16000).nullable().optional(),
          reasoning_content: z.string().max(16000).optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().min(1).max(150),
                type: z.literal('function'),
                function: z.object({ name: z.string().max(100), arguments: z.string().max(3000) }),
              }),
            )
            .max(3)
            .optional(),
        }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(1),
  usage: z.object({ total_tokens: z.number().int().nonnegative() }).optional(),
});
export function providerConfig() {
  const key = process.env.DEEPSEEK_API_KEY;
  const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  // 其他提供方可替换 Provider；生产配置不接受任意地址或重定向来转发密钥。
  if (
    !key ||
    !['https://api.deepseek.com', 'https://api.deepseek.com/'].includes(base) ||
    !/^[a-zA-Z0-9._-]{1,80}$/.test(model)
  )
    throw new AppError('AI_CONFIG', 'AI 尚未配置，请管理员检查服务端 DeepSeek 配置', 503);
  return { key, base: base.replace(/\/$/, ''), model };
}
export class DeepSeekProvider implements AIProvider {
  constructor(private transport: typeof fetch = fetch) {}
  async complete(messages: Message[], tools: ToolDefinition[], signal: AbortSignal) {
    const { key, base, model } = providerConfig();
    const body = JSON.stringify({
      model,
      messages,
      tools,
      thinking: { type: 'disabled' },
      stream: false,
      max_tokens: 1600,
    });
    if (Buffer.byteLength(body) > 22000)
      throw new AppError('AI_BUDGET', '问题与来源上下文超出预算，请缩小问题范围', 413);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        signal.throwIfAborted();
        const response = await this.transport(`${base}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
          redirect: 'error',
        });
        if (response.status === 429 || response.status >= 500) {
          await response.body?.cancel();
          if (attempt === 0 && !signal.aborted) {
            await new Promise<void>((resolve, reject) => {
              const stop = () => {
                clearTimeout(timer);
                reject(new Error('aborted'));
              };
              const timer = setTimeout(() => {
                signal.removeEventListener('abort', stop);
                resolve();
              }, 500);
              signal.addEventListener('abort', stop, { once: true });
            });
            continue;
          }
          throw new AppError(
            'AI_UNAVAILABLE',
            'DeepSeek 暂时繁忙，请稍后重试；回忆管理仍可使用',
            503,
          );
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new AppError('AI_UNAVAILABLE', 'DeepSeek 请求失败，请检查配置或稍后重试', 503);
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('empty');
        let size = 0;
        const chunks: Uint8Array[] = [];
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 100000) {
              await reader.cancel();
              throw new Error('oversized');
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const parsed = responseSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString()));
        if (!parsed.success || parsed.data.choices[0].finish_reason === 'length')
          throw new AppError('AI_RESPONSE', 'AI 回复格式不完整，请缩小问题范围后重试', 502);
        const m = parsed.data.choices[0].message;
        return {
          message: { ...m, content: m.content ?? null } as Message,
          tokens: parsed.data.usage?.total_tokens ?? 0,
          model,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          signal.aborted ? 'AI_CANCELLED' : 'AI_TIMEOUT',
          signal.aborted ? '请求已取消或达到总时限' : 'AI 连接超时或响应异常，请重试',
          503,
        );
      }
    }
    throw new AppError('AI_UNAVAILABLE', 'AI 暂时不可用', 503);
  }
}

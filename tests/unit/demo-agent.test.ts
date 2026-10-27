import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { memoryService } from '../../src/lib/memory/service';
import { DeepSeekProvider, type AIProvider, type Message } from '../../src/lib/agent/provider';
import { answerDemoQuestion, executeDemoTool } from '../../src/lib/agent/demo';
import { reserveDemoBudget } from '../../src/lib/agent/budget';
import { POST } from '../../src/app/api/agent/demo/route';
import { GET as privateMemories } from '../../src/app/api/memories/route';
import type { Citation } from '../../src/lib/agent/types';
let root: string;
let original: NodeJS.ProcessEnv;
beforeEach(async () => {
  original = { ...process.env };
  root = await fs.mkdtemp(path.join(tmpdir(), 'loveverse-demo-unit-'));
  Object.assign(process.env, {
    LOVEVERSE_MODE: 'demo',
    LOVEVERSE_AI_ENABLED: 'true',
    LOVEVERSE_AI_PUBLIC_DEMO: 'true',
    LOVEVERSE_DATA_DIR: root,
    LOVEVERSE_ORIGIN: 'http://localhost:3000',
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(async () => {
  process.env = original;
  vi.restoreAllMocks();
  if (
    path.dirname(root) !== path.resolve(tmpdir()) ||
    !path.basename(root).startsWith('loveverse-demo-unit-')
  )
    throw Error('非法清理路径');
  await fs.rm(root, { recursive: true, force: true });
});
function fake(): AIProvider {
  return {
    complete: vi.fn(async (messages: Message[]) => {
      const result = messages.findLast((m) => m.role === 'tool');
      if (!result)
        return {
          message: {
            role: 'assistant' as const,
            content: null,
            tool_calls: [
              {
                id: 'demo-call',
                type: 'function' as const,
                function: { name: 'search_memories', arguments: '{"q":"海边"}' },
              },
            ],
          },
          tokens: 10,
          model: 'mock',
        };
      const sources: Citation[] = JSON.parse(result.content!).untrusted_memory_data;
      return {
        message: {
          role: 'assistant' as const,
          content: JSON.stringify({
            facts: sources.map((s) => ({ text: s.place, sources: [s.id] })),
            inferences: [],
            unknowns: [],
          }),
        },
        tokens: 10,
        model: 'mock',
      };
    }),
  };
}
it('无账号也能经真实演示路由问答，且不调用私人 MemoryService', async () => {
  for (const method of ['listMemories', 'getMemory', 'searchMemories'] as const)
    vi.spyOn(memoryService, method).mockImplementation(async () => {
      throw Error('禁止访问私人服务');
    });
  const provider = fake();
  vi.spyOn(DeepSeekProvider.prototype, 'complete').mockImplementation(async (...args) => ({
    ...(await provider.complete(...args)),
    model: 'mock',
  }));
  const response = await POST(
    new Request('http://localhost:3000/api/agent/demo', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '第一次旅行去了哪里？', consent: true }),
    }),
  );
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.data.citations[0].memoryId).toBe('trip');
  expect(result.data.facts[0].text).toBe('海边 · 蓝色海岸');
  expect(result.data.citations[0].sourcePath).toMatch(/^demo:/);
  expect(await fs.readdir(root)).toEqual(['state']);
  expect(memoryService.listMemories).not.toHaveBeenCalled();
});
it('公开入口不能访问任意私人 ID、路径、写工具或图片', async () => {
  const evidence = new Map<string, Citation>();
  await expect(
    executeDemoTool('get_memory', '{"id":"00000000-0000-4000-8000-000000000000"}', evidence),
  ).rejects.toThrow();
  await expect(
    executeDemoTool('get_memory', '{"id":"../../auth/users.json"}', evidence),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(executeDemoTool('delete_memory', '{}', evidence)).rejects.toMatchObject({
    code: 'AI_TOOL',
  });
  const result = await executeDemoTool('list_memories', '{"limit":1}', evidence);
  expect(JSON.stringify(result)).not.toContain('image');
  expect((await privateMemories(new Request('http://localhost:3000/api/memories'))).status).toBe(
    403,
  );
});
it('独立开关、访客同意、Origin 和私人模式边界均有效', async () => {
  const provider = fake();
  await expect(
    answerDemoQuestion({ message: '海边', consent: false }, new AbortController().signal, provider),
  ).rejects.toThrow();
  const badOrigin = new Request('http://localhost:3000/api/agent/demo', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect((await POST(badOrigin)).status).toBe(403);
  process.env.LOVEVERSE_AI_PUBLIC_DEMO = 'false';
  await expect(
    answerDemoQuestion({ message: '海边', consent: true }, new AbortController().signal, provider),
  ).rejects.toMatchObject({ code: 'DEMO_DISABLED' });
  process.env.LOVEVERSE_AI_PUBLIC_DEMO = 'true';
  process.env.LOVEVERSE_MODE = 'private';
  await expect(
    answerDemoQuestion({ message: '海边', consent: true }, new AbortController().signal, provider),
  ).rejects.toMatchObject({ code: 'DEMO_DISABLED' });
  expect(provider.complete).not.toHaveBeenCalled();
});
it('全站公开限额持久化，不与私人额度混用', async () => {
  for (let i = 0; i < 6; i++) await reserveDemoBudget();
  await expect(reserveDemoBudget()).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  expect(await fs.readdir(path.join(root, 'state'))).toEqual(['agent-demo-budget.json']);
});
it('演示模型也必须使用真实片段引用，不能编造来源', async () => {
  const provider = fake();
  const complete = provider.complete;
  provider.complete = async (...args) => {
    const response = await complete(...args);
    if (args[0].some((m) => m.role === 'tool'))
      response.message.content = JSON.stringify({
        facts: [{ text: '海边', sources: ['f'.repeat(24)] }],
        inferences: [],
        unknowns: [],
      });
    return response;
  };
  await expect(
    answerDemoQuestion({ message: '海边', consent: true }, new AbortController().signal, provider),
  ).rejects.toMatchObject({ code: 'AI_CITATION' });
});

import { afterEach, expect, it, vi } from 'vitest';
import { memoryQuiz } from '../../src/lib/memory/quiz';
import { api } from '../../src/lib/client-api';
import type { MemoryView } from '../../src/lib/memory/adapter';
afterEach(() => vi.unstubAllGlobals());
const records: MemoryView[] = ['2020-01-01', '2021-02-02', '2022-03-03'].map((date, i) => ({
  id: String(i),
  date,
  title: `测试记录${i}`,
  category: '测试',
  place: '测试地点',
  story: '虚构测试夹具',
  image: '',
  color: 'blue',
  private: true,
}));
it('私人题库仅使用真实传入记录，记录不足时为空', () => {
  expect(memoryQuiz([])).toEqual([]);
  expect(memoryQuiz(records.slice(0, 2))).toEqual([]);
  const quiz = memoryQuiz(records);
  expect(quiz).toHaveLength(3);
  quiz.forEach((q, i) => {
    expect(q.text).toContain(records[i].title);
    expect(q.options[q.answer]).toBe(records[i].date);
    expect(q.options.every((option) => records.some((record) => record.date === option))).toBe(
      true,
    );
  });
});
it('代理返回 HTML 401 时仍清除会话并提供友好错误', async () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('<html>expired</html>', { status: 401 })),
  );
  await expect(api('/api/memories')).rejects.toMatchObject({ code: 'RESPONSE' });
  expect(dispatchEvent).toHaveBeenCalledOnce();
});
it('拒绝格式错误的 JSON 和失败的 HTTP 响应', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(null)));
  await expect(api('/api/memories')).rejects.toMatchObject({ code: 'RESPONSE' });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ ok: true, data: [] }, { status: 500 })),
  );
  await expect(api('/api/memories')).rejects.toMatchObject({ code: 'RESPONSE' });
});

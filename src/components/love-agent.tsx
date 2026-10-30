'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client-api';
import type { AgentAnswer, Citation, ConsentStatus } from '@/lib/agent/types';
import type { MemoryRecord } from '@/lib/memory/model';
import { toMemoryView, type MemoryView } from '@/lib/memory/adapter';
import { useMemories } from './memory-provider';
import { MemoryDetail } from './memories';
type Exchange = { question: string; answer: AgentAnswer };
export function LoveAgent() {
  const { mode, records, memories } = useMemories();
  const [demoEnabled, setDemoEnabled] = useState<boolean | null>(null);
  const [demoConsent, setDemoConsent] = useState(false);
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Exchange[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<{ memory: MemoryView; citation: Citation } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    const next = await api<ConsentStatus>('/api/agent/consent');
    setStatus(next);
    setSelected(
      next.selected
        .filter((s) => records.some((r) => r.id === s.id && r.revision === s.revision))
        .map((s) => s.id),
    );
    if (!next.ready) {
      pending.current?.abort();
      setMessages([]);
    }
  }, [records]);
  useEffect(() => {
    if (mode === 'demo') {
      let active = true;
      void api<{ available: boolean }>('/api/agent/demo')
        .then((value) => {
          if (active) setDemoEnabled(value.available);
        })
        .catch(() => {
          if (active) setDemoEnabled(false);
        });
      return () => {
        active = false;
        pending.current?.abort();
      };
    }
    if (mode !== 'private') return;
    const run = () => {
      void refresh().catch((e) => setError(e.message));
    };
    run();
    window.addEventListener('focus', run);
    return () => {
      pending.current?.abort();
      window.removeEventListener('focus', run);
    };
  }, [mode, refresh]);
  async function consent(enabled: boolean) {
    if (
      enabled &&
      !confirm(
        '我理解：我的问题及双方选中的回忆文字片段将发送至第三方 DeepSeek API；照片不发送。我同意启用云端 AI 并授权这些当前版本的回忆。',
      )
    )
      return;
    setSaving(true);
    setError('');
    try {
      const next = await api<ConsentStatus>('/api/agent/consent', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          confirmed: true,
          selected: enabled
            ? records
                .filter((r) => selected.includes(r.id))
                .map((r) => ({ id: r.id, revision: r.revision }))
            : [],
        }),
      });
      setStatus(next);
      pending.current?.abort();
      setMessages([]);
      if (!enabled) setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }
  async function send() {
    if (busy || !question.trim()) return;
    const controller = new AbortController();
    pending.current = controller;
    const text = question.trim();
    setBusy(true);
    setError('');
    try {
      const answer = await api<AgentAnswer>(
        mode === 'demo' ? '/api/agent/demo' : '/api/agent/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            message: text,
            ...(mode === 'demo' ? { consent: demoConsent } : {}),
          }),
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted) {
        setMessages((old) => [...old.slice(-19), { question: text, answer }]);
        setQuestion('');
      }
    } catch (e) {
      setError(
        controller.signal.aborted
          ? '已取消，可以修改问题后重新发送。'
          : e instanceof Error
            ? e.message
            : '请求失败，请重试',
      );
    } finally {
      if (pending.current === controller) {
        setBusy(false);
        pending.current = null;
      }
    }
  }
  async function openSource(citation: Citation) {
    try {
      if (mode === 'demo') {
        const memory = memories.find((m) => m.id === citation.memoryId);
        if (!memory) throw Error('演示来源不存在');
        setSource({ memory, citation });
        return;
      }
      const record = await api<MemoryRecord>(`/api/memories/${citation.memoryId}`);
      if (record.revision !== citation.revision) {
        setError('来源已更新，请重新提问获取当前版本的引用。');
        return;
      }
      setSource({ memory: toMemoryView(record), citation });
    } catch (e) {
      setError(e instanceof Error ? e.message : '来源不可用');
    }
  }
  function clear() {
    pending.current?.abort();
    setMessages([]);
    setSource(null);
    setError('');
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LoveVerse.chat-export.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="page-section agent-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LOVE AGENT · OUR MEMORIES, WITH SOURCES</span>
          <h1>让回忆，轻轻回应你。</h1>
          <p>只读回忆助手 · AI 可能出错，请核对来源。</p>
        </div>
      </div>
      {mode === 'demo' && demoEnabled !== true ? (
        <div className="agent-panel">
          <h2>真实的回答，来自你们的授权。</h2>
          <p>公开演示不调用模型、不读取私人回忆。请在私人环境登录，双方同意后使用 AI 回忆助手。</p>
        </div>
      ) : (
        <>
          {mode === 'demo' ? (
            <div className="agent-panel">
              <h2>公开 AI 演示 · 无需账号</h2>
              <p>
                回答仅来自网站现有的虚构演示故事。你的问题会发送至
                DeepSeek，请勿输入私人资料。密钥保存在服务器，全站共享调用限额。
              </p>
              <label className="agent-demo-consent">
                <input
                  type="checkbox"
                  checked={demoConsent}
                  onChange={(e) => {
                    setDemoConsent(e.target.checked);
                    if (!e.target.checked) {
                      pending.current?.abort();
                      setMessages([]);
                    }
                  }}
                />
                我同意将本次问题发送至 DeepSeek，用于公开演示问答。
              </label>
            </div>
          ) : (
            <>
              <details className="agent-panel" open={!status?.ready}>
                <summary>云端 AI 与回忆授权（{status?.approvals ?? 0}/2 人同意）</summary>
                <p>
                  启用后，你的问题、选中回忆的标题、日期、地点及有限文字片段可能发送至第三方
                  DeepSeek
                  API。照片、未选中的回忆不发送。双方必须分别登录同意，并选中相同回忆；内容修改后需要重新选择授权。
                </p>
                <p>
                  聊天仅保留在当前页面，离开或退出后清除。导出的聊天含私人信息，请自行妥善保管。关闭
                  AI 无法撤回已经发给提供方的内容。
                </p>
                {status && !status.available && (
                  <p role="status">
                    管理员尚未启用云端 AI。需要设置 LOVEVERSE_AI_ENABLED=true 和服务端 API Key。
                  </p>
                )}
                {status && status.memberCount !== 2 && (
                  <p role="status">此功能要求两个独立成员账号；当前账号配置不足两人。</p>
                )}
                <fieldset disabled={saving || !status}>
                  <legend>允许发送的回忆（默认均不选中）</legend>
                  <div className="agent-selections">
                    {records.map((r) => (
                      <label key={r.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          onChange={(e) =>
                            setSelected((old) =>
                              e.target.checked ? [...old, r.id] : old.filter((id) => id !== r.id),
                            )
                          }
                        />
                        <span>
                          {r.title}
                          <small>{r.date}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {!records.length && <p>先在恋爱日记写下回忆，再回来选择。</p>}
                </fieldset>
                <div className="memory-actions">
                  <button
                    className="primary"
                    disabled={saving || !status?.available || status.memberCount !== 2}
                    onClick={() => void consent(true)}
                  >
                    同意并保存我的选择
                  </button>
                  <button
                    className="text-button"
                    disabled={saving || !status?.enabled}
                    onClick={() => void consent(false)}
                  >
                    撤销我的同意并关闭 AI
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void refresh().catch((e) => setError(e.message))}
                  >
                    刷新双方授权状态
                  </button>
                </div>
              </details>
              <p className="agent-status" role="status">
                {status?.ready
                  ? `双方已同意 · ${status.sharedIds.length} 条当前版本回忆可用于问答`
                  : '等待双方同意；尚未向模型发送任何回忆。'}
              </p>
            </>
          )}
          <div className="agent-toolbar">
            <button className="text-button" onClick={clear}>
              清除聊天
            </button>
            <button className="text-button" disabled={!messages.length} onClick={download}>
              导出聊天
            </button>
          </div>
          <div className="agent-messages" aria-live="polite" aria-busy={busy}>
            {!messages.length && (
              <div className="agent-panel">
                <h2>想起哪一颗星星？</h2>
                <p>试着问一段具体的回忆。每次提问独立检索，不向云端回传聊天历史。</p>
                <button
                  className="text-button"
                  onClick={() =>
                    setQuestion(mode === 'demo' ? '第一次旅行去了哪里？' : '我们保存了哪些回忆？')
                  }
                >
                  {mode === 'demo' ? '第一次旅行去了哪里？' : '我们保存了哪些回忆？'}
                </button>
              </div>
            )}
            {messages.map((m, i) => (
              <article className="agent-exchange" key={i}>
                <p className="agent-question">{m.question}</p>
                <div className="agent-panel">
                  {m.answer.facts.length > 0 && (
                    <>
                      <h3>明确记录的事实 · 原文摘录</h3>
                      {m.answer.facts.map((f, n) => (
                        <blockquote key={n}>
                          {f.text}
                          <div>
                            {f.sources.map((id) => {
                              const c = m.answer.citations.find((s) => s.id === id);
                              return (
                                c && (
                                  <button
                                    className="text-button"
                                    key={id}
                                    onClick={() => void openSource(c)}
                                  >
                                    {c.title} · {c.date}
                                  </button>
                                )
                              );
                            })}
                          </div>
                        </blockquote>
                      ))}
                    </>
                  )}
                  {m.answer.inferences.length > 0 && (
                    <>
                      <h3>基于记录的总结或推断</h3>
                      {m.answer.inferences.map((f, n) => (
                        <div key={n}>
                          <p>{f.text}</p>
                          {f.sources.map((id) => {
                            const c = m.answer.citations.find((s) => s.id === id);
                            return (
                              c && (
                                <button
                                  className="text-button"
                                  key={id}
                                  onClick={() => void openSource(c)}
                                >
                                  {c.title} · {c.date}
                                </button>
                              )
                            );
                          })}
                        </div>
                      ))}
                    </>
                  )}
                  {m.answer.unknowns.length > 0 && (
                    <>
                      <h3>无法确认的信息</h3>
                      {m.answer.unknowns.map((text, n) => (
                        <p key={n}>{text}</p>
                      ))}
                    </>
                  )}
                  {m.answer.citations.length > 0 && (
                    <div className="agent-sources">
                      <h3>回忆来源</h3>
                      {m.answer.citations.map((c) => (
                        <button key={c.id} onClick={() => void openSource(c)}>
                          <strong>{c.title}</strong>
                          <small>
                            {c.date} · 片段 {c.paragraph}
                          </small>
                          <span>{c.excerpt.slice(0, 100)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {busy && (
              <p role="status">
                {mode === 'demo'
                  ? '正在查找公开演示故事，并核对来源…'
                  : '正在查找双方授权的回忆，并核对来源…'}
              </p>
            )}
          </div>
          <form
            className="agent-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor="agent-question">想问我们的回忆</label>
            <textarea
              id="agent-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1500}
              required
              rows={3}
              placeholder="例如：第一次旅行去了哪里？"
              disabled={busy}
            />
            <div className="memory-actions">
              <button
                className="primary"
                disabled={
                  busy ||
                  !(mode === 'demo' ? demoEnabled && demoConsent : status?.ready) ||
                  !question.trim()
                }
              >
                {error ? '重试发送' : '发送问题'}
              </button>
              {busy && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => pending.current?.abort()}
                >
                  取消请求
                </button>
              )}
            </div>
          </form>
          {error && (
            <p role="alert" className="agent-error">
              {error}
            </p>
          )}
          {source && (
            <MemoryDetail
              memory={source.memory}
              citation={source.citation}
              onClose={() => setSource(null)}
            />
          )}
        </>
      )}
    </section>
  );
}

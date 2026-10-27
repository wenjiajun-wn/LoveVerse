'use client';
import { useState } from 'react';
import { useMemories } from './memory-provider';
import { api } from '@/lib/client-api';
import { MemoryEditor } from './memory-editor';
import { MemoryDetail } from './memories';
import { toMemoryView } from '@/lib/memory/adapter';
import type { MemoryRecord } from '@/lib/memory/model';
export function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 20);
  if (!words.length) return <>{text}</>;
  const expression = new RegExp(
    `(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  );
  return (
    <>{text.split(expression).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>
  );
}
export function MemoryManager() {
  const { mode, records, reload, user, logout } = useMemories();
  const [editing, setEditing] = useState<MemoryRecord | 'new' | null>(null);
  const [detail, setDetail] = useState<MemoryRecord | null>(null);
  const [results, setResults] = useState<MemoryRecord[] | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const afterSave = async () => {
    setResults(null);
    await reload();
    setStatus('回忆已保存，星球、相册与时间轴已更新。');
  };
  if (mode === 'demo')
    return (
      <section className="page-section">
        <span className="eyebrow">LOVE MEMORY</span>
        <h1>恋爱日记 · 私人回忆管理</h1>
        <p className="memory-banner">
          当前为公开演示环境。演示资料可以浏览，私人创建、搜索、上传与修改接口均已关闭。请在单独的私人部署中配置账号后使用。
        </p>
      </section>
    );
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LOVE MEMORY · 只属于我们</span>
          <h1>把今天，写进我们的宇宙。</h1>
          <p>{user} · 私人共享空间</p>
        </div>
        <div className="memory-actions">
          <button className="primary" onClick={() => setEditing('new')}>
            新建回忆
          </button>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await logout();
              } catch (e) {
                setError(e instanceof Error ? e.message : '注销失败');
              }
            }}
          >
            退出登录
          </button>
        </div>
      </div>
      <form
        className="memory-search"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const fields = new FormData(e.currentTarget);
          const params = new URLSearchParams();
          fields.forEach((v, k) => {
            if (String(v).trim()) params.set(k, String(v).trim());
          });
          try {
            setResults(await api<MemoryRecord[]>(`/api/memories?${params}`));
            setQuery(String(fields.get('q') || ''));
          } catch (err) {
            setError(err instanceof Error ? err.message : '搜索失败');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          搜索回忆
          <input name="q" maxLength={200} placeholder="标题、正文、地点或标签" />
        </label>
        <label>
          起始日期
          <input name="from" type="date" />
        </label>
        <label>
          结束日期
          <input name="to" type="date" />
        </label>
        <label>
          地点
          <input name="place" maxLength={120} />
        </label>
        <label>
          分类
          <select name="category">
            <option value="">全部分类</option>
            {[...new Set(records.map((m) => m.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          标签
          <select name="tag">
            <option value="">全部标签</option>
            {[...new Set(records.flatMap((m) => m.tags))].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={busy}>
          搜索
        </button>
        <button
          className="text-button"
          type="reset"
          onClick={() => {
            setResults(null);
            setQuery('');
            setError('');
          }}
        >
          重置
        </button>
      </form>
      {error && (
        <p className="memory-banner" role="alert">
          {error}
        </p>
      )}
      <p role="status" className="memory-banner">
        {busy ? '正在搜索…' : status || `${(results || records).length} 段回忆`}
      </p>
      <div className="diary-list">
        {(results || records).map((record) => (
          <article key={record.id}>
            <button className="diary-open" onClick={() => setDetail(record)}>
              <small>
                {record.date} ·{' '}
                <Highlight text={`${record.category} · ${record.place}`} query={query} />
              </small>
              <h2>
                <Highlight text={record.title} query={query} />
              </h2>
              <p>
                <Highlight
                  text={record.story.slice(
                    Math.max(0, record.story.toLowerCase().indexOf(query.toLowerCase()) - 60),
                    Math.max(0, record.story.toLowerCase().indexOf(query.toLowerCase()) - 60) + 250,
                  )}
                  query={query}
                />
              </p>
              <small>
                <Highlight text={record.tags.join(' · ')} query={query} />
              </small>
            </button>
            <div className="memory-actions">
              <button className="text-button" onClick={() => setEditing(record)}>
                编辑回忆
              </button>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`确定删除「${record.title}」？服务器会保留恢复备份。`))
                    return;
                  setBusy(true);
                  setError('');
                  try {
                    await api(`/api/memories/${record.id}`, {
                      method: 'DELETE',
                      body: JSON.stringify({ revision: record.revision, confirmed: true }),
                    });
                    await reload();
                    setResults(null);
                    setStatus('回忆已删除，原文已备份。');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '删除失败');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                删除回忆
              </button>
            </div>
          </article>
        ))}
      </div>
      {!(results || records).length && (
        <p className="memory-banner">
          {results
            ? '没有找到符合条件的回忆，试试减少筛选条件。'
            : '还没有私人回忆。点击“新建回忆”，收藏第一颗星球。'}
        </p>
      )}
      {editing && (
        <MemoryEditor
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
        />
      )}
      {detail && <MemoryDetail memory={toMemoryView(detail)} onClose={() => setDetail(null)} />}
    </section>
  );
}

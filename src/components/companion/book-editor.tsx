'use client';
import { useState } from 'react';
import { Modal } from '../modal';
import { MarkdownPreview } from '../memory-editor/markdown-preview';
import { PhotoPicker } from '../memory-editor/photo-picker';
import { api } from '@/lib/client-api';
import type { V4Book, V4Chapter } from '@/lib/v4/model';
export function BookEditor({
  item,
  onClose,
  onSaved,
}: {
  item: V4Book;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [book, setBook] = useState(item),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(book) !== JSON.stringify(item);
  const close = () => {
    if (!dirty || confirm('还没有保存修改，确定关闭？')) onClose();
  };
  const change = (index: number, patch: Partial<V4Chapter>) =>
    setBook((b) => ({
      ...b,
      chapters: b.chapters.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="编辑回忆录" onClose={busy ? () => {} : close}>
      <div className={'v4-book-editor theme-' + book.theme}>
        <h2>编辑回忆录</h2>
        <p>章节的来源日期和地点保持原始记录。手动编辑的叙述需要你核实。</p>
        <label>
          回忆录标题
          <input
            value={book.title}
            maxLength={120}
            onChange={(e) => setBook({ ...book, title: e.target.value })}
          />
        </label>
        <label>
          排版主题
          <select
            value={book.theme}
            onChange={(e) => setBook({ ...book, theme: e.target.value as V4Book['theme'] })}
          >
            <option value="starlight">星夜情书</option>
            <option value="paper">暖纸纪念册</option>
          </select>
        </label>
        <div className="v4-actions">
          <button aria-pressed={preview} onClick={() => setPreview(!preview)}>
            {preview ? '继续编辑' : '预览纪念册'}
          </button>
        </div>
        {preview ? (
          <div className="book-preview">
            <div className="book-cover">
              <small>LOVEVERSE · OUR MEMORY BOOK</small>
              <h1>{book.title}</h1>
              <p>每一页，都是我们。</p>
            </div>
            {book.chapters.map((c, i) => (
              <article key={c.id}>
                <small>
                  CHAPTER {i + 1} · {c.date} · {c.place}
                </small>
                <h2>{c.title}</h2>
                <MarkdownPreview source={c.content} />
                <div className="v4-photo-grid">
                  {c.photos.map((p) => (
                    <img key={p.id} src={'/api/uploads/' + p.id} alt={p.alt} />
                  ))}
                </div>
                <small>Memory ID：{c.memoryId}</small>
              </article>
            ))}
          </div>
        ) : (
          book.chapters.map((c, i) => (
            <fieldset key={c.id} className="v4-card">
              <legend>章节 {i + 1}</legend>
              <small>
                {c.date} · {c.place} · 来源 {c.memoryId}
              </small>
              <label>
                章节标题
                <input
                  value={c.title}
                  maxLength={120}
                  onChange={(e) => change(i, { title: e.target.value })}
                />
              </label>
              <label>
                章节正文
                <textarea
                  rows={7}
                  maxLength={20000}
                  value={c.content}
                  onChange={(e) => change(i, { content: e.target.value })}
                />
              </label>
              <div className="v4-actions">
                {[-1, 1].map((delta) => (
                  <button
                    key={delta}
                    disabled={busy || i + delta < 0 || i + delta >= book.chapters.length}
                    onClick={() => {
                      const chapters = [...book.chapters];
                      [chapters[i], chapters[i + delta]] = [chapters[i + delta], chapters[i]];
                      setBook({ ...book, chapters });
                    }}
                  >
                    {delta < 0 ? '上移章节' : '下移章节'}
                  </button>
                ))}
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const fresh = await api<V4Chapter>('/api/v4', {
                        method: 'POST',
                        body: JSON.stringify({
                          action: 'book.regenerate',
                          id: book.id,
                          revision: book.revision,
                          chapterId: c.id,
                          useAI: false,
                        }),
                      });
                      change(i, { content: fresh.content });
                    })
                  }
                >
                  恢复来源正文
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const fresh = await api<V4Chapter>('/api/v4', {
                        method: 'POST',
                        body: JSON.stringify({
                          action: 'book.regenerate',
                          id: book.id,
                          revision: book.revision,
                          chapterId: c.id,
                          useAI: true,
                        }),
                      });
                      change(i, { content: fresh.content });
                    })
                  }
                >
                  DeepSeek 重新摘录
                </button>
              </div>
              <PhotoPicker value={c.photos} onChange={(photos) => change(i, { photos })} />
            </fieldset>
          ))
        )}
        {!book.chapters.length && (
          <label>
            旧版 Markdown 草稿
            <textarea
              rows={12}
              value={book.content}
              maxLength={35000}
              onChange={(e) => setBook({ ...book, content: e.target.value })}
            />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">正在处理，请稍候…</p>}
        <div className="v4-actions">
          <button
            disabled={busy || !book.title.trim()}
            onClick={() =>
              void action(async () => {
                await api('/api/v4', {
                  method: 'POST',
                  body: JSON.stringify({
                    action: 'book.update',
                    id: book.id,
                    revision: book.revision,
                    title: book.title,
                    content: book.content,
                    chapters: book.chapters,
                    theme: book.theme,
                  }),
                });
                await onSaved();
                onClose();
              })
            }
          >
            保存回忆录
          </button>
          <button
            disabled={busy || dirty}
            onClick={() =>
              void action(async () => {
                const r = await fetch(`/api/v4/books/${book.id}/pdf`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ revision: book.revision }),
                  credentials: 'same-origin',
                  cache: 'no-store',
                });
                if (!r.ok) throw Error((await r.json()).error?.message || 'PDF 导出失败');
                const url = URL.createObjectURL(await r.blob());
                const a = document.createElement('a');
                a.href = url;
                a.download = 'LoveVerse-memory-book.pdf';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
            }
          >
            导出完整 PDF
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (confirm('确认删除回忆录？服务器保留恢复备份。'))
                void action(async () => {
                  await api('/api/v4', {
                    method: 'POST',
                    body: JSON.stringify({
                      action: 'book.delete',
                      id: book.id,
                      revision: book.revision,
                      confirmed: true,
                    }),
                  });
                  await onSaved();
                  onClose();
                });
            }}
          >
            删除回忆录
          </button>
        </div>
        <small>PDF 导出已保存版本；有未保存修改时请先保存，再打开草稿导出。</small>
      </div>
    </Modal>
  );
}

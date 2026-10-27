'use client';
import { useEffect, useState } from 'react';
import { memoryInputSchema, type MemoryInput, type MemoryRecord } from '@/lib/memory/model';
import { todayInShanghai } from '@/lib/dates';
import { api } from '@/lib/client-api';
import { Modal } from '../modal';
import { MarkdownPreview } from './markdown-preview';
import { PhotoPicker } from './photo-picker';
export function MemoryEditor({
  record,
  onClose,
  onSaved,
}: {
  record?: MemoryRecord;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState<MemoryInput>(() => ({
    title: record?.title || '',
    date: record?.date || todayInShanghai(),
    category: record?.category || '日常碎片',
    place: record?.place || '',
    tags: record?.tags || [],
    story: record?.story || '',
    photos: record?.photos || [],
    color: record?.color || 'rose',
    visibility: 'private',
  }));
  const [tags, setTags] = useState(value.tags.join(', '));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function change<K extends keyof MemoryInput>(key: K, data: MemoryInput[K]) {
    setValue((v) => ({ ...v, [key]: data }));
    setDirty(true);
  }
  const close = () => {
    if (!busy && (!dirty || window.confirm('尚有未保存的修改，确定离开编辑器？'))) onClose();
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const parsed = memoryInputSchema.safeParse({
    ...value,
    tags: tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean),
  });
  return (
    <Modal title={record ? '编辑回忆' : '新建回忆'} onClose={close}>
      <form
        className="memory-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!parsed.success) {
            setError(
              '请检查输入：标题和分类不能为空，日期必须有效；标签最多 20 个且每个不超过 30 字，照片最多 20 张，正文不超过 10 万字。',
            );
            return;
          }
          setBusy(true);
          setError('');
          try {
            await api(record ? `/api/memories/${record.id}` : '/api/memories', {
              method: record ? 'PUT' : 'POST',
              body: JSON.stringify(
                record ? { input: parsed.data, revision: record.revision } : parsed.data,
              ),
            });
            setDirty(false);
            await onSaved();
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : '保存失败');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{record ? '编辑这段回忆' : '收藏一段新回忆'}</h2>
        <p>正文与原有扩展元数据会一同保留。仅对私人空间成员可见。</p>
        <fieldset disabled={busy}>
          <div className="memory-fields">
            <label>
              标题
              <input
                value={value.title}
                required
                maxLength={100}
                onChange={(e) => change('title', e.target.value)}
              />
            </label>
            <label>
              回忆日期
              <input
                type="date"
                required
                value={value.date}
                onChange={(e) => change('date', e.target.value)}
              />
            </label>
            <label>
              分类
              <input
                required
                maxLength={40}
                value={value.category}
                onChange={(e) => change('category', e.target.value)}
              />
            </label>
            <label>
              地点
              <input
                maxLength={120}
                value={value.place}
                onChange={(e) => change('place', e.target.value)}
              />
            </label>
            <label>
              标签（逗号分隔）
              <input
                value={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label>
              星球颜色
              <select
                value={value.color}
                onChange={(e) => change('color', e.target.value as MemoryInput['color'])}
              >
                {[
                  ['rose', '玫瑰粉'],
                  ['peach', '蜜桃橙'],
                  ['blue', '星海蓝'],
                  ['mint', '薄荷绿'],
                  ['violet', '淡紫'],
                  ['gold', '暖金'],
                ].map(([key, text]) => (
                  <option key={key} value={key}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Markdown 正文
            <textarea
              rows={10}
              maxLength={100000}
              value={value.story}
              onChange={(e) => change('story', e.target.value)}
              placeholder="写下今天的故事，支持 Markdown…"
            />
          </label>
          <section aria-label="Markdown 实时预览" className="memory-preview">
            <h3>实时预览</h3>
            <MarkdownPreview source={value.story || '这里会显示你的故事。'} />
          </section>
          <PhotoPicker value={value.photos} onChange={(photos) => change('photos', photos)} />
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="memory-actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? '正在保存…' : '保存回忆'}
          </button>
          <button type="button" className="text-button" disabled={busy} onClick={close}>
            取消
          </button>
        </div>
      </form>
    </Modal>
  );
}

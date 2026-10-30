'use client';
import { useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { MemoryView } from '@/lib/memory/adapter';
import { useMemories } from './memory-provider';
import { MarkdownPreview } from './memory-editor/markdown-preview';
import { Modal } from './modal';
export function MemoryDetail({
  memory,
  onClose,
  citation,
}: {
  memory: MemoryView;
  onClose: () => void;
  citation?: { paragraph: number; excerpt: string };
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = memory.photos?.length
    ? memory.photos
    : memory.image
      ? [{ id: 'cover', url: memory.image, alt: memory.title }]
      : [];
  return (
    <Modal title={memory.title} onClose={onClose}>
      {photos.length > 0 && (
        <img
          className="detail-image"
          src={photos[photoIndex]?.url || photos[0].url}
          alt={photos[photoIndex]?.alt || memory.title}
        />
      )}
      {photos.length > 1 && (
        <div className="photo-thumbnails">
          {photos.map((p, i) => (
            <button
              key={p.id}
              aria-label={`查看第 ${i + 1} 张照片`}
              aria-pressed={i === photoIndex}
              onClick={() => setPhotoIndex(i)}
            >
              <img src={p.url} alt={p.alt} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
      <div className="detail-copy">
        <span className="eyebrow">
          {memory.category} · {memory.date}
        </span>
        <h2>{memory.title}</h2>
        {citation && (
          <aside className="agent-citation-detail">
            <strong>AI 引用 · 片段 {citation.paragraph}</strong>
            <blockquote>{citation.excerpt}</blockquote>
            <small>以下为完整回忆，可对照原文核验。</small>
          </aside>
        )}
        {memory.private ? <MarkdownPreview source={memory.story} /> : <p>{memory.story}</p>}
        <small>
          <MapPin size={14} /> {memory.place} · {memory.private ? '私人回忆' : '演示故事'}
        </small>
      </div>
    </Modal>
  );
}
export function Memories({ timeline = false }: { timeline?: boolean }) {
  const { memories, mode } = useMemories();
  const [selected, setSelected] = useState<MemoryView | null>(null);
  const [filter, setFilter] = useState('全部');
  const items = filter === '全部' ? memories : memories.filter((m) => m.category === filter);
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {timeline ? 'OUR LITTLE MILESTONES' : 'COLLECTING OUR MOMENTS'}
          </span>
          <h1>{timeline ? '时间会记得，我们也是。' : '把心动，定格在这里。'}</h1>
          <p>
            {timeline
              ? '那些平凡的日子，因为你，成为了纪念日。'
              : '一些风景，一些日常，还有每一帧里的我们。'}
          </p>
        </div>
        <span className="count-label">{memories.length.toString().padStart(2, '0')} / 段回忆</span>
      </div>
      {!timeline && (
        <div className="filters" aria-label="相册分类">
          {(mode === 'demo'
            ? ['全部', '第一次旅行', '日常碎片', '重要纪念日']
            : ['全部', ...new Set(memories.map((m) => m.category))]
          ).map((f) => (
            <button
              key={f}
              className={filter === f ? 'selected' : ''}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      )}
      <div className={timeline ? 'timeline' : 'masonry'}>
        {items.map((m, i) => (
          <button
            className={timeline ? 'timeline-item' : 'photo-card'}
            key={m.id}
            onClick={() => setSelected(m)}
          >
            {timeline && (
              <div className="timeline-date">
                <span>{String(i + 1).padStart(2, '0')}</span>
                {m.date}
              </div>
            )}
            {m.image ? (
              <img src={m.image} alt={m.title + (m.private ? '' : '（演示素材）')} loading="lazy" />
            ) : (
              <div className="memory-no-photo">文字也能收藏心动</div>
            )}
            <div className="photo-caption">
              <small>
                {m.category} <span>{m.date}</span>
              </small>
              <h2>
                {m.title}
                <ArrowUpRight size={18} />
              </h2>
              {timeline && <p>{m.story}</p>}
            </div>
          </button>
        ))}
      </div>
      {items.length === 0 && (
        <p className="memory-banner">这里暂时没有回忆。前往“恋爱日记”添加，或调整分类。</p>
      )}
      {selected && memories.some((m) => m.id === selected.id) && (
        <MemoryDetail
          memory={memories.find((m) => m.id === selected.id)!}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

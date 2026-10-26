'use client';
import { useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { memories, type Memory } from '@/data/demo';
import { Modal } from './modal';
export function MemoryDetail({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  return (
    <Modal title={memory.title} onClose={onClose}>
      <img className="detail-image" src={memory.image} alt={memory.title + '（演示素材）'} />
      <div className="detail-copy">
        <span className="eyebrow">
          {memory.category} · {memory.date}
        </span>
        <h2>{memory.title}</h2>
        <p>{memory.story}</p>
        <small>
          <MapPin size={14} /> {memory.place} · 演示故事
        </small>
      </div>
    </Modal>
  );
}
export function Memories({ timeline = false }: { timeline?: boolean }) {
  const [selected, setSelected] = useState<Memory | null>(null);
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
          {['全部', '第一次旅行', '日常碎片', '重要纪念日'].map((f) => (
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
                <span>0{i + 1}</span>
                {m.date}
              </div>
            )}
            <img src={m.image} alt={m.title + '（演示素材）'} loading="lazy" />
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
      {selected && <MemoryDetail memory={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

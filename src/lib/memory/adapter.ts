import type { Memory } from '@/data/demo';
import type { MemoryRecord } from './model';
export type MemoryView = Memory & {
  tags?: string[];
  photos?: { id: string; alt: string; url: string }[];
  private?: boolean;
  revision?: string;
};
export function toMemoryView(record: MemoryRecord): MemoryView {
  return {
    id: record.id,
    title: record.title,
    date: record.date,
    category: record.category,
    place: record.place,
    story: record.story,
    color: record.color,
    image: record.photos[0] ? `/api/uploads/${record.photos[0].id}` : '',
    photos: record.photos.map((p) => ({ ...p, url: `/api/uploads/${p.id}` })),
    tags: record.tags,
    private: true,
    revision: record.revision,
  };
}

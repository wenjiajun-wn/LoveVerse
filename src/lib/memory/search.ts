import { searchSchema, type SearchQuery, type MemoryRecord } from './model';
export function searchMemories(records: MemoryRecord[], query: SearchQuery) {
  const value = searchSchema.parse(query);
  const tokens = value.q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter((m) => {
    const text = [m.title, m.story, m.place, m.category, ...m.tags].join('\n').toLocaleLowerCase();
    return (
      tokens.every((t) => text.includes(t)) &&
      (!value.from || m.date >= value.from) &&
      (!value.to || m.date <= value.to) &&
      (!value.place || m.place.toLocaleLowerCase().includes(value.place.toLocaleLowerCase())) &&
      (!value.category || m.category === value.category) &&
      (!value.tag || m.tags.includes(value.tag))
    );
  });
}

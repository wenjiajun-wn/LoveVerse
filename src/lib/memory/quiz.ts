import type { MemoryView } from './adapter';
export type MemoryQuestion = { text: string; options: string[]; answer: number };
/** All options come from saved records; never fabricate an event or a date. */
export function memoryQuiz(memories: MemoryView[]): MemoryQuestion[] {
  const dates = [...new Set(memories.map((memory) => memory.date))];
  if (dates.length < 3) return [];
  return memories.slice(0, 3).map((memory, index) => {
    const options = dates.filter((date) => date !== memory.date).slice(0, 2);
    options.splice(index % 3, 0, memory.date);
    return { text: `「${memory.title}」发生在哪一天？`, options, answer: index % 3 };
  });
}

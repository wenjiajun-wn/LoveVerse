import { z } from 'zod';
import { dateValue } from '../dates';
export const uuid = z.string().uuid();
export const calendarDate = z.string().refine((value) => {
  try {
    dateValue(value);
    return true;
  } catch {
    return false;
  }
}, '请输入有效日期');
export const photoSchema = z
  .object({ id: uuid, alt: z.string().max(160).default('回忆照片') })
  .strict();
export const memoryInputSchema = z
  .object({
    title: z.string().trim().min(1, '请填写标题').max(100),
    date: calendarDate,
    category: z.string().trim().min(1).max(40),
    place: z.string().trim().max(120),
    tags: z.array(z.string().trim().min(1).max(30)).max(20),
    story: z.string().max(100000),
    photos: z.array(photoSchema).max(20),
    color: z.enum(['rose', 'peach', 'blue', 'mint', 'violet', 'gold']),
    visibility: z.literal('private'),
  })
  .strict();
export const memoryMetaSchema = memoryInputSchema
  .omit({ story: true })
  .extend({ id: uuid, createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
  .passthrough();
export type MemoryInput = z.infer<typeof memoryInputSchema>;
export type MemoryRecord = MemoryInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  revision: string;
  metadata: Record<string, unknown>;
};
export const searchSchema = z
  .object({
    q: z.string().max(200).default(''),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    place: z.string().max(120).optional(),
    category: z.string().max(40).optional(),
    tag: z.string().max(30).optional(),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, '起始日期不能晚于结束日期');
export type SearchQuery = z.input<typeof searchSchema>;
export const anniversarySchema = z
  .object({
    id: uuid,
    title: z.string().trim().min(1).max(40),
    date: calendarDate,
    yearly: z.boolean(),
  })
  .strict();
export type Anniversary = z.infer<typeof anniversarySchema>;
export const anniversaryStateSchema = z.object({
  items: z.array(anniversarySchema).max(500),
  imports: z.array(z.string().max(100)).max(100),
  revision: uuid,
});
export type AnniversaryState = z.infer<typeof anniversaryStateSchema>;

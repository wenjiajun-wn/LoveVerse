import { z } from 'zod';
import { calendarDate, uuid, photoSchema, searchSchema } from '../memory/model';

const short = z.string().trim().min(1).max(120);
export const themeSchema = z.enum(['starlight', 'paper']);
export const chapterSchema = z
  .object({
    id: uuid,
    memoryId: uuid,
    title: short,
    date: calendarDate,
    place: z.string().max(120),
    content: z.string().max(20000),
    photos: z.array(photoSchema).max(20),
  })
  .strict();
export const timezoneSchema = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  });
export const v4Input = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('book.create'),
      title: short,
      memoryIds: z.array(uuid).min(1).max(12),
      aiIntro: z.boolean().default(false),
      filters: searchSchema.optional(),
      theme: themeSchema.default('starlight'),
    })
    .strict(),
  z
    .object({
      action: z.literal('book.update'),
      id: uuid,
      revision: uuid,
      title: short,
      content: z.string().max(35000),
      chapters: z.array(chapterSchema).max(12).optional(),
      theme: themeSchema.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('book.delete'),
      id: uuid,
      revision: uuid,
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal('book.regenerate'),
      id: uuid,
      revision: uuid,
      chapterId: uuid,
      useAI: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal('plan.create'),
      title: short,
      budget: z.number().nonnegative().max(1000000),
      currency: z.enum(['CNY', 'USD', 'JPY']).default('CNY'),
      date: calendarDate.optional(),
      place: z.string().trim().max(100),
      wishes: z.string().trim().min(1).max(500),
      memoryIds: z.array(uuid).max(4).default([]),
      useAI: z.boolean().default(false),
      availableMinutes: z.number().int().min(30).max(1440).default(180),
    })
    .strict(),
  z
    .object({
      action: z.literal('plan.update'),
      id: uuid,
      revision: uuid,
      content: z.string().max(12000),
    })
    .strict(),
  z
    .object({
      action: z.literal('plan.delete'),
      id: uuid,
      revision: uuid,
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal('capsule.create'),
      title: short,
      content: z.string().trim().min(1).max(10000),
      unlockDate: calendarDate,
      photos: z.array(photoSchema).max(8).default([]),
    })
    .strict(),
  z
    .object({
      action: z.literal('capsule.delete'),
      id: uuid,
      revision: uuid,
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal('reminders.save'),
      enabled: z.boolean(),
      timeZone: timezoneSchema.default('Asia/Shanghai'),
      daysBefore: z
        .array(z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(30)]))
        .max(4),
    })
    .strict(),
  z.object({ action: z.literal('notification.read'), id: uuid }).strict(),
]);
export type V4Input = z.infer<typeof v4Input>;

const source = z
  .object({ id: uuid, revision: z.string(), title: z.string(), date: calendarDate })
  .strict();
export const bookSchema = z
  .object({
    id: uuid,
    owner: z.string(),
    title: short,
    content: z.string().max(35000),
    photos: z.array(z.object({ id: uuid, alt: z.string().max(160) }).strict()).max(40),
    sources: z.array(source).max(12),
    createdAt: z.string().datetime(),
    revision: uuid,
    chapters: z.array(chapterSchema).max(12).default([]),
    theme: themeSchema.default('starlight'),
  })
  .strict();
export const planSchema = z
  .object({
    id: uuid,
    owner: z.string(),
    title: short,
    content: z.string().max(12000),
    budget: z.number(),
    currency: z.enum(['CNY', 'USD', 'JPY']),
    date: calendarDate.nullable(),
    place: z.string(),
    sources: z.array(source).max(4),
    createdAt: z.string().datetime(),
    revision: uuid,
    availableMinutes: z.number().int().min(30).max(1440).default(180),
  })
  .strict();
export const capsuleSchema = z
  .object({
    id: uuid,
    owner: z.string(),
    title: short,
    content: z.string().max(10000),
    unlockDate: calendarDate,
    createdAt: z.string().datetime(),
    revision: uuid.default('00000000-0000-4000-8000-000000000000'),
    photos: z.array(photoSchema).max(8).default([]),
  })
  .strict();
const preference = z
  .object({
    enabled: z.boolean(),
    timeZone: timezoneSchema.default('Asia/Shanghai'),
    since: z.string().datetime().optional(),
    daysBefore: z.array(z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(30)])).max(4),
  })
  .strict();
export const notificationSchema = z
  .object({
    id: uuid,
    owner: z.string(),
    key: z.string(),
    title: short,
    date: calendarDate,
    daysBefore: z.number(),
    createdAt: z.string().datetime(),
    read: z.boolean(),
  })
  .strict();
export const v4StateSchema = z
  .object({
    books: z.array(bookSchema).max(100),
    plans: z.array(planSchema).max(100),
    capsules: z.array(capsuleSchema).max(100),
    reminders: z.record(z.string(), preference),
    notifications: z.array(notificationSchema).max(10000).default([]),
    lastRun: z.string().datetime().nullable().default(null),
  })
  .strict();
export type V4State = z.infer<typeof v4StateSchema>;
export type V4Book = z.infer<typeof bookSchema>;
export type V4Plan = z.infer<typeof planSchema>;
export type V4Capsule = z.infer<typeof capsuleSchema>;
export type V4ReminderPreference = z.infer<typeof preference>;
export type V4Chapter = z.infer<typeof chapterSchema>;
export type V4Dashboard = {
  books: V4Book[];
  plans: V4Plan[];
  capsules: Array<
    Omit<V4Capsule, 'content' | 'owner'> & {
      content: string | null;
      unlocked: boolean;
      canDelete: boolean;
    }
  >;
  reminders: V4ReminderPreference;
  notifications: z.infer<typeof notificationSchema>[];
  schedulerLastRun: string | null;
  upcoming: Array<{ id: string; title: string; date: string; days: number }>;
  todayMemories: Array<{ id: string; title: string; date: string; place: string }>;
  quiz: Array<{ id: string; title: string; date: string; place: string }>;
};

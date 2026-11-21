// marketGroups/{id} ও marketItems/{id} — বাজার দরের রেফারেন্স তালিকা (Net Worth/বাজেট/হিসাবের সাথে কোনো সম্পর্ক নেই)।
// দাম পয়সায় ধনাত্মক integer (R1)। প্রতি আইটেমে শেষ ৫টা দামের ইতিহাস `history[]`-তেই (নতুন-আগে, history[0] = বর্তমান) —
// আলাদা collection নেই; nested array বলে rules-এ শুধু টপ-লেভেল চেক, বাকিটা Zod-নির্ভর।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** firestore.rules-এর সীমার সাথে মিল রাখতে হবে (history.size() <= ৫)। */
export const MARKET_HISTORY_MAX = 5;

export const PriceEntrySchema = z.object({
  date: DateStr,
  priceMinor: z.number().int().positive(),
  note: z.string().max(200).default(''),
  // কত পরিমাণের দাম (যেমন 0.5 + কেজি, 500 + গ্রাম) — ঐচ্ছিক; পুরনো এন্ট্রিতে নেই (zero-migration)
  qty: nullish(z.number().positive().max(1_000_000)),
  unit: z.string().max(20).default(''),
});
export type PriceEntry = z.infer<typeof PriceEntrySchema>;

export const MarketGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  icon: nullish(z.string().max(12)),
  order: z.number().default(0),
  archived: z.boolean().default(false),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type MarketGroup = z.infer<typeof MarketGroupSchema>;

export const MarketGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: nullish(z.string().trim().max(12)),
  order: z.number().default(0),
});
export type MarketGroupInput = z.input<typeof MarketGroupInputSchema>;

export const MarketItemSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  name: z.string().min(1).max(60),
  unit: z.string().max(20).default(''),
  order: z.number().default(0),
  archived: z.boolean().default(false),
  // পুরনো/বাড়তি এন্ট্রি পড়ার সময় ছেঁটে ৫টায় — doc বাদ পড়ে না (defensive read)
  history: z
    .array(PriceEntrySchema)
    .default([])
    .transform((h) => h.slice(0, MARKET_HISTORY_MAX)),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type MarketItem = z.infer<typeof MarketItemSchema>;

export const MarketItemInputSchema = z.object({
  groupId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(60),
  unit: z.string().trim().max(20).default(''),
  order: z.number().default(0),
});
export type MarketItemInput = z.input<typeof MarketItemInputSchema>;

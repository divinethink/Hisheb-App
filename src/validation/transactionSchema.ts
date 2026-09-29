// Transaction schema (Architecture Plan §২, R1/B6/B8/C14)। Zod = data-boundary-র একমাত্র validation সোর্স।
// ⚠️ P1a-র শুরুতে schema freeze-review বাধ্যতামূলক (Roadmap Ai-নিয়ম E.4(ক)) — real ডেটা ঢোকার আগে।
import { z } from 'zod';

export const TransactionTypeSchema = z.enum(['income', 'expense']);

// Firestore Timestamp-এর ন্যূনতম আকৃতি (SDK import ছাড়া, testable)
const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

export const TransactionSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Asia/Dhaka local date
  type: TransactionTypeSchema,
  occurredAt: TimestampLike,
  importKey: nullish(z.string()),
  // সবসময় ধনাত্মক int (> 0) — দিক শুধু `type` থেকে (R1)
  amountMinor: z.number().int().positive(),
  currency: z.string().default('BDT'),
  categoryId: z.string().min(1),
  categoryName: z.string(),
  labelIds: z.array(z.string()).default([]),
  labelNames: z.array(z.string()).default([]),
  note: z.string().default(''),
  deleted: z.boolean().default(false),
  // serverTimestamp pending থাকলে local snapshot-এ null আসে
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
  receiptUrl: nullish(z.string()),
  recurringTemplateId: nullish(z.string()),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// Write-boundary: id/createdAt/updatedAt repo বসায়; occurredAt এখানে Date
export const TransactionInputSchema = TransactionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  occurredAt: true,
}).extend({ occurredAt: z.date() });

export type TransactionInput = z.input<typeof TransactionInputSchema>;

// Edit-boundary: occurredAt/importKey immutable (Architecture Plan §২), তাই এখানে নেই
export const TransactionUpdateSchema = TransactionInputSchema.pick({
  date: true,
  type: true,
  amountMinor: true,
  currency: true,
  categoryId: true,
  categoryName: true,
  labelIds: true,
  labelNames: true,
  note: true,
});
export type TransactionUpdate = z.input<typeof TransactionUpdateSchema>;

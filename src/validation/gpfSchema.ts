// gpfEntries/{id} — GPF (General Provident Fund) ledger। প্রতিটা contribution/interest/withdrawal
// আলাদা ডকুমেন্ট (homeDeposits-এর প্যাটার্ন); ব্যালেন্স কখনো store হয় না, লাইভ হিসাব (lib/gpfCalc.ts)।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// string + Zod enum (Roadmap §D.6 enum future-proofing) — নতুন type লাগলে শুধু এখানে
export const GpfTypeSchema = z.enum(['contribution', 'interest', 'withdrawal']);

export const GpfEntrySchema = z.object({
  id: z.string(),
  date: DateStr,
  type: GpfTypeSchema,
  // ধনাত্মক int (> 0) — R1, rules posInt()-এর সাথে মিল; দিক শুধু `type` থেকে
  amountMinor: z.number().int().positive(),
  fiscalYear: z.string().default(''), // "2025-26" (জুলাই–জুন), date থেকে derive
  salaryMonth: z.string().default(''), // ঐচ্ছিক রেফারেন্স (import থেকে)
  accountingMonth: z.string().default(''),
  note: z.string().default(''),
  importKey: nullish(z.string()), // CSV import-এর idempotency; হাতে-দেওয়া এন্ট্রিতে null
  currency: z.string().default('BDT'),
  zakatable: z.boolean().default(false), // ফিকহি সিদ্ধান্ত owner-এর (P8), ডিফল্ট false
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type GpfEntry = z.infer<typeof GpfEntrySchema>;
export const GpfEntryInputSchema = GpfEntrySchema.omit({ id: true, createdAt: true, updatedAt: true });
export type GpfEntryInput = z.input<typeof GpfEntryInputSchema>;

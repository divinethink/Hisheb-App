// historicalYearlyTotals/{year} — Architecture Plan §২ (read-only pre-app reference, C1/C17)।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

// খাতওয়ারি ব্যয় (additive, optional) — Excel-এর Yearly Statement থেকে; নেই = null (পুরনো doc যেমন ছিল)
export const HistoricalCategoryItemSchema = z.object({
  name: z.string().min(1).max(100),
  amountMinor: z.number().int().nonnegative(),
});
export type HistoricalCategoryItem = z.infer<typeof HistoricalCategoryItemSchema>;

export const HistoricalYearlyTotalSchema = z.object({
  year: z.number().int(),
  totalIncomeMinor: z.number().int(),
  totalExpenseMinor: z.number().int(),
  totalDepositMinor: z.number().int(),
  categoryTotals: nullish(z.array(HistoricalCategoryItemSchema).max(100)),
  note: nullish(z.string()),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type HistoricalYearlyTotal = z.infer<typeof HistoricalYearlyTotalSchema>;

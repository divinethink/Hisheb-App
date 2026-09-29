// historicalYearlyTotals/{year} — Architecture Plan §২ (read-only pre-app reference, C1/C17)।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

export const HistoricalYearlyTotalSchema = z.object({
  year: z.number().int(),
  totalIncomeMinor: z.number().int(),
  totalExpenseMinor: z.number().int(),
  totalDepositMinor: z.number().int(),
  note: nullish(z.string()),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type HistoricalYearlyTotal = z.infer<typeof HistoricalYearlyTotalSchema>;

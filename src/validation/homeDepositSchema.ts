// depositFunds/{id} + homeDeposits/{id} — Architecture Plan §২/§৪.৫। Fund = accountSchema-এর মতোই
// (holder ছাড়া); প্রতিটা deposit/withdrawal আলাদা ডকুমেন্ট (repayments[]-এর মতো embedded array না)।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const FundSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  order: z.number().default(0),
  currency: z.string().default('BDT'),
  archived: z.boolean().default(false),
  zakatable: z.boolean().default(true),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type Fund = z.infer<typeof FundSchema>;
export const FundInputSchema = FundSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type FundInput = z.input<typeof FundInputSchema>;

export const HomeDepositTypeSchema = z.enum(['deposit', 'withdrawal']);

export const HomeDepositEntrySchema = z.object({
  id: z.string(),
  fundId: z.string().min(1),
  date: DateStr,
  // ধনাত্মক int (> 0) — R1, rules posInt()-এর সাথে মিল; দিক শুধু `type` থেকে
  amountMinor: z.number().int().positive(),
  type: HomeDepositTypeSchema,
  note: z.string().default(''),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type HomeDepositEntry = z.infer<typeof HomeDepositEntrySchema>;
export const HomeDepositEntryInputSchema = HomeDepositEntrySchema.omit({ id: true, createdAt: true, updatedAt: true });
export type HomeDepositEntryInput = z.input<typeof HomeDepositEntryInputSchema>;

// investments/{id} — Architecture Plan §২/§১৩.১। status(running/closed) এখানে নেই — lib/investmentCalc.ts থেকে সবসময় লাইভ (C3, debts-এর প্যাটার্ন)।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const InvestmentOutcomeSchema = z.enum(['running', 'doubtful', 'written_off']);

export const RepaymentSchema = z.object({
  date: DateStr,
  amountMinor: z.number().int().positive(),
  note: z.string().default(''), // ঐচ্ছিক, additive — পুরনো doc-এ না থাকলে '' (backward-compatible)
});
export type Repayment = z.infer<typeof RepaymentSchema>;

export const InvestmentSchema = z.object({
  id: z.string(),
  date: DateStr,
  investedTo: z.string().min(1),
  medium: z.string().default(''),
  // ধনাত্মক int (> 0) — R1, rules posInt()-এর সাথে মিল
  principalMinor: z.number().int().positive(),
  currency: z.string().default('BDT'),
  duration: z.string().default(''),
  note: z.string().default(''),
  repayments: z.array(RepaymentSchema).default([]),
  investmentOutcome: InvestmentOutcomeSchema.default('running'),
  zakatable: z.boolean().default(true),
  expectedRepaymentDate: nullish(DateStr), // G2, ঐচ্ছিক
  // DF1 (2026-09-24): investmentOutcome সর্বশেষ কবে বদলেছে (Asia/Dhaka YYYY-MM-DD) — Cross-check known-factor (১)-এর written_off window ধরতে। পুরনো doc-এ null।
  investmentOutcomeChangedAt: nullish(DateStr),
  // ঐচ্ছিক, additive — owner-created customLedgers/{id} (kind='investment')-এ গ্রুপিং, পুরনো doc-এ null।
  ledgerId: nullish(z.string()),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type Investment = z.infer<typeof InvestmentSchema>;

export const InvestmentInputSchema = InvestmentSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type InvestmentInput = z.input<typeof InvestmentInputSchema>;

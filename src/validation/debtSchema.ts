// debts/{id} — Architecture Plan §২/§১৩। repaymentStatus এখানে নেই — lib/debtCalc.ts থেকে সবসময় লাইভ (C3)।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const DirectionSchema = z.enum(['owe_me', 'i_owe']);
export const ReceivableStatusSchema = z.enum(['active', 'doubtful', 'forgiven']);

export const RepaymentSchema = z.object({
  date: DateStr,
  amountMinor: z.number().int().positive(),
  note: z.string().default(''), // ঐচ্ছিক, additive — পুরনো doc-এ না থাকলে '' (backward-compatible)
});
export type Repayment = z.infer<typeof RepaymentSchema>;

// repayments[]-এর সিমেট্রিক — একাধিকবার ধার-দেওয়ার history (owner-approved, 2026-09-26)।
// totalAmountMinor auto-derived (Σborrowings) থাকে, debtRepo.setBorrowings() লিখে সিংক রাখে।
export const BorrowingSchema = z.object({
  date: DateStr,
  amountMinor: z.number().int().positive(),
  note: z.string().default(''),
});
export type Borrowing = z.infer<typeof BorrowingSchema>;

export const DebtSchema = z.object({
  id: z.string(),
  person: z.string().min(1),
  direction: DirectionSchema,
  // ধনাত্মক int (> 0) — R1, rules posInt()-এর সাথে মিল। Auto-derived Σborrowings, debtRepo.setBorrowings()-এই লেখা হয়।
  totalAmountMinor: z.number().int().positive(),
  currency: z.string().default('BDT'),
  date: DateStr,
  note: z.string().default(''),
  repayments: z.array(RepaymentSchema).default([]),
  // পুরনো doc-এ খালি — debtRepo-র withBorrowingsFallback() display-এ [{date, totalAmountMinor}] সিড করে (কোনো write ছাড়াই)
  borrowings: z.array(BorrowingSchema).default([]),
  // শুধু direction=owe_me-এ প্রাসঙ্গিক (§১৩); i_owe-তে UI দেখায় না, ডিফল্টই থাকে
  receivableStatus: ReceivableStatusSchema.default('active'),
  expectedRepaymentDate: nullish(DateStr), // G2, ঐচ্ছিক
  // DF1 (2026-09-24): receivableStatus সর্বশেষ কবে বদলেছে (Asia/Dhaka YYYY-MM-DD) — Cross-check known-factor (২)-এর window ধরতে। পুরনো doc-এ null।
  receivableStatusChangedAt: nullish(DateStr),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type Debt = z.infer<typeof DebtSchema>;

export const DebtInputSchema = DebtSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type DebtInput = z.input<typeof DebtInputSchema>;

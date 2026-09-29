// accountBalances/{accountId_yyyymm} + netWorthSnapshots/{yyyymm} — Architecture Plan §২ (C11/C12)।
// দুটোই `is int` শুধু (posInt না) — শূন্য/ঋণাত্মক balance বাস্তবে বৈধ হতে পারে (§৩ নিয়ম ৮, R1 ব্যতিক্রম)।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const YyyyMm = z.string().regex(/^\d{4}-\d{2}$/);

export const AccountBalanceSchema = z.object({
  accountId: z.string().min(1),
  yyyymm: YyyyMm,
  balanceMinor: z.number().int(),
  snapshotDate: DateStr,
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type AccountBalance = z.infer<typeof AccountBalanceSchema>;

export const NetWorthSnapshotSchema = z.object({
  yyyymm: YyyyMm,
  totalAssetsMinor: z.number().int(),
  snapshotDate: DateStr,
  // ঐচ্ছিক, additive (P4 Excel monthly-backfill, DF11) — Jul ২০২৬-এর মতো known Deviation-অমিল থাকা মাস চিহ্নিত
  // করে; না থাকলে/false হলে স্বাভাবিক verified snapshot। rules-এর `is int` ক্লজ অপরিবর্তিত (এই ফিল্ড rules-এ চেক হয় না)।
  unverified: z.boolean().optional(),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type NetWorthSnapshot = z.infer<typeof NetWorthSnapshotSchema>;

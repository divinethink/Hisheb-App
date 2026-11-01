import { describe, expect, it } from 'vitest';
import { buildSnapshotInsight, type InsightInput, type InsightSnapshot } from './snapshotInsight';

const T = (n: number) => n * 100; // টাকা → minor
const fmt = (m: number) => `BDT ${Math.abs(m) / 100}`;

// owner-এর বাস্তব স্ক্রিনশট (সেপ্টেম্বর: ভাঙা-হিসাব নেই, শুধু accountBalances; অক্টোবর: পূর্ণ breakdown)
const sep: InsightSnapshot = { yyyymm: '2026-09', totalAssetsMinor: T(612_169), snapshotDate: '2026-09-30' };
const octAccounts = [
  { name: 'Mbank+Cash+others', balanceMinor: T(2_708) },
  { name: 'DBBL', balanceMinor: T(133_487) },
  { name: 'SIBL', balanceMinor: T(221_372) },
  { name: 'IBBL', balanceMinor: T(980) },
  { name: 'IBBL Hira', balanceMinor: T(30_977) },
  { name: 'Biniyog Wallet', balanceMinor: 0 },
];
const oct: InsightSnapshot = {
  yyyymm: '2026-10',
  totalAssetsMinor: T(602_623),
  snapshotDate: '2026-10-31',
  breakdown: { accountsMinor: T(389_524), receivableMinor: T(4_500), investmentMinor: T(179_599), homeDepositMinor: T(21_500), gpfMinor: T(7_500), accounts: octAccounts },
};
const sepAccounts = [
  { name: 'Mbank+Cash+others', balanceMinor: T(3_963) },
  { name: 'DBBL', balanceMinor: T(184_895) },
  { name: 'SIBL', balanceMinor: T(221_372) },
  { name: 'IBBL', balanceMinor: T(980) },
  { name: 'IBBL Hira', balanceMinor: T(27_117) },
  { name: 'Biniyog Wallet', balanceMinor: 0 },
];

const base = (o: Partial<InsightInput> = {}): InsightInput => ({
  previous: sep,
  current: oct,
  previousDerivedAccounts: sepAccounts,
  currentDerivedAccounts: [],
  transactions: [],
  cross: { status: 'matched', deviationMinor: 0, unexplainedMinor: 0 },
  fmt,
  monthShort: () => 'Sep',
  ...o,
});

describe('buildSnapshotInsight', () => {
  it('মোট পরিবর্তন ও শতাংশ (অক্টোবর বনাম সেপ্টেম্বর)', () => {
    const r = buildSnapshotInsight(base());
    expect(r.totalDeltaMinor).toBe(T(-9_546));
    expect(r.totalDeltaPct).toBe(1.6);
  });

  it('আগের মাসে breakdown না থাকলে ২-ভাগ: Accounts vs Ledger & others (বানানো ৫-ভাগ নয়)', () => {
    const r = buildSnapshotInsight(base());
    expect(r.components.map((c) => c.key)).toEqual(['accounts', 'ledgerOthers']);
    expect(r.components[0].deltaMinor).toBe(T(-48_803));
    expect(r.components[1].deltaMinor).toBe(T(39_257));
  });

  it('দুই মাসেই breakdown থাকলে ৫-ভাগ', () => {
    const prev: InsightSnapshot = { ...sep, breakdown: { accountsMinor: T(438_327), receivableMinor: T(4_500), investmentMinor: T(150_000), homeDepositMinor: T(12_000), gpfMinor: T(7_342), accounts: sepAccounts } };
    const r = buildSnapshotInsight(base({ previous: prev }));
    expect(r.components.map((c) => c.key)).toEqual(['accounts', 'receivable', 'investment', 'homeDeposit', 'gpf']);
    expect(r.components.find((c) => c.key === 'investment')?.deltaMinor).toBe(T(29_599));
  });

  it('account-ভিত্তিক পরিবর্তন |delta| অনুযায়ী; অপরিবর্তিত account বাদ', () => {
    const r = buildSnapshotInsight(base());
    expect(r.accountMoves[0]).toMatchObject({ name: 'DBBL', deltaMinor: T(-51_408) });
    expect(r.accountMoves.find((a) => a.name === 'SIBL')).toBeUndefined();
    expect(r.accountMoves.find((a) => a.name === 'IBBL Hira')?.deltaMinor).toBe(T(3_860));
  });

  it('আয়-ব্যয়-সঞ্চয়', () => {
    const r = buildSnapshotInsight(base({ transactions: [{ type: 'income', amountMinor: T(100_000) }, { type: 'expense', amountMinor: T(60_000) }] }));
    expect([r.incomeMinor, r.expenseMinor, r.savingsMinor]).toEqual([T(100_000), T(60_000), T(40_000)]);
    expect(r.notes.some((n) => n.tone === 'good' && n.text.includes('Saved'))).toBe(true);
  });

  it('খরচ > আয় হলে warn নোট', () => {
    const r = buildSnapshotInsight(base({ transactions: [{ type: 'income', amountMinor: T(10) }, { type: 'expense', amountMinor: T(60) }] }));
    expect(r.notes.some((n) => n.tone === 'warn' && n.text.includes('more than you earned'))).toBe(true);
  });

  it('account কমল + ledger বাড়ল → "moved, not a loss" নোট (ছোট দিকটা)', () => {
    const r = buildSnapshotInsight(base());
    expect(r.notes.some((n) => n.text.includes('BDT 39257') && n.text.includes('not a loss'))).toBe(true);
  });

  it('Unexplained ≠ ০ হলে warn নোট সবার আগে', () => {
    const r = buildSnapshotInsight(base({ cross: { status: 'deviation', deviationMinor: T(-500), unexplainedMinor: T(-500) } }));
    expect(r.notes[0].tone).toBe('warn');
    expect(r.notes[0].text).toContain('Unexplained');
  });

  it('matched হলে good নোট; এক account >৫০% হলে concentration নোট', () => {
    const r = buildSnapshotInsight(base());
    expect(r.notes.some((n) => n.tone === 'good' && n.text.includes('matched'))).toBe(true);
    expect(r.notes.some((n) => n.text.includes('SIBL holds 57%'))).toBe(true);
  });

  it('কোনো মাসেই account-তথ্য না থাকলে components/accountMoves খালি, ক্র্যাশ নয়', () => {
    const r = buildSnapshotInsight(base({ current: { ...oct, breakdown: undefined }, previousDerivedAccounts: [], currentDerivedAccounts: [] }));
    expect(r.components).toEqual([]);
    expect(r.accountMoves).toEqual([]);
    expect(r.totalDeltaMinor).toBe(T(-9_546));
  });

  it('আগের total ০ হলে শতাংশ null', () => {
    const r = buildSnapshotInsight(base({ previous: { ...sep, totalAssetsMinor: 0 }, previousDerivedAccounts: [] }));
    expect(r.totalDeltaPct).toBeNull();
  });

  it('নোট সর্বোচ্চ ৬টা', () => {
    const r = buildSnapshotInsight(base({ cross: { status: 'deviation', deviationMinor: T(-1), unexplainedMinor: T(-1) }, transactions: [{ type: 'expense', amountMinor: T(5) }] }));
    expect(r.notes.length).toBeLessThanOrEqual(6);
  });
});

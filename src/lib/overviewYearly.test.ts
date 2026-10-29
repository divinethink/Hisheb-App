import { describe, it, expect } from 'vitest';
import { investmentHonest, lifestyleCreep, realGrowth, savingsRateStats, type InvestmentLite, type MonthRow } from './overviewCalc';
import { SettingsSchema } from '../validation/settingsSchema';

const months = (data: [number, number][]): MonthRow[] =>
  Array.from({ length: 12 }, (_, i) => {
    const [income, expense] = data[i] ?? [0, 0];
    return { yyyymm: `2026-${String(i + 1).padStart(2, '0')}`, incomeMinor: income, expenseMinor: expense, savingsMinor: income - expense, txCount: 0, fromRecord: false };
  });

describe('savingsRateStats', () => {
  it('হার, টার্গেটের উপরে মাস, সেরা মাস, মাসে আরও কত লাগবে', () => {
    const st = savingsRateStats(months([[100000, 90000], [100000, 80000], [100000, 70000], [100000, 95000]]), 20);
    expect(st.points.map((p) => (p.pct == null ? null : Math.round(p.pct * 1000) / 1000))).toEqual([10, 20, 30, 5, null, null, null, null, null, null, null, null]);
    expect(st.monthsAbove).toBe(2);
    expect(st.streakAbove).toBe(0);
    expect(st.best).toEqual({ pct: 30, months: [3] });
    expect(st.avgIncomeMinor).toBe(100000);
    expect(st.extraNeededMinor).toBe(3750);
  });
  it('টানা-মাস শেষ ডেটা-মাস থেকে পেছনে', () => {
    const st = savingsRateStats(months([[100000, 95000], [100000, 75000], [100000, 70000]]), 20);
    expect(st.streakAbove).toBe(2);
    expect(st.extraNeededMinor).toBeNull(); // গড় সঞ্চয় ২০%+ → বাড়তি লাগে না
  });
  it('সেরা মাস টাই (গোল করে সমান) → সর্বোচ্চ ২টা; ডেটা না থাকলে best null', () => {
    const st = savingsRateStats(months([[100000, 84800], [100000, 85200], [100000, 90000]]), 20);
    expect(st.best).toEqual({ pct: 15, months: [1, 2] });
    expect(savingsRateStats(months([]), 20).best).toBeNull();
  });
});

describe('lifestyleCreep', () => {
  const prev = { incomeMinor: 1_200_000, expenseMinor: 600_000 }; // ১২ মাস → গড় ১,০০,০০০ / ৫০,০০০
  it('গড় ও পরিবর্তন %; চলতি বছরে ১০ মাস দিয়ে ভাগ', () => {
    const c = lifestyleCreep(prev, { incomeMinor: 800_000, expenseMinor: 400_000 }, 10)!;
    expect(c).toMatchObject({ incomeAvgPrev: 100000, incomeAvgCur: 80000, expenseAvgPrev: 50000, expenseAvgCur: 40000 });
    expect(c.incomeChangePct).toBeCloseTo(-20, 5);
    expect(c.expenseChangePct).toBeCloseTo(-20, 5);
    expect(c.verdict).toBe('both_down_good');
  });
  it('আয় কমেছে কিন্তু খরচ কম কমেছে → income_fell_expense_stuck', () => {
    expect(lifestyleCreep(prev, { incomeMinor: 800_000, expenseMinor: 480_000 }, 10)!.verdict).toBe('income_fell_expense_stuck');
  });
  it('খরচ আয়ের চেয়ে দ্রুত বেড়েছে → expense_outpaced; কম বেড়েছে → expense_slower', () => {
    expect(lifestyleCreep(prev, { incomeMinor: 1_500_000, expenseMinor: 900_000 }, 10)!.verdict).toBe('expense_outpaced');
    expect(lifestyleCreep(prev, { incomeMinor: 1_500_000, expenseMinor: 550_000 }, 10)!.verdict).toBe('expense_slower');
  });
  it('আগের বছরে কিছু নেই বা মাস ০ → null', () => {
    expect(lifestyleCreep({ incomeMinor: 0, expenseMinor: 0 }, { incomeMinor: 5, expenseMinor: 5 }, 10)).toBeNull();
    expect(lifestyleCreep(prev, prev, 0)).toBeNull();
  });
});

describe('realGrowth', () => {
  const snaps = [
    { yyyymm: '2025-10', totalAssetsMinor: 50_000_000 },
    { yyyymm: '2026-05', totalAssetsMinor: 54_000_000 },
    { yyyymm: '2026-10', totalAssetsMinor: 56_000_000 },
  ];
  it('১২ মাস আগের snapshot-এর সাথে; আসল = নামমাত্র − মূল্যস্ফীতি', () => {
    const g = realGrowth(snaps, 10)!;
    expect(g.baseYyyymm).toBe('2025-10');
    expect(g.latestYyyymm).toBe('2026-10');
    expect(g.nominalPct).toBeCloseTo(12, 5);
    expect(g.realPct).toBeCloseTo(2, 5);
    expect(g.spanMonths).toBe(12);
    expect(g.purchasingPowerMinor).toBe(Math.round(56_000_000 / 1.1));
  });
  it('১২ মাস আগের মাস না থাকলে তার আগের সর্বশেষটা; কিছুই না থাকলে null', () => {
    const early = realGrowth([{ yyyymm: '2025-08', totalAssetsMinor: 40_000_000 }, { yyyymm: '2026-10', totalAssetsMinor: 44_000_000 }], 5)!;
    expect(early.baseYyyymm).toBe('2025-08');
    expect(early.spanMonths).toBe(14); // ১২ নয় — UI সতর্ক করে
    expect(realGrowth([{ yyyymm: '2026-03', totalAssetsMinor: 1 }, { yyyymm: '2026-10', totalAssetsMinor: 2 }], 5)).toBeNull();
    expect(realGrowth([{ yyyymm: '2026-10', totalAssetsMinor: 2 }], 5)).toBeNull();
    expect(realGrowth([], 5)).toBeNull();
  });
});

describe('investmentHonest', () => {
  const inv = (principalMinor: number, repaid: number[], investmentOutcome: InvestmentLite['investmentOutcome']): InvestmentLite => ({
    principalMinor,
    repayments: repaid.map((amountMinor) => ({ amountMinor })),
    investmentOutcome,
  });
  it('আসলের ভাগের যোগফল = মোট; লাভ/ক্ষতি/ঝুঁকি', () => {
    const r = investmentHonest([inv(100000, [110000], 'running'), inv(200000, [50000], 'running'), inv(40000, [], 'doubtful'), inv(15000, [5000], 'written_off')])!;
    expect(r.totalMinor).toBe(355000);
    expect(r).toMatchObject({ runningMinor: 150000, returnedMinor: 155000, doubtfulMinor: 40000, writtenOffMinor: 10000, profitMinor: 10000, lossMinor: 10000, netMinor: 0 });
    expect(r.runningMinor + r.returnedMinor + r.doubtfulMinor + r.writtenOffMinor).toBe(r.totalMinor);
    expect(r.netPctOfTotal).toBe(0);
    expect(r.atRiskPct).toBeCloseTo((40000 / 355000) * 100, 5);
  });
  it('খালি তালিকা → null', () => {
    expect(investmentHonest([])).toBeNull();
  });
  it('বার্ষিক হার: নিট ÷ (আসল × বছর); today/তারিখ না থাকলে বা ৩ মাসের কম গড়ে null', () => {
    // ১০০০ টাকা, ১ বছর আগে, ১১০০ ফেরত (শেষ ফেরত ঠিক ১ বছর পরে) → ১০%
    const one: InvestmentLite = { principalMinor: 100000, date: '2025-10-29', repayments: [{ amountMinor: 110000, date: '2026-10-29' }], investmentOutcome: 'running' };
    expect(investmentHonest([one], '2026-10-29')!.annualRatePct).toBeCloseTo(10, 1);
    expect(investmentHonest([one])!.annualRatePct).toBeNull();
    expect(investmentHonest([{ ...one, date: undefined }], '2026-10-29')!.annualRatePct).toBeNull();
    const fresh: InvestmentLite = { principalMinor: 100000, date: '2026-10-01', repayments: [], investmentOutcome: 'running' };
    expect(investmentHonest([fresh], '2026-10-29')!.annualRatePct).toBeNull();
  });
});

describe('Settings.inflationPct', () => {
  it('ডিফল্ট null; ০–১০০ গ্রহণ, বাইরে বাতিল', () => {
    expect(SettingsSchema.parse({}).inflationPct).toBeNull();
    expect(SettingsSchema.parse({ inflationPct: 9.5 }).inflationPct).toBe(9.5);
    expect(SettingsSchema.safeParse({ inflationPct: -1 }).success).toBe(false);
    expect(SettingsSchema.safeParse({ inflationPct: 101 }).success).toBe(false);
  });
});

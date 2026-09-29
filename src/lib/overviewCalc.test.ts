import { describe, it, expect } from 'vitest';
import { allTimeRows, avgMonthlyExpense, bestWorstMonth, categoryBreakdown, liveQueryStart, monthlyTotals, netWorthGrowthAllTime, resolveYear, runwayMonths, savingsInsight, savingsRatePct, snapshotAtOrBefore, trendSeries, yearlySavingsRates, type HistoricalLite, type TxLite, type YearRow } from './overviewCalc';

const tx = (date: string, type: 'income' | 'expense', amountMinor: number, categoryName = 'A'): TxLite => ({ date, type, amountMinor, categoryName });
const h2025: HistoricalLite = { year: 2025, totalIncomeMinor: 900, totalExpenseMinor: 600, totalDepositMinor: 5000 };

describe('resolveYear — C17 precedence', () => {
  it('doc আছে এমন বছরে লাইভ tx যোগ হয় না (double-count এড়ানো)', () => {
    const r = resolveYear(2025, [h2025], [tx('2025-10-01', 'income', 100), tx('2025-10-02', 'expense', 50)]);
    expect(r).toEqual({ year: 2025, incomeMinor: 900, expenseMinor: 600, savingsMinor: 300, depositMinor: 5000, source: 'historical' });
  });
  it('doc না থাকলে লাইভ; অন্য বছরের tx বাদ', () => {
    const r = resolveYear(2026, [h2025], [tx('2026-01-05', 'income', 400), tx('2026-02-01', 'expense', 150), tx('2025-12-31', 'expense', 999)]);
    expect(r).toEqual({ year: 2026, incomeMinor: 400, expenseMinor: 150, savingsMinor: 250, depositMinor: null, source: 'live' });
  });
});

describe('allTimeRows', () => {
  it('doc-বছর ∪ লাইভ-বছর, নতুন → পুরনো, doc-বছর শুধু doc থেকে', () => {
    const rows = allTimeRows([h2025, { year: 2024, totalIncomeMinor: 10, totalExpenseMinor: 4, totalDepositMinor: 1 }], [tx('2026-03-01', 'income', 70), tx('2025-11-01', 'income', 1)]);
    expect(rows.map((r) => [r.year, r.source, r.incomeMinor])).toEqual([[2026, 'live', 70], [2025, 'historical', 900], [2024, 'historical', 10]]);
  });
});

describe('liveQueryStart', () => {
  it('সর্বশেষ doc-বছরের পরের বছর; doc না থাকলে ২০০০', () => {
    expect(liveQueryStart([h2025, { ...h2025, year: 2023 }])).toBe('2026-01-01');
    expect(liveQueryStart([])).toBe('2000-01-01');
  });
});

describe('categoryBreakdown', () => {
  it('শুধু নির্বাচিত type, বড়→ছোট, share যোগফল ১', () => {
    const r = categoryBreakdown([tx('2026-01-01', 'expense', 300, 'X'), tx('2026-01-02', 'expense', 100, 'Y'), tx('2026-01-02', 'income', 999, 'Z'), tx('2026-01-03', 'expense', 100, 'X')]);
    expect(r.map((c) => [c.name, c.totalMinor])).toEqual([['X', 400], ['Y', 100]]);
    expect(r[0].share + r[1].share).toBeCloseTo(1);
  });
  it('topN-এর বাইরে Others; খালি হলে []', () => {
    const many = Array.from({ length: 10 }, (_, i) => tx('2026-01-01', 'expense', 100 - i, `C${i}`));
    const r = categoryBreakdown(many, 'expense', 3);
    expect(r).toHaveLength(4);
    expect(r[3].name).toBe('Others');
    expect(categoryBreakdown([])).toEqual([]);
  });
});

describe('monthlyTotals / trendSeries', () => {
  it('১২ মাস সবসময়, শুধু ওই বছরের tx', () => {
    const r = monthlyTotals([tx('2026-02-03', 'expense', 5), tx('2026-02-04', 'income', 9), tx('2025-02-04', 'income', 99)], 2026);
    expect(r).toHaveLength(12);
    expect(r[1]).toEqual({ yyyymm: '2026-02', incomeMinor: 9, expenseMinor: 5 });
    expect(r[0].incomeMinor).toBe(0);
  });
  it('trendSeries পুরনো → নতুন', () => {
    expect(trendSeries([{ yyyymm: '2026-09', totalAssetsMinor: 2 }, { yyyymm: '2026-08', totalAssetsMinor: 1 }]).map((p) => p.yyyymm)).toEqual(['2026-08', '2026-09']);
  });
});

describe('Overview Enrichment ধাপ ১ (Monthly)', () => {
  it('savingsRatePct — income ≤ 0 হলে null', () => {
    expect(savingsRatePct(1000, 400)).toBeCloseTo(60);
    expect(savingsRatePct(0, 0)).toBeNull();
    expect(savingsRatePct(-5, 0)).toBeNull();
  });

  it('snapshotAtOrBefore — সাম্প্রতিক ≤ yyyymm, না থাকলে null', () => {
    const snaps = [{ yyyymm: '2026-07', totalAssetsMinor: 100 }, { yyyymm: '2026-09', totalAssetsMinor: 300 }];
    expect(snapshotAtOrBefore(snaps, '2026-09')).toEqual({ yyyymm: '2026-09', totalAssetsMinor: 300 });
    expect(snapshotAtOrBefore(snaps, '2026-08')).toEqual({ yyyymm: '2026-07', totalAssetsMinor: 100 });
    expect(snapshotAtOrBefore(snaps, '2026-06')).toBeNull();
  });

  it('runwayMonths — avg-expense ≤ 0 হলে null', () => {
    expect(runwayMonths(12000, 4000)).toBeCloseTo(3);
    expect(runwayMonths(12000, 0)).toBeNull();
  });

  it('avgMonthlyExpense — শুধু ডেটা-থাকা মাসের গড়', () => {
    const txs = [tx('2026-08-01', 'expense', 400), tx('2026-07-01', 'expense', 200), tx('2026-08-02', 'income', 999)];
    expect(avgMonthlyExpense(txs, ['2026-08', '2026-07', '2026-06'])).toBe(300);
    expect(avgMonthlyExpense(txs, ['2026-06'])).toBeNull();
  });

  it('savingsInsight — %-পার্থক্য, ছোট/অজানা হলে null', () => {
    expect(savingsInsight(1200, 1000)).toBe('Savings 20% higher than last month');
    expect(savingsInsight(800, 1000)).toBe('Savings 20% lower than last month');
    expect(savingsInsight(1005, 1000)).toBeNull();
    expect(savingsInsight(500, 0)).toBeNull();
    expect(savingsInsight(500, null)).toBeNull();
  });
});

describe('Overview Enrichment ধাপ ২ (Yearly)', () => {
  it('bestWorstMonth — ডেটা-শূন্য মাস বাদ, সর্বোচ্চ/সর্বনিম্ন savings', () => {
    const months = [
      { yyyymm: '2026-01', incomeMinor: 1000, expenseMinor: 400 }, // savings 600
      { yyyymm: '2026-02', incomeMinor: 0, expenseMinor: 0 }, // no data — বাদ
      { yyyymm: '2026-03', incomeMinor: 500, expenseMinor: 900 }, // savings -400
    ];
    const { best, worst } = bestWorstMonth(months);
    expect(best?.yyyymm).toBe('2026-01');
    expect(worst?.yyyymm).toBe('2026-03');
  });

  it('bestWorstMonth — কোনো মাসে ডেটা না থাকলে null', () => {
    expect(bestWorstMonth([{ yyyymm: '2026-01', incomeMinor: 0, expenseMinor: 0 }])).toEqual({ best: null, worst: null });
  });
});

describe('Overview Enrichment ধাপ ৩ (All-Time)', () => {
  const row = (year: number, incomeMinor: number, expenseMinor: number): YearRow => ({ year, incomeMinor, expenseMinor, savingsMinor: incomeMinor - expenseMinor, depositMinor: null, source: 'live' });

  it('yearlySavingsRates — পুরনো → নতুন, income ≤ 0 বছর বাদ', () => {
    const rows = [row(2026, 1000, 800), row(2023, 0, 0), row(2024, 2000, 1000)];
    expect(yearlySavingsRates(rows)).toEqual([{ year: 2024, pct: 50 }, { year: 2026, pct: 20 }]);
  });

  it('netWorthGrowthAllTime — ২টার কম snapshot হলে null', () => {
    expect(netWorthGrowthAllTime([{ yyyymm: '2026-08', totalAssetsMinor: 100 }])).toBeNull();
    expect(netWorthGrowthAllTime([])).toBeNull();
  });

  it('netWorthGrowthAllTime — প্রথম ও সর্বশেষ snapshot-এর মধ্যে %', () => {
    const g = netWorthGrowthAllTime([
      { yyyymm: '2026-09', totalAssetsMinor: 220 },
      { yyyymm: '2026-08', totalAssetsMinor: 200 },
    ]);
    expect(g).toEqual({ earliestYyyymm: '2026-08', earliestMinor: 200, latestYyyymm: '2026-09', latestMinor: 220, deltaPct: 10 });
  });
});

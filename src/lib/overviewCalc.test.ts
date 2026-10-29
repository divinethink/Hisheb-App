import { describe, it, expect } from 'vitest';
import { allTimeRows, categoryList, flowByMonth, monthRows, txsInMonth, txsInYear, yearDetailKind, avgMonthlyExpense, avgMonthlySavings, netWorthYtd, bestWorstMonth, categoryBreakdown, liveQueryStart, monthlyTotals, netWorthGrowthAllTime, resolveYear, runwayMonths, savingsInsight, savingsRatePct, snapshotAtOrBefore, trendSeries, yearlySavingsRates, netWorthBridge, recentMonths, goalProjection, assetMix, emergencyFund, type HistoricalLite, type TxLite, type YearRow } from './overviewCalc';

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

describe('monthRows', () => {
  const txs = [tx('2026-03-05', 'income', 1000, 'Salary'), tx('2026-03-09', 'expense', 400, 'Rent'), tx('2026-03-20', 'expense', 100, 'Food'), tx('2026-05-01', 'expense', 50, 'Food'), tx('2025-03-01', 'income', 9999)];
  it('১২টা সারি জানু→ডিসে; অন্য বছর বাদ; লেনদেনহীন মাসে txCount ০', () => {
    const rows = monthRows(txs, 2026);
    expect(rows).toHaveLength(12);
    expect(rows[0].yyyymm).toBe('2026-01');
    expect(rows[0].txCount).toBe(0);
    expect(rows[2]).toMatchObject({ incomeMinor: 1000, expenseMinor: 500, savingsMinor: 500, txCount: 3 });
    expect(rows[4]).toMatchObject({ incomeMinor: 0, expenseMinor: 50, savingsMinor: -50 });
  });
  it('১২ মাসের যোগফল বছরের মোটের সাথে মেলে', () => {
    const rows = monthRows(txs, 2026);
    const year = resolveYear(2026, [], txs);
    expect(rows.reduce((s, r) => s + r.incomeMinor, 0)).toBe(year.incomeMinor);
    expect(rows.reduce((s, r) => s + r.expenseMinor, 0)).toBe(year.expenseMinor);
  });
  it('txsInMonth/txsInYear ঠিক সময়ের লেনদেনই দেয়', () => {
    expect(txsInMonth(txs, '2026-03')).toHaveLength(3);
    expect(txsInYear(txs, 2025)).toHaveLength(1);
  });
});

describe('categoryList', () => {
  const txs = [tx('2026-03-01', 'expense', 500, 'A'), tx('2026-03-02', 'expense', 300, 'B'), tx('2026-03-03', 'expense', 100, 'C'), tx('2026-03-04', 'expense', 50, 'D'), tx('2026-03-05', 'income', 900, 'Salary')];
  it('সব category, বড় → ছোট, Others নেই; যোগফল মোট ব্যয়ের সমান, শতাংশ ১', () => {
    const list = categoryList(txs, 'expense');
    expect(list.map((c) => c.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(list.reduce((s, c) => s + c.totalMinor, 0)).toBe(950);
    expect(list.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
  });
  it('৮টার বেশি category-তেও Others বান্ডিল হয় না; income আলাদা', () => {
    const many = Array.from({ length: 12 }, (_, i) => tx('2026-03-01', 'expense', 10 + i, `C${i}`));
    expect(categoryList(many, 'expense')).toHaveLength(12);
    expect(categoryList(txs, 'income').map((c) => c.name)).toEqual(['Salary']);
  });
  it('লেনদেন না থাকলে খালি', () => {
    expect(categoryList([], 'income')).toEqual([]);
  });
});

describe('yearDetailKind + historical double-count', () => {
  it('লাইভ নেই → none; historical+লাইভ → partial; শুধু লাইভ → full', () => {
    expect(yearDetailKind(true, 0)).toBe('none');
    expect(yearDetailKind(true, 12)).toBe('partial');
    expect(yearDetailKind(false, 12)).toBe('full');
    expect(yearDetailKind(false, 0)).toBe('none');
  });
  it('historical বছরের মোট doc থেকেই; আংশিক লাইভ যোগ হয় না, খাতওয়ারি তালিকা মোটের সাথে মেলে না', () => {
    const live = [tx('2025-10-01', 'income', 100, 'Salary'), tx('2025-10-02', 'expense', 50, 'Food')];
    const row = allTimeRows([h2025], live).find((r) => r.year === 2025)!;
    expect(row.incomeMinor).toBe(900);
    expect(row.expenseMinor).toBe(600);
    expect(categoryList(live, 'expense').reduce((s, c) => s + c.totalMinor, 0)).toBe(50);
  });
});

describe('monthRows + flow (pre-app মাস)', () => {
  const live = [tx('2025-09-25', 'income', 100, 'Salary'), tx('2025-10-02', 'expense', 40, 'Food')];
  const flow = new Map([['2025-01', { incomeMinor: 500, expenseMinor: 300 }], ['2025-09', { incomeMinor: 900, expenseMinor: 700 }]]);
  it('flow থাকা মাসে flow-এর সংখ্যা (লাইভ যোগ হয় না); না থাকলে লাইভ; flow-মাসে লেনদেন না থাকলেও সারি আছে', () => {
    const rows = monthRows(live, 2025, flow);
    expect(rows[0]).toMatchObject({ incomeMinor: 500, expenseMinor: 300, savingsMinor: 200, txCount: 0, fromRecord: true });
    expect(rows[8]).toMatchObject({ incomeMinor: 900, expenseMinor: 700, txCount: 1, fromRecord: true });
    expect(rows[9]).toMatchObject({ incomeMinor: 0, expenseMinor: 40, fromRecord: false });
    expect(rows[1]).toMatchObject({ txCount: 0, fromRecord: false });
  });
  it('flow ছাড়া আচরণ অপরিবর্তিত', () => {
    expect(monthRows(live, 2025)[8]).toMatchObject({ incomeMinor: 100, fromRecord: false });
  });
  it('flowByMonth শুধু সেই বছরের flow-ওয়ালা snapshot নেয়', () => {
    const m = flowByMonth([{ yyyymm: '2025-01', flow: { incomeMinor: 1, expenseMinor: 2 } }, { yyyymm: '2025-02' }, { yyyymm: '2026-01', flow: { incomeMinor: 3, expenseMinor: 4 } }], 2025);
    expect([...m.keys()]).toEqual(['2025-01']);
  });
});

describe('Monthly Key numbers helpers', () => {
  it('avgMonthlySavings — শুধু ডেটা-থাকা মাসের গড় (আয় − ব্যয়)', () => {
    const txs = [tx('2026-08-01', 'income', 1000), tx('2026-08-02', 'expense', 400), tx('2026-10-01', 'expense', 200)];
    expect(avgMonthlySavings(txs, ['2026-08', '2026-09', '2026-10'])).toBeCloseTo((600 - 200) / 2);
    expect(avgMonthlySavings([], ['2026-08'])).toBeNull();
  });
  it('netWorthYtd — আগের বছরের শেষ snapshot থেকে', () => {
    const snaps = [{ yyyymm: '2025-11', totalAssetsMinor: 100 }, { yyyymm: '2025-12', totalAssetsMinor: 200 }, { yyyymm: '2026-06', totalAssetsMinor: 260 }, { yyyymm: '2026-10', totalAssetsMinor: 300 }];
    expect(netWorthYtd(snaps, '2026-10')).toEqual({ baseYyyymm: '2025-12', currentYyyymm: '2026-10', deltaMinor: 100, deltaPct: 50 });
  });
  it('netWorthYtd — আগের বছর না থাকলে এ বছরের প্রথম snapshot; একটাই হলে null', () => {
    const snaps = [{ yyyymm: '2026-03', totalAssetsMinor: 100 }, { yyyymm: '2026-10', totalAssetsMinor: 150 }];
    expect(netWorthYtd(snaps, '2026-10')?.baseYyyymm).toBe('2026-03');
    expect(netWorthYtd([{ yyyymm: '2026-10', totalAssetsMinor: 150 }], '2026-10')).toBeNull();
    expect(netWorthYtd([], '2026-10')).toBeNull();
  });
});

describe('netWorthBridge — সম্পদ কোথা থেকে বাড়ল', () => {
  const snaps = [
    { yyyymm: '2025-10', totalAssetsMinor: 1000 },
    { yyyymm: '2026-01', totalAssetsMinor: 1100 },
    { yyyymm: '2026-10', totalAssetsMinor: 1500 },
  ];
  it('১২ মাস আগের base; own = লাইভ tx-এর (আয় − ব্যয়), বাকিটা other; ডেটা-শূন্য মাস uncovered', () => {
    const r = netWorthBridge(snaps, [tx('2026-02-01', 'income', 300), tx('2026-02-02', 'expense', 100), tx('2026-03-05', 'expense', 50)]);
    expect(r).toMatchObject({ baseYyyymm: '2025-10', curYyyymm: '2026-10', deltaMinor: 500, ownMinor: 150, otherMinor: 350, monthsSpan: 12, uncoveredMonths: 10 });
  });
  it('snapshot.flow থাকলে সেটা tx-এর আগে ব্যবহার হয় (double-count নয়)', () => {
    const withFlow = [{ yyyymm: '2025-10', totalAssetsMinor: 1000 }, { yyyymm: '2025-11', totalAssetsMinor: 1010, flow: { incomeMinor: 90, expenseMinor: 40 } }, { yyyymm: '2025-12', totalAssetsMinor: 1100 }];
    const r = netWorthBridge(withFlow, [tx('2025-11-02', 'expense', 999)], 12);
    expect(r?.ownMinor).toBe(50);
    expect(r?.deltaMinor).toBe(100);
  });
  it('১২ মাসের কম ইতিহাস হলে সবচেয়ে পুরনো snapshot base', () => {
    const r = netWorthBridge([{ yyyymm: '2026-08', totalAssetsMinor: 10 }, { yyyymm: '2026-10', totalAssetsMinor: 40 }], []);
    expect(r).toMatchObject({ baseYyyymm: '2026-08', monthsSpan: 2, uncoveredMonths: 2, ownMinor: 0, otherMinor: 30 });
  });
  it('২টার কম snapshot হলে null', () => {
    expect(netWorthBridge([{ yyyymm: '2026-10', totalAssetsMinor: 10 }], [])).toBeNull();
    expect(netWorthBridge([], [])).toBeNull();
  });
});

describe('recentMonths', () => {
  it('আগের n মাস, চলতি মাস বাদ, পুরনো → নতুন', () => {
    expect(recentMonths('2026-02', 3)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('goalProjection', () => {
  it('গড় জমায় মাস ও তারিখ; boost হলে কম মাস', () => {
    const r = goalProjection(61216900, 100000000, 486200, '2026-10', 500000);
    expect(r.remainingMinor).toBe(38783100);
    expect(r.monthsAtPace).toBe(80);
    expect(r.paceYyyymm).toBe('2033-06');
    expect(r.monthsBoosted).toBe(40);
    expect(r.monthsSaved).toBe(40);
  });
  it('লক্ষ্য পূর্ণ হলে reached', () => {
    expect(goalProjection(200, 100, 5, '2026-10', 1)).toMatchObject({ reached: true, remainingMinor: 0, monthsAtPace: null });
  });
  it('জমা ≤ 0 বা null হলে pace null (fabricate না), boost হিসাব থাকে', () => {
    const r = goalProjection(0, 1000, -50, '2026-10', 100);
    expect(r.monthsAtPace).toBeNull();
    expect(r.monthsBoosted).toBe(10);
    expect(r.monthsSaved).toBeNull();
    expect(goalProjection(0, 1000, null, '2026-10', 0).monthsBoosted).toBeNull();
  });
  it('৫০ বছরের বেশি লাগলে null', () => {
    expect(goalProjection(0, 1_000_000, 1, '2026-10', 0).monthsAtPace).toBeNull();
  });
});

describe('assetMix', () => {
  it('ভাগ, outside (বিনিয়োগ + পাওনা) ও cash share', () => {
    const m = assetMix({ accountsMinor: 100, receivableMinor: 200, investmentMinor: 300, homeDepositMinor: 0, gpfMinor: 400 });
    expect(m?.totalMinor).toBe(1000);
    expect(m?.items.map((i) => i.key)).toEqual(['accounts', 'investment', 'receivable', 'gpf']);
    expect(m?.outsideShare).toBeCloseTo(0.5);
    expect(m?.cashShare).toBeCloseTo(0.1);
  });
  it('ঋণাত্মক খাত বাদ; breakdown না থাকলে/মোট ≤ 0 হলে null', () => {
    expect(assetMix({ accountsMinor: -50, receivableMinor: 0, investmentMinor: 100, homeDepositMinor: 0, gpfMinor: 0 })?.totalMinor).toBe(100);
    expect(assetMix(undefined)).toBeNull();
    expect(assetMix({ accountsMinor: -5, receivableMinor: 0, investmentMinor: 0, homeDepositMinor: 0, gpfMinor: 0 })).toBeNull();
  });
});

describe('emergencyFund', () => {
  it('৬ মাসের লক্ষ্য, pct ও ঘাটতি', () => {
    expect(emergencyFund(10500000, 4707100)).toEqual({ targetMinor: 28242600, pct: expect.closeTo(37.18, 1), shortfallMinor: 17742600 });
  });
  it('pct সর্বোচ্চ ১০০; গড় খরচ null/≤0 হলে null', () => {
    expect(emergencyFund(10000, 100)?.pct).toBe(100);
    expect(emergencyFund(10000, null)).toBeNull();
    expect(emergencyFund(10000, 0)).toBeNull();
  });
});

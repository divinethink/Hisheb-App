// Overview অ্যাগ্রিগেশন — pure, platform-independent (lib/ purity, Architecture Plan §০/§২)।
// Yearly/All-Time precedence (C17): যে বছরের historicalYearlyTotals doc আছে, সেই বছরের টোটাল শুধু ওই doc থেকে —
// লাইভ transactions যোগ হয় না (CSV overlap-এ double-count এড়াতে)। doc না থাকা বছরে লাইভ।
export interface TxLite {
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  amountMinor: number;
  categoryName: string;
  note?: string;
  labelNames?: readonly string[];
}

export interface HistoricalLite {
  year: number;
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  totalDepositMinor: number;
}

export interface YearRow {
  year: number;
  incomeMinor: number;
  expenseMinor: number;
  savingsMinor: number;
  depositMinor: number | null; // শুধু historical doc-এ আছে
  source: 'historical' | 'live';
}

export interface CategoryShare {
  name: string;
  totalMinor: number;
  share: number; // 0..1
}

/** ক্যাটাগরি-ওয়াইজ যোগফল, বড় → ছোট; topN-এর বাইরেরগুলো "Others"-এ। */
export function categoryBreakdown(txs: readonly TxLite[], type: 'income' | 'expense' = 'expense', topN = 8): CategoryShare[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== type) continue;
    map.set(t.categoryName, (map.get(t.categoryName) ?? 0) + t.amountMinor);
    total += t.amountMinor;
  }
  if (total === 0) return [];
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN);
  const restSum = sorted.slice(topN).reduce((s, [, v]) => s + v, 0);
  const out = top.map(([name, v]) => ({ name, totalMinor: v, share: v / total }));
  if (restSum > 0) out.push({ name: 'Others', totalMinor: restSum, share: restSum / total });
  return out;
}

const sumTxs = (txs: readonly TxLite[]) => {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amountMinor;
    else expense += t.amountMinor;
  }
  return { income, expense };
};

export function resolveYear(year: number, historical: readonly HistoricalLite[], liveTxs: readonly TxLite[]): YearRow {
  const doc = historical.find((h) => h.year === year);
  if (doc) {
    return {
      year,
      incomeMinor: doc.totalIncomeMinor,
      expenseMinor: doc.totalExpenseMinor,
      savingsMinor: doc.totalIncomeMinor - doc.totalExpenseMinor,
      depositMinor: doc.totalDepositMinor,
      source: 'historical',
    };
  }
  const { income, expense } = sumTxs(liveTxs.filter((t) => t.date.startsWith(`${year}-`)));
  return { year, incomeMinor: income, expenseMinor: expense, savingsMinor: income - expense, depositMinor: null, source: 'live' };
}

/** সব বছর (doc-ওয়ালা ∪ লাইভ ডেটা-ওয়ালা), নতুন → পুরনো। */
export function allTimeRows(historical: readonly HistoricalLite[], liveTxs: readonly TxLite[]): YearRow[] {
  const years = new Set<number>(historical.map((h) => h.year));
  for (const t of liveTxs) years.add(Number(t.date.slice(0, 4)));
  return [...years].sort((a, b) => b - a).map((y) => resolveYear(y, historical, liveTxs));
}

/** All-Time-এর লাইভ query শুরু: সর্বশেষ doc-বছরের পরের বছর থেকে (আগের বছরগুলো doc থেকেই আসে — পুরো collection স্ক্যান না)। */
export function liveQueryStart(historical: readonly HistoricalLite[]): string {
  if (historical.length === 0) return '2000-01-01';
  return `${Math.max(...historical.map((h) => h.year)) + 1}-01-01`;
}

/** নির্দিষ্ট বছরের ১২ মাসের আয়/ব্যয় (লাইভ ডেটা থেকে)। */
export function monthlyTotals(txs: readonly TxLite[], year: number): { yyyymm: string; incomeMinor: number; expenseMinor: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const yyyymm = `${year}-${String(i + 1).padStart(2, '0')}`;
    const { income, expense } = sumTxs(txs.filter((t) => t.date.startsWith(yyyymm)));
    return { yyyymm, incomeMinor: income, expenseMinor: expense };
  });
}

/** Net Worth Trend (G1): netWorthSnapshots → পুরনো → নতুন সিরিজ। pure display-cache, live-calc-এর উৎস না (§২)। */
export function trendSeries(snapshots: readonly { yyyymm: string; totalAssetsMinor: number }[]): { yyyymm: string; valueMinor: number }[] {
  return [...snapshots]
    .sort((a, b) => a.yyyymm.localeCompare(b.yyyymm))
    .map((s) => ({ yyyymm: s.yyyymm, valueMinor: s.totalAssetsMinor }));
}

// ---- Overview Enrichment ধাপ ১ (Monthly view) — 1_3_Hisheb_App_Overview_UI_Enrichment.md §২/§৩ ----

export interface NetWorthSnapshotLite {
  yyyymm: string;
  totalAssetsMinor: number;
}

/** সঞ্চয়ের হার %, income ≤ 0 হলে null (undefined-এর বদলে explicit "দেখানো যাবে না")। */
export function savingsRatePct(incomeMinor: number, expenseMinor: number): number | null {
  if (incomeMinor <= 0) return null;
  return ((incomeMinor - expenseMinor) / incomeMinor) * 100;
}

/** yyyymm-এর ≤ সবচেয়ে সাম্প্রতিক snapshot (মাসে doc না থাকলে সর্বশেষ উপলব্ধটা — কখনো fabricate না)। */
export function snapshotAtOrBefore(snapshots: readonly NetWorthSnapshotLite[], yyyymm: string): NetWorthSnapshotLite | null {
  const eligible = snapshots.filter((s) => s.yyyymm <= yyyymm);
  if (eligible.length === 0) return null;
  return eligible.reduce((a, b) => (b.yyyymm > a.yyyymm ? b : a));
}

/** Total Assets ÷ গড় মাসিক ব্যয়। গড় ব্যয় ≤ 0 (ডেটা নেই) হলে null — লাইন hide করার সিগন্যাল। */
export function runwayMonths(totalAssetsMinor: number, avgMonthlyExpenseMinor: number): number | null {
  if (avgMonthlyExpenseMinor <= 0) return null;
  return totalAssetsMinor / avgMonthlyExpenseMinor;
}

/** দেওয়া yyyymm-তালিকার মধ্যে যতগুলোতে actual লেনদেন আছে তার গড় মাসিক ব্যয় (ডেটা-শূন্য মাস গড়ে বায়াস করে না)। */
export function avgMonthlyExpense(txs: readonly TxLite[], months: readonly string[]): number | null {
  let total = 0;
  let covered = 0;
  for (const m of months) {
    const monthExpense = txs.filter((t) => t.date.startsWith(m) && t.type === 'expense');
    if (monthExpense.length === 0) continue;
    covered += 1;
    total += monthExpense.reduce((s, t) => s + t.amountMinor, 0);
  }
  return covered === 0 ? null : total / covered;
}

/** rule-based এক-লাইন insight (কোনো AI/ML না) — আগের মাসের savings শূন্য/অজানা হলে null। */
export function savingsInsight(currentSavingsMinor: number, previousSavingsMinor: number | null): string | null {
  if (previousSavingsMinor === null || previousSavingsMinor === 0) return null;
  const diffPct = ((currentSavingsMinor - previousSavingsMinor) / Math.abs(previousSavingsMinor)) * 100;
  if (Math.abs(diffPct) < 1) return null;
  const rounded = Math.round(Math.abs(diffPct));
  return `Savings ${rounded}% ${diffPct > 0 ? 'higher' : 'lower'} than last month`;
}

// ---- Overview Enrichment ধাপ ২ (Yearly view) — 1_3_Hisheb_App_Overview_UI_Enrichment.md §২/§৩ ----

export interface MonthSavings {
  yyyymm: string;
  incomeMinor: number;
  expenseMinor: number;
  savingsMinor: number;
}

/** সেই বছরের সর্বোচ্চ-savings (Best) ও সর্বনিম্ন-savings (Toughest) মাস — ডেটা-শূন্য মাস বাদ (fabricate না)। */
export function bestWorstMonth(
  months: readonly { yyyymm: string; incomeMinor: number; expenseMinor: number }[],
): { best: MonthSavings | null; worst: MonthSavings | null } {
  const withData = months
    .filter((m) => m.incomeMinor !== 0 || m.expenseMinor !== 0)
    .map((m) => ({ ...m, savingsMinor: m.incomeMinor - m.expenseMinor }));
  if (withData.length === 0) return { best: null, worst: null };
  const best = withData.reduce((a, b) => (b.savingsMinor > a.savingsMinor ? b : a));
  const worst = withData.reduce((a, b) => (b.savingsMinor < a.savingsMinor ? b : a));
  return { best, worst };
}

// ---- Overview Enrichment ধাপ ৩ (All-Time view) — 1_3_Hisheb_App_Overview_UI_Enrichment.md §২/§৩ ----

export interface YearSavingsRate {
  year: number;
  pct: number;
}

/** বছরভিত্তিক savings rate %, পুরনো → নতুন; income ≤ 0 (savingsRatePct null) হওয়া বছর বাদ (fabricate না)। */
export function yearlySavingsRates(rows: readonly YearRow[]): YearSavingsRate[] {
  return [...rows]
    .sort((a, b) => a.year - b.year)
    .map((r) => ({ year: r.year, pct: savingsRatePct(r.incomeMinor, r.expenseMinor) }))
    .filter((r): r is YearSavingsRate => r.pct !== null);
}

export interface NetWorthGrowth {
  earliestYyyymm: string;
  earliestMinor: number;
  latestYyyymm: string;
  latestMinor: number;
  deltaPct: number | null;
}

/** সর্বপ্রথম ও সর্বশেষ সংরক্ষিত netWorthSnapshots-এর মধ্যে growth — ২টার কম snapshot থাকলে null (All-Time Summary কার্ড hide করার সিগন্যাল)। */
export function netWorthGrowthAllTime(snapshots: readonly NetWorthSnapshotLite[]): NetWorthGrowth | null {
  const series = trendSeries(snapshots);
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const deltaPct = first.valueMinor !== 0 ? ((last.valueMinor - first.valueMinor) / Math.abs(first.valueMinor)) * 100 : null;
  return { earliestYyyymm: first.yyyymm, earliestMinor: first.valueMinor, latestYyyymm: last.yyyymm, latestMinor: last.valueMinor, deltaPct };
}

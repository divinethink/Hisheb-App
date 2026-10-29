// Overview অ্যাগ্রিগেশন — pure, platform-independent (lib/ purity, Architecture Plan §০/§২)।
// Yearly/All-Time precedence (C17): যে বছরের historicalYearlyTotals doc আছে, সেই বছরের টোটাল শুধু ওই doc থেকে —
// লাইভ transactions যোগ হয় না (CSV overlap-এ double-count এড়াতে)। doc না থাকা বছরে লাইভ।
import { shiftMonth } from './date';

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

/** দেওয়া yyyymm-তালিকার মধ্যে যতগুলোতে actual লেনদেন আছে তার গড় মাসিক সঞ্চয় (আয় − ব্যয়); ডেটা-শূন্য মাস বাদ। */
export function avgMonthlySavings(txs: readonly TxLite[], months: readonly string[]): number | null {
  let total = 0;
  let covered = 0;
  for (const m of months) {
    const inMonth = txs.filter((t) => t.date.startsWith(m));
    if (inMonth.length === 0) continue;
    covered += 1;
    total += inMonth.reduce((a, t) => a + (t.type === 'income' ? t.amountMinor : -t.amountMinor), 0);
  }
  return covered === 0 ? null : total / covered;
}

export interface NetWorthYtd {
  baseYyyymm: string;
  currentYyyymm: string;
  deltaMinor: number;
  deltaPct: number | null;
}

/** এ বছরে Total Assets কতটা বাড়ল/কমল: yyyymm-এর snapshot বনাম আগের বছরের শেষ snapshot
 *  (না থাকলে এ বছরের প্রথম snapshot)। তুলনার দুটো আলাদা snapshot না থাকলে null — কিছু fabricate করে না। */
export function netWorthYtd(snapshots: readonly NetWorthSnapshotLite[], yyyymm: string): NetWorthYtd | null {
  const cur = snapshotAtOrBefore(snapshots, yyyymm);
  if (!cur) return null;
  const yearStart = `${yyyymm.slice(0, 4)}-01`;
  const prior = snapshots.filter((x) => x.yyyymm < yearStart);
  const inYear = snapshots.filter((x) => x.yyyymm >= yearStart && x.yyyymm <= cur.yyyymm);
  const pick = (arr: readonly NetWorthSnapshotLite[], latest: boolean) =>
    arr.reduce<NetWorthSnapshotLite | null>((a, b) => (a === null || (latest ? b.yyyymm > a.yyyymm : b.yyyymm < a.yyyymm) ? b : a), null);
  const base = pick(prior, true) ?? pick(inYear, false);
  if (!base || base.yyyymm === cur.yyyymm) return null;
  const deltaMinor = cur.totalAssetsMinor - base.totalAssetsMinor;
  const deltaPct = base.totalAssetsMinor !== 0 ? (deltaMinor / Math.abs(base.totalAssetsMinor)) * 100 : null;
  return { baseYyyymm: base.yyyymm, currentYyyymm: cur.yyyymm, deltaMinor, deltaPct };
}

/** rule-based এক-লাইন insight (কোনো AI/ML না) — আগের মাসের savings শূন্য/অজানা হলে null।
 *  চিহ্ন বদলালে (ধনাত্মক ↔ ঋণাত্মক) % অর্থহীন (যেমন "546% lower"), তাই টাকার বাক্য। `fmtNet` সাইন-সহ টাকা-ফরম্যাট (UI দেয়)। */
export function savingsInsight(currentSavingsMinor: number, previousSavingsMinor: number | null, fmtNet: (minor: number) => string = (m) => String(m)): string | null {
  if (previousSavingsMinor === null || previousSavingsMinor === 0) return null;
  if (currentSavingsMinor < 0 !== previousSavingsMinor < 0 && currentSavingsMinor !== 0) {
    const verb = currentSavingsMinor < 0 ? 'turned negative' : 'turned positive';
    return `Savings ${verb}: ${fmtNet(previousSavingsMinor)} last month → ${fmtNet(currentSavingsMinor)} this month`;
  }
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

// ---- Overview "Monthly breakdown" ও "Years" collapsible তালিকা — নতুন query/schema নেই, লোড-হওয়া txs থেকে derive ----

export interface MonthRow {
  yyyymm: string;
  incomeMinor: number;
  expenseMinor: number;
  savingsMinor: number;
  txCount: number; // লাইভ লেনদেন-সংখ্যা
  fromRecord: boolean; // true হলে মাসের আয়/ব্যয় সংরক্ষিত Excel-record (snapshot.flow) থেকে, লাইভ নয়
}

export interface MonthFlow {
  incomeMinor: number;
  expenseMinor: number;
}

/** snapshots-এর `flow` থেকে নির্দিষ্ট বছরের yyyymm → আয়/ব্যয় (pre-app মাস; শুধু যেগুলোতে আছে)। */
export function flowByMonth(snapshots: readonly { yyyymm: string; flow?: MonthFlow }[], year: number): Map<string, MonthFlow> {
  const out = new Map<string, MonthFlow>();
  for (const s of snapshots) if (s.flow && s.yyyymm.startsWith(`${year}-`)) out.set(s.yyyymm, s.flow);
  return out;
}

/** নির্দিষ্ট বছরের ১২ মাস (জানু → ডিসে), এক pass-এ। flow থাকা মাসে আয়/ব্যয় flow থেকে (পুরো মাসের Excel-record,
 *  লাইভ আংশিক হলেও double-count না); না থাকলে লাইভ। */
export function monthRows(txs: readonly TxLite[], year: number, flow?: ReadonlyMap<string, MonthFlow>): MonthRow[] {
  const rows: MonthRow[] = Array.from({ length: 12 }, (_, i) => ({
    yyyymm: `${year}-${String(i + 1).padStart(2, '0')}`,
    incomeMinor: 0,
    expenseMinor: 0,
    savingsMinor: 0,
    txCount: 0,
    fromRecord: false,
  }));
  for (const t of txs) {
    if (Number(t.date.slice(0, 4)) !== year) continue;
    const r = rows[Number(t.date.slice(5, 7)) - 1];
    if (!r) continue;
    if (t.type === 'income') r.incomeMinor += t.amountMinor;
    else r.expenseMinor += t.amountMinor;
    r.txCount += 1;
  }
  for (const r of rows) {
    const f = flow?.get(r.yyyymm);
    if (f) {
      r.incomeMinor = f.incomeMinor;
      r.expenseMinor = f.expenseMinor;
      r.fromRecord = true;
    }
    r.savingsMinor = r.incomeMinor - r.expenseMinor;
  }
  return rows;
}

export function txsInMonth<T extends TxLite>(txs: readonly T[], yyyymm: string): T[] {
  return txs.filter((t) => t.date.startsWith(yyyymm));
}

export function txsInYear<T extends TxLite>(txs: readonly T[], year: number): T[] {
  return txs.filter((t) => t.date.startsWith(`${year}-`));
}

/** সব category (\"Others\" বান্ডিল ছাড়া), বড় → ছোট। */
export function categoryList(txs: readonly TxLite[], type: 'income' | 'expense'): CategoryShare[] {
  return categoryBreakdown(txs, type, Number.MAX_SAFE_INTEGER);
}

export type YearDetailKind = 'full' | 'partial' | 'none';

/** খোলা বছরে কী দেখানো হবে: লাইভ লেনদেন নেই → none; historical doc + আংশিক লাইভ → partial; নাহলে full। */
export function yearDetailKind(isHistorical: boolean, liveTxCount: number): YearDetailKind {
  if (liveTxCount === 0) return 'none';
  return isHistorical ? 'partial' : 'full';
}


// ---- All-Time ধাপ ১ (Net Worth Bridge / Goal / Asset Mix / Runway) — সব pure, নতুন query/schema নেই ----

export interface SnapshotWithFlow {
  yyyymm: string;
  snapshotDate?: string;
  totalAssetsMinor: number;
  flow?: { incomeMinor: number; expenseMinor: number };
}

export interface NetWorthBridge {
  baseYyyymm: string;
  curYyyymm: string;
  /** snapshot-এর আসল তারিখ (YYYY-MM-DD), না থাকলে null */
  baseDate: string | null;
  curDate: string | null;
  baseMinor: number;
  curMinor: number;
  deltaMinor: number;
  /** নিজের জমা = সময়টায় (আয় − ব্যয়); ডেটা-শূন্য মাস বাদ (fabricate না) */
  ownMinor: number;
  /** বাকিটা: বিনিয়োগ-মান বদল, পাওনা আদায়, Cross-check অমিল ইত্যাদি */
  otherMinor: number;
  monthsSpan: number;
  uncoveredMonths: number;
}

/** শেষ snapshot বনাম ~`months` মাস আগের snapshot (না থাকলে সবচেয়ে পুরনোটা)। মাসের আয়-ব্যয়ের উৎস: snapshot.flow, না থাকলে লাইভ tx।
 *  তুলনার ২টা আলাদা snapshot না থাকলে null। */
export function netWorthBridge(snapshots: readonly SnapshotWithFlow[], txs: readonly TxLite[], months = 12): NetWorthBridge | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
  const cur = sorted[sorted.length - 1];
  const base = snapshotAtOrBefore(sorted.filter((s) => s.yyyymm < cur.yyyymm), shiftMonth(cur.yyyymm, -months)) ?? sorted[0];
  if (base.yyyymm >= cur.yyyymm) return null;
  const flowOf = new Map(sorted.filter((s) => s.flow).map((s) => [s.yyyymm, s.flow as { incomeMinor: number; expenseMinor: number }]));
  let own = 0;
  let uncovered = 0;
  let span = 0;
  for (let m = shiftMonth(base.yyyymm, 1); m <= cur.yyyymm; m = shiftMonth(m, 1)) {
    span += 1;
    const f = flowOf.get(m);
    if (f) {
      own += f.incomeMinor - f.expenseMinor;
      continue;
    }
    const inMonth = txs.filter((t) => t.date.startsWith(m));
    if (inMonth.length === 0) {
      uncovered += 1;
      continue;
    }
    own += inMonth.reduce((a, t) => a + (t.type === 'income' ? t.amountMinor : -t.amountMinor), 0);
  }
  const delta = cur.totalAssetsMinor - base.totalAssetsMinor;
  return {
    baseYyyymm: base.yyyymm,
    curYyyymm: cur.yyyymm,
    baseDate: sorted.find((x) => x.yyyymm === base.yyyymm)?.snapshotDate ?? null,
    curDate: cur.snapshotDate ?? null,
    baseMinor: base.totalAssetsMinor,
    curMinor: cur.totalAssetsMinor,
    deltaMinor: delta,
    ownMinor: own,
    otherMinor: delta - own,
    monthsSpan: span,
    uncoveredMonths: uncovered,
  };
}

/** `yyyymm`-এর আগের n টা সম্পূর্ণ মাস (yyyymm নিজে বাদ — চলতি মাস অসম্পূর্ণ, গড় বায়াস করে), পুরনো → নতুন। */
export function recentMonths(yyyymm: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(yyyymm, -(n - i)));
}

export interface GoalProjection {
  remainingMinor: number;
  reached: boolean;
  /** গড় জমায় পৌঁছাতে মাস; জমা ≤ 0 বা ৫০ বছরের বেশি হলে null */
  monthsAtPace: number | null;
  paceYyyymm: string | null;
  /** মাসে `boostMinor` বেশি জমালে */
  monthsBoosted: number | null;
  boostYyyymm: string | null;
  monthsSaved: number | null;
}

const MAX_PROJECTION_MONTHS = 600;

/** লক্ষ্যে পৌঁছানোর অনুমান। শুধু অনুমান — avg জমা ধ্রুবক ধরে। avg null/≤0 হলে pace null (fabricate না)। */
export function goalProjection(currentMinor: number, goalMinor: number, avgMonthlySavingsMinor: number | null, latestYyyymm: string, boostMinor: number): GoalProjection {
  const remaining = goalMinor - currentMinor;
  if (remaining <= 0) {
    return { remainingMinor: 0, reached: true, monthsAtPace: null, paceYyyymm: null, monthsBoosted: null, boostYyyymm: null, monthsSaved: null };
  }
  const avg = avgMonthlySavingsMinor !== null && avgMonthlySavingsMinor > 0 ? avgMonthlySavingsMinor : 0;
  const months = (rate: number): number | null => {
    if (rate <= 0) return null;
    const m = Math.ceil(remaining / rate);
    return m > MAX_PROJECTION_MONTHS ? null : m;
  };
  const pace = months(avg);
  const boosted = boostMinor > 0 ? months(avg + boostMinor) : null;
  return {
    remainingMinor: remaining,
    reached: false,
    monthsAtPace: pace,
    paceYyyymm: pace !== null ? shiftMonth(latestYyyymm, pace) : null,
    monthsBoosted: boosted,
    boostYyyymm: boosted !== null ? shiftMonth(latestYyyymm, boosted) : null,
    monthsSaved: pace !== null && boosted !== null ? pace - boosted : null,
  };
}

export interface NetWorthPace {
  /** মাসে সম্পদ গড়ে কতটা বাড়ছে (ঋণাত্মক হতে পারে) */
  perMonthMinor: number;
  baseYyyymm: string;
  spanMonths: number;
}

const monthIndex = (yyyymm: string) => Number(yyyymm.slice(0, 4)) * 12 + Number(yyyymm.slice(5, 7)) - 1;

/** আসল সম্পদ-বৃদ্ধির গতি: শেষ snapshot বনাম ~`months` মাস আগের (না থাকলে সবচেয়ে পুরনোটা)। আয়-ব্যয়ের হিসাব নয়, snapshot-এর মোট সম্পদের বদল। ২টা আলাদা snapshot না থাকলে null। */
export function netWorthPace(snapshots: readonly NetWorthSnapshotLite[], months = 6): NetWorthPace | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
  const cur = sorted[sorted.length - 1];
  const older = sorted.filter((s) => s.yyyymm < cur.yyyymm);
  const base = snapshotAtOrBefore(older, shiftMonth(cur.yyyymm, -months)) ?? older[0];
  if (!base) return null;
  const span = monthIndex(cur.yyyymm) - monthIndex(base.yyyymm);
  if (span <= 0) return null;
  return { perMonthMinor: Math.round((cur.totalAssetsMinor - base.totalAssetsMinor) / span), baseYyyymm: base.yyyymm, spanMonths: span };
}

/** `breakdown` আছে এমন সবচেয়ে সাম্প্রতিক snapshot (সর্বশেষটায় না থাকলে আগেরটা); একটাও না থাকলে null। */
export function latestWithBreakdown<T extends { yyyymm: string; breakdown?: unknown }>(snapshots: readonly T[]): T | null {
  return snapshots.reduce<T | null>((a, b) => (b.breakdown && (a === null || b.yyyymm > a.yyyymm) ? b : a), null);
}

export type AssetKey = 'accounts' | 'investment' | 'receivable' | 'homeDeposit' | 'gpf';

export interface AssetMix {
  items: { key: AssetKey; minor: number; share: number }[];
  totalMinor: number;
  /** বিনিয়োগ + পাওনা — অন্যের হাতে থাকা অংশ (0..1) */
  outsideShare: number;
  cashShare: number;
}

/** snapshot.breakdown থেকে সম্পদের ভাগ (শুধু ধনাত্মক খাত); breakdown না থাকলে বা মোট ≤ 0 হলে null। */
export function assetMix(b: { accountsMinor: number; receivableMinor: number; investmentMinor: number; homeDepositMinor: number; gpfMinor: number } | undefined): AssetMix | null {
  if (!b) return null;
  const raw: [AssetKey, number][] = [
    ['accounts', b.accountsMinor],
    ['investment', b.investmentMinor],
    ['receivable', b.receivableMinor],
    ['homeDeposit', b.homeDepositMinor],
    ['gpf', b.gpfMinor],
  ];
  const pos = raw.filter(([, v]) => v > 0);
  const total = pos.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) return null;
  const items = pos.map(([key, minor]) => ({ key, minor, share: minor / total }));
  const share = (k: AssetKey) => items.find((i) => i.key === k)?.share ?? 0;
  return { items, totalMinor: total, outsideShare: share('investment') + share('receivable'), cashShare: share('accounts') };
}

export interface EmergencyFund {
  targetMinor: number;
  /** 0..100 (সর্বোচ্চ ১০০) */
  pct: number;
  shortfallMinor: number;
}

/** নগদ বনাম `targetMonths` মাসের খরচ। গড় খরচ ≤ 0 হলে null। */
export function emergencyFund(cashMinor: number, avgMonthlyExpenseMinor: number | null, targetMonths = 6): EmergencyFund | null {
  if (avgMonthlyExpenseMinor === null || avgMonthlyExpenseMinor <= 0) return null;
  const target = Math.round(avgMonthlyExpenseMinor * targetMonths);
  const cash = Math.max(cashMinor, 0);
  return { targetMinor: target, pct: Math.min(100, (cash / target) * 100), shortfallMinor: Math.max(0, target - cash) };
}

// ───────── Overview → Monthly ধাপ ২ (খরচ-সচেতনতা) ─────────
// সব হিসাব বিদ্যমান লেনদেন থেকে, নিয়ম-ভিত্তিক (AI নয়)। নতুন schema/write নেই। টাকা minor (পয়সা) integer-এ।

/** "ছোট ফাঁক": ক্যাটাগরিতে কমপক্ষে এত বার, গড় অঙ্ক এর নিচে (৳150, minor)। */
export const LEAK_MIN_COUNT = 8;
export const LEAK_MAX_AVG_MINOR = 15_000;

const parseYmd = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmtYmd = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
const DAY_MS = 86_400_000;

/** `date`-এর n দিন আগে/পরে "YYYY-MM-DD" (UTC গণিত — timezone-নিরপেক্ষ)। */
export function addDays(date: string, n: number): string {
  return fmtYmd(parseYmd(date) + n * DAY_MS);
}

/** বার-সূচক, শনি=0 … শুক্র=6 (বাংলাদেশের সপ্তাহ শনিবার থেকে)। */
export function weekdayIndex(date: string): number {
  return (new Date(parseYmd(date)).getUTCDay() + 1) % 7;
}

const expenseOnly = (txs: readonly TxLite[]) => txs.filter((t) => t.type === 'expense');

/** তারিখ → সেই দিনের মোট খরচ (শুধু expense)। */
export function dailyExpense(txs: readonly TxLite[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of expenseOnly(txs)) m.set(t.date, (m.get(t.date) ?? 0) + t.amountMinor);
  return m;
}

// ── আমার ১০০ টাকা কোথায় যায় ──
export interface HundredSegment {
  key: string; // category নাম, 'others' বা 'savings'
  name: string;
  value: number; // আয়ের প্রতি ১০০-তে কত
  kind: 'category' | 'others' | 'savings';
}
export interface SpendPer100 {
  segments: HundredSegment[];
  savingsPer100: number | null; // খরচ ≤ আয় হলে
  overspendMinor: number; // খরচ > আয় হলে ঘাটতি, নাহলে 0
  /** কিসের প্রতি ১০০-তে ভাগ: আয় (স্বাভাবিক) বা খরচ (খরচ > আয় হলে — নইলে যোগফল ১০০ ছাড়িয়ে যেত) */
  basis: 'income' | 'expense';
}

/** আয়ের প্রতি ১০০ টাকায় শীর্ষ topN খাত + অন্যান্য + সঞ্চয়। খরচ ≤ আয় হলে ভিত্তি আয়, যোগফল ঠিক ১০০ (largest-remainder);
 *  খরচ > আয় হলে ভিত্তি খরচ ("প্রতি ১০০ খরচে"), তখনও যোগফল ১০০। আয় ০ হলে null। */
export function spendPer100(txs: readonly TxLite[], topN = 5): SpendPer100 | null {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amountMinor;
    else expense += t.amountMinor;
  }
  if (income <= 0) return null;
  const cats = categoryList(txs, 'expense');
  const top = cats.slice(0, topN);
  const restMinor = cats.slice(topN).reduce((a, c) => a + c.totalMinor, 0);
  const raw: { key: string; name: string; minor: number; kind: HundredSegment['kind'] }[] = top.map((c) => ({ key: c.name, name: c.name, minor: c.totalMinor, kind: 'category' }));
  if (restMinor > 0) raw.push({ key: 'others', name: 'অন্যান্য', minor: restMinor, kind: 'others' });
  const over = expense > income;
  const overspendMinor = Math.max(0, expense - income);
  if (!over) raw.push({ key: 'savings', name: 'সঞ্চয়', minor: income - expense, kind: 'savings' });
  const denom = over ? expense : income;

  // largest remainder: যোগফল ঠিক ১০০
  const exact = raw.map((r) => (r.minor / denom) * 100);
  const values = exact.map((v) => Math.floor(v));
  let left = 100 - values.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0 && order.length > 0; k = (k + 1) % order.length, left--) values[order[k].i] += 1;
  const segments = raw.map((r, i) => ({ key: r.key, name: r.name, value: values[i], kind: r.kind })).filter((s) => s.value > 0);
  const sav = segments.find((s) => s.kind === 'savings');
  return { segments, savingsPer100: !over ? (sav ? sav.value : 0) : null, overspendMinor, basis: over ? 'expense' : 'income' };
}

// ── কী ঠিক করলে টার্গেট ছোঁয়া যেত ──
export interface TargetGap {
  /** টার্গেট সঞ্চয়-হার ছুঁতে খরচ কতটা কম হওয়া দরকার ছিল */
  needMinor: number;
  /** একটামাত্র খাত কমালে কতটা (%) কমাতে হতো — খাত বড় → ছোট, শুধু যেগুলোর মোট ≥ needMinor (সর্বোচ্চ ৩টি); না থাকলে খালি */
  options: { name: string; totalMinor: number; cutPct: number }[];
}

/** মাসের সঞ্চয়-হার টার্গেটের নিচে হলে ঘাটতি ও কোন খাত কতটা কমালে ছুঁত। আয় ≤ ০ বা টার্গেট ছোঁয়া থাকলে null। */
export function targetGap(txs: readonly TxLite[], targetPct: number): TargetGap | null {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amountMinor;
    else expense += t.amountMinor;
  }
  if (income <= 0) return null;
  const need = Math.round(expense - income * (1 - targetPct / 100));
  if (need <= 0) return null;
  const options = categoryList(txs, 'expense')
    .filter((c) => c.totalMinor >= need)
    .slice(0, 3)
    .map((c) => ({ name: c.name, totalMinor: c.totalMinor, cutPct: (need / c.totalMinor) * 100 }));
  return { needMinor: need, options };
}

// ── বড় একবারের খরচ ──
export interface BigOneOffs {
  items: TxLite[];
  sumMinor: number;
  expenseMinor: number;
  expenseWithoutMinor: number;
  savingsPct: number | null;
  savingsPctWithout: number | null;
}

/** মাসের মোট খরচের `sharePct` (ডিফল্ট ২০%) বা বেশি একক লেনদেন (সর্বোচ্চ topN, বড় → ছোট)। খরচ-লেনদেন ৪টির কম হলে null (তখন "একবারের" বলা অর্থহীন)। */
export function bigOneOffs(txs: readonly TxLite[], sharePct = 20, topN = 3): BigOneOffs | null {
  const exp = expenseOnly(txs);
  if (exp.length < 4) return null;
  const expense = exp.reduce((a, t) => a + t.amountMinor, 0);
  if (expense <= 0) return null;
  const items = exp
    .filter((t) => t.amountMinor * 100 >= expense * sharePct)
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, topN);
  if (items.length === 0) return null;
  const income = txs.reduce((a, t) => (t.type === 'income' ? a + t.amountMinor : a), 0);
  const sum = items.reduce((a, t) => a + t.amountMinor, 0);
  return {
    items,
    sumMinor: sum,
    expenseMinor: expense,
    expenseWithoutMinor: expense - sum,
    savingsPct: savingsRatePct(income, expense),
    savingsPctWithout: savingsRatePct(income, expense - sum),
  };
}

// ── ছোট ফাঁক (Leak finder) ──
export interface LeakItem {
  name: string;
  count: number;
  totalMinor: number;
  avgMinor: number;
}

/** বেশি বার কিন্তু ছোট অঙ্কের খরচ-খাত (`excludeCategories` = প্রয়োজনীয় খাত, বাদ): count ≥ LEAK_MIN_COUNT ও গড় ≤ LEAK_MAX_AVG_MINOR; মোটের বড় → ছোট, শীর্ষ topN। */
export function leakFinder(txs: readonly TxLite[], topN = 3, excludeCategories: readonly string[] = []): LeakItem[] {
  const skip = new Set(excludeCategories.map((n) => n.trim().toLowerCase()));
  const map = new Map<string, { count: number; total: number }>();
  for (const t of expenseOnly(txs)) {
    if (skip.has(t.categoryName.trim().toLowerCase())) continue; // প্রয়োজনীয় খাত — কমানোর বিষয় নয়
    const e = map.get(t.categoryName) ?? { count: 0, total: 0 };
    e.count += 1;
    e.total += t.amountMinor;
    map.set(t.categoryName, e);
  }
  return [...map.entries()]
    .map(([name, e]) => ({ name, count: e.count, totalMinor: e.total, avgMinor: Math.round(e.total / e.count) }))
    .filter((x) => x.count >= LEAK_MIN_COUNT && x.avgMinor <= LEAK_MAX_AVG_MINOR)
    .sort((a, b) => b.totalMinor - a.totalMinor)
    .slice(0, topN);
}

// ── বার-ভিত্তিক খরচ ──
export interface WeekdayAvg {
  /** শনি=0 … শুক্র=6 */
  avgMinor: number[];
  daysCovered: number;
  /** সবচেয়ে বেশি গড়ের বার ও অন্য ৬ বারের গড়ের তুলনায় গুণ (≥ minRatio হলে, নাহলে null) */
  peak: { index: number; avgMinor: number; ratio: number } | null;
}

/** [end−windowDays+1 … end] জানালায় প্রতি বারের গড় দৈনিক খরচ (খরচ-শূন্য দিনও গোনা)। জানালার শুরু প্রথম লেনদেনের আগে হলে প্রথম লেনদেনের দিন থেকে (অ্যাপ-ব্যবহারের আগের ফাঁকা দিন গড় নামায় না)। */
export function weekdaySpend(txs: readonly TxLite[], end: string, windowDays = 90, minRatio = 1.5): WeekdayAvg | null {
  const start = addDays(end, -(windowDays - 1));
  const inWin = expenseOnly(txs).filter((t) => t.date >= start && t.date <= end);
  if (inWin.length === 0) return null;
  const first = inWin.reduce((a, t) => (t.date < a ? t.date : a), inWin[0].date);
  const effStart = first > start ? first : start;
  const sums = Array<number>(7).fill(0);
  const days = Array<number>(7).fill(0);
  let covered = 0;
  for (let d = effStart; d <= end; d = addDays(d, 1)) {
    days[weekdayIndex(d)] += 1;
    covered += 1;
  }
  for (const t of inWin) if (t.date >= effStart) sums[weekdayIndex(t.date)] += t.amountMinor;
  const avgMinor = sums.map((s, i) => (days[i] > 0 ? Math.round(s / days[i]) : 0));
  let pi = 0;
  avgMinor.forEach((v, i) => { if (v > avgMinor[pi]) pi = i; });
  const others = avgMinor.filter((_, i) => i !== pi && days[i] > 0);
  const othersAvg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : 0;
  const ratio = othersAvg > 0 ? avgMinor[pi] / othersAvg : 0;
  return { avgMinor, daysCovered: covered, peak: ratio >= minRatio ? { index: pi, avgMinor: avgMinor[pi], ratio } : null };
}

// ── নো-স্পেন্ড ক্যালেন্ডার ──
export type DayLevel = 'none' | 'low' | 'mid' | 'high' | 'future' | 'today';
export interface CalendarDay {
  date: string;
  day: number;
  weekday: number; // শনি=0
  spendMinor: number;
  level: DayLevel;
}
export interface NoSpendCalendar {
  days: CalendarDay[];
  noSpendCount: number;
  bestStreak: number;
  /** আজ পর্যন্ত চলতি টানা নো-স্পেন্ড (চলতি মাসের বাইরে 0) */
  currentStreak: number;
}

/** মাসের প্রতিটা দিনের খরচ-স্তর: ০ = নো-স্পেন্ড; বাকিগুলো খরচ-হওয়া দিনের গড়ের সাথে তুলনায় low(<0.7×) / mid / high(≥1.3×)। `today`-এর পরের দিন 'future'; আজ খরচ-শূন্য হলে 'today' (চলছে — গণনায় নেই, টানা ভাঙে না)। */
export function noSpendCalendar(txs: readonly TxLite[], yyyymm: string, today: string): NoSpendCalendar {
  const daily = dailyExpense(txs);
  const [y, m] = yyyymm.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const spendDays = [...daily.entries()].filter(([d, v]) => d.startsWith(yyyymm) && v > 0).map(([, v]) => v);
  const avg = spendDays.length ? spendDays.reduce((a, b) => a + b, 0) / spendDays.length : 0;
  const days: CalendarDay[] = [];
  let noSpendCount = 0;
  let best = 0;
  let run = 0;
  for (let d = 1; d <= last; d++) {
    const date = `${yyyymm}-${String(d).padStart(2, '0')}`;
    const spendMinor = daily.get(date) ?? 0;
    let level: DayLevel;
    if (date > today) level = 'future';
    else if (date === today && spendMinor === 0) level = 'today'; // আজ এখনো চলছে — নো-স্পেন্ড গোনা কাল থেকে
    else if (spendMinor === 0) level = 'none';
    else if (spendMinor < avg * 0.7) level = 'low';
    else if (spendMinor >= avg * 1.3) level = 'high';
    else level = 'mid';
    if (level === 'none') {
      noSpendCount += 1;
      run += 1;
      if (run > best) best = run;
    } else if (level !== 'today') run = 0;
    days.push({ date, day: d, weekday: weekdayIndex(date), spendMinor, level });
  }
  // চলতি টানা: আজ (বা মাসের শেষ গোনা-দিন) থেকে পেছনে; শুধু চলতি মাসে অর্থবহ
  let currentStreak = 0;
  if (today.startsWith(yyyymm)) {
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].level === 'future' || days[i].level === 'today') continue;
      if (days[i].level === 'none') currentStreak += 1;
      else break;
    }
  }
  return { days, noSpendCount, bestStreak: best, currentStreak };
}

// ── মাসের রিপোর্ট কার্ড (নিয়ম-ভিত্তিক ৩ লাইন) ──
export interface ReportPart {
  text: string;
  tone?: 'good' | 'bad';
}
export type ReportLine = ReportPart[];

export const DEFAULT_SAVINGS_TARGET_PCT = 20;

const pctText = (v: number) => (Math.round(v * 10) / 10).toString();

/**
 * ৩ লাইন: (১) খরচ গত মাসের তুলনায় + সঞ্চয়-হার টার্গেটের তুলনায়; (২) সবচেয়ে বেশি বাড়া খাত (গত মাসে > ০ থাকলে);
 * (৩) সবচেয়ে বড় ছোট-ফাঁক। যে লাইনের ডেটা নেই সেটা বাদ। টাকার অঙ্ক-ফরম্যাট UI-তে নয়, এখানে `fmtTaka` দিয়ে।
 */
export function monthReport(
  txs: readonly TxLite[],
  prevTxs: readonly TxLite[] | null,
  targetPct: number | null,
  fmtTaka: (minor: number) => string,
  essentialCategories: readonly string[] = [],
): ReportLine[] {
  const lines: ReportLine[] = [];
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amountMinor;
    else expense += t.amountMinor;
  }
  const target = targetPct ?? DEFAULT_SAVINGS_TARGET_PCT;
  const pct = savingsRatePct(income, expense);
  let prevExpense = 0;
  if (prevTxs) for (const t of prevTxs) if (t.type === 'expense') prevExpense += t.amountMinor;

  const l1: ReportLine = [];
  let expenseDown: boolean | null = null;
  if (prevTxs && prevExpense > 0) {
    const diff = Math.round(((expense - prevExpense) / prevExpense) * 100);
    if (diff === 0) l1.push({ text: 'খরচ গত মাসের প্রায় সমান' });
    else {
      expenseDown = diff < 0;
      l1.push({ text: `খরচ গত মাসের চেয়ে ` }, { text: `${Math.abs(diff)}% ${diff < 0 ? 'কম' : 'বেশি'}`, tone: diff < 0 ? 'good' : 'bad' });
    }
  }
  if (pct != null) {
    const gap = target - pct;
    const lead = l1.length > 0 ? (expenseDown === true && gap > 0 ? ', কিন্তু ' : expenseDown === false && gap <= 0 ? ', তবে ' : ', ') : '';
    if (gap > 0.05) l1.push({ text: `${lead}সঞ্চয় টার্গেটের (${target}%) ` }, { text: `${pctText(gap)} পয়েন্ট নিচে`, tone: 'bad' });
    else l1.push({ text: `${lead}সঞ্চয় টার্গেট (${target}%) ` }, { text: 'ছুঁয়েছে', tone: 'good' });
  }
  if (l1.length > 0) lines.push(l1);

  if (prevTxs && prevExpense > 0) {
    const prevMap = new Map<string, number>();
    for (const t of expenseOnly(prevTxs)) prevMap.set(t.categoryName, (prevMap.get(t.categoryName) ?? 0) + t.amountMinor);
    const curMap = new Map<string, number>();
    for (const t of expenseOnly(txs)) curMap.set(t.categoryName, (curMap.get(t.categoryName) ?? 0) + t.amountMinor);
    let best: { name: string; inc: number; pct: number } | null = null;
    for (const [name, cur] of curMap) {
      const prev = prevMap.get(name) ?? 0;
      if (prev <= 0 || cur <= prev) continue;
      const inc = cur - prev;
      if (!best || inc > best.inc) best = { name, inc, pct: Math.round((inc / prev) * 100) };
    }
    if (best) lines.push([{ text: 'সবচেয়ে বেড়েছে: ' }, { text: best.name, tone: undefined }, { text: ` (+${best.pct}%)`, tone: 'bad' }]);
  }

  const leak = leakFinder(txs, 1, essentialCategories)[0];
  if (leak) lines.push([{ text: `সবচেয়ে বড় ছোট-ফাঁক: ${leak.name}, মাসে ${fmtTaka(leak.totalMinor)}` }]);
  return lines;
}

// ───────── Overview → Yearly ধাপ ৩ ─────────
// মাসিক সঞ্চয়-হার, লাইফস্টাইল ক্রিপ, আসল বৃদ্ধি, বিনিয়োগের সৎ রিপোর্ট। বিদ্যমান ডেটা থেকে derive, নতুন query/write নেই।

export interface SavingsPoint {
  yyyymm: string;
  month: number; // ১..১২
  pct: number | null; // আয় ০ (ডেটা নেই) হলে null
}

export interface SavingsRateStats {
  points: SavingsPoint[];
  /** আজ/শেষ ডেটা-মাস থেকে পেছনে টানা কত মাস সঞ্চয়-হার ≥ টার্গেট */
  streakAbove: number;
  monthsAbove: number;
  /** সর্বোচ্চ হার (পূর্ণসংখ্যায় গোল) ও সেই মাস/মাসগুলো (সর্বোচ্চ ২টা) */
  best: { pct: number; months: number[] } | null;
  /** টার্গেটে পৌঁছাতে মাসে আরও যত জমাতে হবে (গড় আয় ধরে); ≤ ০ হলে null */
  extraNeededMinor: number | null;
  avgIncomeMinor: number | null;
}

/** বছরের মাসভিত্তিক সঞ্চয়-হার ও টার্গেট-পরিসংখ্যান। ডেটা-শূন্য মাস (আয় ≤ ০) বাদ। */
export function savingsRateStats(rows: readonly MonthRow[], targetPct: number): SavingsRateStats {
  const points: SavingsPoint[] = rows.map((r, i) => ({ yyyymm: r.yyyymm, month: i + 1, pct: savingsRatePct(r.incomeMinor, r.expenseMinor) }));
  const withData = points.filter((p): p is SavingsPoint & { pct: number } => p.pct != null);
  let streakAbove = 0;
  for (let i = withData.length - 1; i >= 0; i--) {
    if (withData[i].pct >= targetPct) streakAbove += 1;
    else break;
  }
  const monthsAbove = withData.filter((p) => p.pct >= targetPct).length;
  let best: SavingsRateStats['best'] = null;
  if (withData.length > 0) {
    const maxRounded = Math.round(Math.max(...withData.map((p) => p.pct)));
    best = { pct: maxRounded, months: withData.filter((p) => Math.round(p.pct) === maxRounded).slice(0, 2).map((p) => p.month) };
  }
  const dataRows = rows.filter((r) => r.incomeMinor > 0);
  let extraNeededMinor: number | null = null;
  let avgIncomeMinor: number | null = null;
  if (dataRows.length > 0) {
    avgIncomeMinor = Math.round(dataRows.reduce((a, r) => a + r.incomeMinor, 0) / dataRows.length);
    const avgSavings = dataRows.reduce((a, r) => a + r.savingsMinor, 0) / dataRows.length;
    const need = Math.round((targetPct / 100) * avgIncomeMinor - avgSavings);
    extraNeededMinor = need > 0 ? need : null;
  }
  return { points, streakAbove, monthsAbove, best, extraNeededMinor, avgIncomeMinor };
}

// ── লাইফস্টাইল ক্রিপ ──
export type CreepVerdict = 'income_fell_expense_stuck' | 'expense_outpaced' | 'expense_slower' | 'both_down_good' | 'flat';
export interface LifestyleCreep {
  incomeAvgPrev: number;
  incomeAvgCur: number;
  expenseAvgPrev: number;
  expenseAvgCur: number;
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  verdict: CreepVerdict;
}

const changePct = (prev: number, cur: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

/** বছরের গড় মাসিক আয়/ব্যয় — আগের বছরের সাথে। `monthsCur` = চলতি বছরে গোনা মাস (অন্যথায় ১২)। আগের বছরে আয়-ব্যয় দুটোই ০ হলে null। */
export function lifestyleCreep(prev: { incomeMinor: number; expenseMinor: number }, cur: { incomeMinor: number; expenseMinor: number }, monthsCur: number, monthsPrev = 12): LifestyleCreep | null {
  if (prev.incomeMinor <= 0 && prev.expenseMinor <= 0) return null;
  if (monthsCur <= 0 || monthsPrev <= 0) return null;
  const incomeAvgPrev = Math.round(prev.incomeMinor / monthsPrev);
  const expenseAvgPrev = Math.round(prev.expenseMinor / monthsPrev);
  const incomeAvgCur = Math.round(cur.incomeMinor / monthsCur);
  const expenseAvgCur = Math.round(cur.expenseMinor / monthsCur);
  const incomeChangePct = changePct(incomeAvgPrev, incomeAvgCur);
  const expenseChangePct = changePct(expenseAvgPrev, expenseAvgCur);
  let verdict: CreepVerdict = 'flat';
  if (incomeChangePct != null && expenseChangePct != null) {
    if (incomeChangePct < -1 && expenseChangePct > incomeChangePct) verdict = 'income_fell_expense_stuck';
    else if (incomeChangePct < -1 && expenseChangePct <= incomeChangePct) verdict = 'both_down_good';
    else if (expenseChangePct > incomeChangePct + 1) verdict = 'expense_outpaced';
    else if (incomeChangePct > 1 && expenseChangePct < incomeChangePct - 1) verdict = 'expense_slower';
  }
  return { incomeAvgPrev, incomeAvgCur, expenseAvgPrev, expenseAvgCur, incomeChangePct, expenseChangePct, verdict };
}

/** বছরের প্রথম `n` মাসের মোট আয়/ব্যয় (একই সময়ের তুলনার জন্য)। n মাসের কোনোটায় ডেটা (লাইভ বা Excel-record) না থাকলে null — অসম্পূর্ণ তুলনা fabricate না। */
export function windowTotals(rows: readonly MonthRow[], n: number): { incomeMinor: number; expenseMinor: number } | null {
  if (n <= 0 || n > rows.length) return null;
  const win = rows.slice(0, n);
  if (win.some((r) => r.txCount === 0 && !r.fromRecord)) return null;
  return { incomeMinor: win.reduce((a, r) => a + r.incomeMinor, 0), expenseMinor: win.reduce((a, r) => a + r.expenseMinor, 0) };
}

// ── আসল বৃদ্ধি (মূল্যস্ফীতি বাদে) ──
export interface RealGrowth {
  baseYyyymm: string;
  latestYyyymm: string;
  baseMinor: number;
  latestMinor: number;
  nominalPct: number;
  inflationPct: number;
  /** তুলনার আসল সময়কাল (মাস) — মূল্যস্ফীতি বার্ষিক, তাই ১২ না হলে UI সতর্ক করে */
  spanMonths: number;
  realPct: number;
  /** আজকের মোট সম্পদ = এক বছর আগের প্রায় কত টাকার সমান ক্রয়ক্ষমতা */
  purchasingPowerMinor: number;
}

/** শেষ snapshot বনাম ১২ মাস আগের (বা তার আগের সর্বশেষ) snapshot। দুটো আলাদা না থাকলে/ভিত্তি ≤ ০ হলে null। আসল = নামমাত্র % − মূল্যস্ফীতি % (সরল বিয়োগ, UI-তেও তাই দেখায়)। */
export function realGrowth(snapshots: readonly NetWorthSnapshotLite[], inflationPct: number): RealGrowth | null {
  if (snapshots.length === 0) return null;
  const latest = snapshots.reduce((a, b) => (b.yyyymm > a.yyyymm ? b : a));
  const base = snapshotAtOrBefore(snapshots, shiftMonth(latest.yyyymm, -12));
  if (!base || base.yyyymm === latest.yyyymm || base.totalAssetsMinor <= 0) return null;
  const nominalPct = ((latest.totalAssetsMinor - base.totalAssetsMinor) / base.totalAssetsMinor) * 100;
  return {
    baseYyyymm: base.yyyymm,
    latestYyyymm: latest.yyyymm,
    baseMinor: base.totalAssetsMinor,
    latestMinor: latest.totalAssetsMinor,
    nominalPct,
    inflationPct,
    spanMonths: monthIndex(latest.yyyymm) - monthIndex(base.yyyymm),
    realPct: nominalPct - inflationPct,
    purchasingPowerMinor: Math.round(latest.totalAssetsMinor / (1 + inflationPct / 100)),
  };
}

// ── বিনিয়োগের সৎ রিপোর্ট ──
export interface InvestmentLite {
  principalMinor: number;
  /** বিনিয়োগের তারিখ — বার্ষিক হারের জন্য ঐচ্ছিক */
  date?: string;
  repayments: readonly { amountMinor: number; date?: string }[];
  investmentOutcome: 'running' | 'doubtful' | 'written_off';
}
export interface InvestmentHonest {
  totalMinor: number;
  /** আসল-এর ভাগ: ফেরত + এখনো বাকি (running/doubtful/written_off); যোগফল = totalMinor */
  runningMinor: number;
  returnedMinor: number;
  doubtfulMinor: number;
  writtenOffMinor: number;
  /** আসলের বেশি ফেরত (মুনাফা) */
  profitMinor: number;
  /** written_off-এর অশোধিত আসল */
  lossMinor: number;
  netMinor: number;
  netPctOfTotal: number | null;
  atRiskPct: number | null; // doubtful-এর ভাগ %
  /** আনুমানিক বার্ষিক হার % = নিট ফল ÷ (আসল × বছর), আসল যতদিন আটকে ছিল ততদিন ধরে; তারিখ/`today` না থাকলে বা গড় আটকে-থাকা সময় ৩ মাসের কম হলে null (অতি-অল্প সময়ে বার্ষিকীকরণ বিভ্রান্তিকর) */
  annualRatePct: number | null;
}

/** সব investment-এর আসল-ভাগ ও লাভ/ক্ষতি। কোনো investment না থাকলে null। */
export function investmentHonest(list: readonly InvestmentLite[], today?: string): InvestmentHonest | null {
  if (list.length === 0) return null;
  let capitalYears = 0;
  let total = 0, running = 0, returned = 0, doubtful = 0, written = 0, profit = 0;
  for (const inv of list) {
    const paid = inv.repayments.reduce((a, r) => a + r.amountMinor, 0);
    const back = Math.min(paid, inv.principalMinor);
    const left = inv.principalMinor - back;
    total += inv.principalMinor;
    returned += back;
    profit += Math.max(0, paid - inv.principalMinor);
    if (today && inv.date) {
      // পুরো ফেরত হলে শেষ ফেরতের দিন পর্যন্ত, নইলে আজ পর্যন্ত আসল আটকে ছিল
      const lastRepay = inv.repayments.reduce<string | null>((a, r) => (r.date && (a === null || r.date > a) ? r.date : a), null);
      const end = paid >= inv.principalMinor && lastRepay ? lastRepay : today;
      const days = Math.max(0, (parseYmd(end) - parseYmd(inv.date)) / DAY_MS);
      capitalYears += inv.principalMinor * (days / 365);
    }
    if (inv.investmentOutcome === 'doubtful') doubtful += left;
    else if (inv.investmentOutcome === 'written_off') written += left;
    else running += left;
  }
  const net = profit - written;
  return {
    totalMinor: total,
    runningMinor: running,
    returnedMinor: returned,
    doubtfulMinor: doubtful,
    writtenOffMinor: written,
    profitMinor: profit,
    lossMinor: written,
    netMinor: net,
    netPctOfTotal: total > 0 ? (net / total) * 100 : null,
    atRiskPct: total > 0 ? (doubtful / total) * 100 : null,
    annualRatePct: today && total > 0 && capitalYears / total >= 0.25 ? (net / capitalYears) * 100 : null,
  };
}

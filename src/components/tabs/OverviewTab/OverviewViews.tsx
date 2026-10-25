import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react';
import SkeletonLoader from '../../common/SkeletonLoader';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';
import CategoryHistorySheet from './CategoryHistorySheet';
import { YearlyBreakdown, YearsCard } from './BreakdownLists';
import { CategoryBars, CategoryDonut, IncomeExpenseBars, IncomeExpenseLegend, SavingsRateBars, TrendLine } from './Charts';
import { useMonthTransactions, useNetWorthSnapshots, useRangeTransactions } from '../../../hooks/useData';
import { currentMonth, monthEndDate, monthLabel, shiftMonth, toDhakaDate } from '../../../lib/date';
import { formatAmount, formatNet, formatNetTaka, formatTaka } from '../../../lib/format';
import {
  allTimeRows,
  avgMonthlyExpense,
  avgMonthlySavings,
  bestWorstMonth,
  categoryBreakdown,
  flowByMonth,
  monthRows,
  netWorthGrowthAllTime,
  netWorthYtd,
  resolveYear,
  runwayMonths,
  savingsInsight,
  savingsRatePct,
  snapshotAtOrBefore,
  trendSeries,
  yearlySavingsRates,
  type HistoricalLite,
  type NetWorthSnapshotLite,
  type TxLite,
  type YearRow,
} from '../../../lib/overviewCalc';

// Overview — Monthly / Yearly / All-Time (UI Mockup §৭, Architecture §২ historicalYearlyTotals precedence C17)।

export function PeriodNav({ label, onPrev, onNext, prevDisabled, nextDisabled, right }: { label: string; onPrev: () => void; onNext: () => void; prevDisabled?: boolean; nextDisabled?: boolean; right?: ReactNode }) {
  const btn = 'flex h-11 w-11 items-center justify-center disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <div className="flex flex-1 items-center justify-center gap-2">
        <button type="button" aria-label="Previous" onClick={onPrev} disabled={prevDisabled} className={btn}>
          <ChevronLeft aria-hidden size={20} />
        </button>
        <span className="min-w-28 text-center font-medium text-fg">{label}</span>
        <button type="button" aria-label="Next" onClick={onNext} disabled={nextDisabled} className={btn}>
          <ChevronRight aria-hidden size={20} />
        </button>
      </div>
      {right && <div className="shrink-0 pr-2">{right}</div>}
    </div>
  );
}

function Totals({
  income,
  expense,
  savings,
  savingsPct,
  savingsPctDeltaPt,
  deltaLabel = 'last month',
}: {
  income: number;
  expense: number;
  savings: number;
  /** Overview Enrichment ধাপ ১/২ — ঐচ্ছিক, না দিলে সাবটাইটেল-রো দেখাবে না (All-Time অপরিবর্তিত)। */
  savingsPct?: number | null;
  savingsPctDeltaPt?: number | null;
  /** "vs {deltaLabel}" — Monthly-তে "last month" (ডিফল্ট), Yearly-তে "last year"। */
  deltaLabel?: string;
}) {
  return (
    <Card as="section" ariaLabel="Totals" className="mx-4">
      <div className="grid grid-cols-3 gap-2 p-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <IconBadge icon={TrendingUp} tone="income" size={32} />
          <p className="text-xs text-muted">Income</p>
          <p className="text-base font-semibold text-income">{formatTaka(income)}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <IconBadge icon={TrendingDown} tone="expense" size={32} />
          <p className="text-xs text-muted">Expense</p>
          <p className="text-base font-semibold text-expense">{formatTaka(expense)}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <IconBadge icon={PiggyBank} tone={savings < 0 ? 'expense' : 'income'} size={32} />
          <p className="text-xs text-muted">Savings</p>
          <p className={`text-base font-semibold ${savings < 0 ? 'text-expense' : 'text-income'}`}>{formatNetTaka(savings)}</p>
        </div>
      </div>
      {savingsPct != null && (
        <p className="border-t border-muted/10 px-4 pb-3 pt-2 text-center text-xs text-muted">
          Savings rate {savingsPct.toFixed(1)}%
          {savingsPctDeltaPt != null && (
            <span className={savingsPctDeltaPt >= 0 ? 'text-income' : 'text-expense'}>
              {' '}· vs {deltaLabel} {savingsPctDeltaPt >= 0 ? '↑' : '↓'}{Math.abs(savingsPctDeltaPt).toFixed(1)}pt
            </span>
          )}
        </p>
      )}
    </Card>
  );
}

const Section = ({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) => (
  <Card as="section" className="mx-4 mt-3 p-4">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-sm font-medium text-fg">{title}</h2>
      {right}
    </div>
    {children}
  </Card>
);

const Note = ({ children }: { children: ReactNode }) => <p className="mx-4 mt-2 text-xs text-muted">ℹ️ {children}</p>;

/** Monthly: কয়েকটা কাজের সংখ্যা (Expense by category-র নিচে)। নতুন query নেই — বিদ্যমান ৩-মাসের ডেটা ও snapshot থেকে। */
function KeyNumbers({
  avgExpense,
  avgSavings,
  runway,
  ytd,
  thisExpense,
}: {
  avgExpense: number | null;
  avgSavings: number | null;
  runway: number | null;
  ytd: ReturnType<typeof netWorthYtd>;
  thisExpense: number;
}) {
  if (avgExpense == null && avgSavings == null && runway == null && !ytd) return null;
  const vsAvg = avgExpense && avgExpense > 0 ? ((thisExpense - avgExpense) / avgExpense) * 100 : null;
  const tile = 'rounded-xl bg-surface p-3';
  return (
    <Card as="section" ariaLabel="Key numbers" className="mx-4 mt-3 p-4">
      <h2 className="mb-2 text-sm font-medium text-fg">Key numbers</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className={tile}>
          <p className="text-xs text-muted">Avg expense / month</p>
          <p className="text-base font-semibold text-expense">{avgExpense != null ? formatTaka(Math.round(avgExpense)) : '—'}</p>
          <p className="text-[10px] text-muted">last 3 months</p>
        </div>
        <div className={tile}>
          <p className="text-xs text-muted">Avg savings / month</p>
          <p className={`text-base font-semibold ${avgSavings != null && avgSavings < 0 ? 'text-expense' : 'text-income'}`}>
            {avgSavings != null ? formatNetTaka(Math.round(avgSavings)) : '—'}
          </p>
          <p className="text-[10px] text-muted">last 3 months</p>
        </div>
        <div className={tile}>
          <p className="text-xs text-muted">Runway</p>
          <p className="text-base font-semibold text-fg">{runway != null ? `${runway.toFixed(1)} months` : '—'}</p>
          <p className="text-[10px] text-muted">Total Assets ÷ avg expense</p>
        </div>
        <div className={tile}>
          <p className="text-xs text-muted">Net Worth this year</p>
          <p className={`text-base font-semibold ${ytd && ytd.deltaMinor < 0 ? 'text-expense' : 'text-income'}`}>{ytd ? formatNetTaka(ytd.deltaMinor) : '—'}</p>
          <p className="text-[10px] text-muted">
            {ytd ? `${ytd.deltaPct != null ? `${ytd.deltaPct >= 0 ? '↑' : '↓'}${Math.abs(ytd.deltaPct).toFixed(1)}% · ` : ''}since ${ytd.baseYyyymm}` : 'needs 2 snapshots'}
          </p>
        </div>
      </div>
      {vsAvg != null && Math.abs(vsAvg) >= 1 && (
        <p className="mt-2 text-xs text-muted">
          This month’s expense is <span className={vsAvg > 0 ? 'text-expense' : 'text-income'}>{Math.round(Math.abs(vsAvg))}% {vsAvg > 0 ? 'above' : 'below'}</span> your 3-month average.
        </p>
      )}
    </Card>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <Card role="alert" className="m-4 p-4 text-center">
      <p className="text-sm text-fg">Couldn’t load data.</p>
      <button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">Retry</button>
    </Card>
  );
}

export function MonthlyView({ uid, historical }: { uid: string; historical: readonly HistoricalLite[] }) {
  const now = useMemo(() => currentMonth(), []);
  const [month, setMonth] = useState(now);
  const tx = useMonthTransactions(uid, month);
  const prevMonth = useMemo(() => shiftMonth(month, -1), [month]);
  const prevTx = useMonthTransactions(uid, prevMonth);
  // Runway গড়-ব্যয়: current বাদে আগের ৩ মাস (Overview Enrichment ধাপ ১, §৩)
  const runwayMonthsList = useMemo(() => [prevMonth, shiftMonth(month, -2), shiftMonth(month, -3)], [month, prevMonth]);
  const runwayTx = useRangeTransactions(uid, `${runwayMonthsList[2]}-01`, monthEndDate(prevMonth));
  const snaps = useNetWorthSnapshots(uid);
  const year = Number(month.slice(0, 4));
  const partial = historical.some((h) => h.year === year); // DF7: doc-বছরের মাস app-এর আগের ডেটা ধরে না

  return (
    <>
      <PeriodNav
        label={monthLabel(month)}
        onPrev={() => setMonth(shiftMonth(month, -1))}
        onNext={() => setMonth(shiftMonth(month, 1))}
        nextDisabled={month >= now}
      />
      {tx.state.status === 'loading' && <SkeletonLoader />}
      {tx.state.status === 'error' && <ErrorBox onRetry={tx.retry} />}
      {tx.state.status === 'ready' && (
        tx.state.data.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">No data for this month.</p>
        ) : (
          <MonthlyBody
            month={month}
            txs={tx.state.data}
            partial={partial}
            prevTxs={prevTx.state.status === 'ready' ? prevTx.state.data : null}
            runwayTxs={runwayTx.state.status === 'ready' ? runwayTx.state.data : null}
            runwayMonthsList={runwayMonthsList}
            snapshots={snaps.state.status === 'ready' ? (snaps.state.data as NetWorthSnapshotLite[]) : null}
          />
        )
      )}
    </>
  );
}

function MonthlyBody({
  month,
  txs,
  partial,
  prevTxs,
  runwayTxs,
  runwayMonthsList,
  snapshots,
}: {
  month: string;
  txs: readonly TxLite[];
  partial: boolean;
  prevTxs: readonly TxLite[] | null;
  runwayTxs: readonly TxLite[] | null;
  runwayMonthsList: readonly string[];
  snapshots: readonly NetWorthSnapshotLite[] | null;
}) {
  const t = useMemo(() => sumTotals(txs), [txs]);
  const cats = useMemo(() => categoryBreakdown(txs), [txs]);
  const [selCat, setSelCat] = useState<string | null>(null);
  const savings = t.income - t.expense;
  const savingsPct = savingsRatePct(t.income, t.expense);

  const prevT = prevTxs ? sumTotals(prevTxs) : null;
  const prevSavings = prevT ? prevT.income - prevT.expense : null;
  const prevSavingsPct = prevT ? savingsRatePct(prevT.income, prevT.expense) : null;
  const savingsPctDeltaPt = savingsPct != null && prevSavingsPct != null ? savingsPct - prevSavingsPct : null;
  const insight = savingsInsight(savings, prevSavings);

  const currentSnap = snapshots ? snapshotAtOrBefore(snapshots, month) : null;
  const avgExpense = runwayTxs ? avgMonthlyExpense(runwayTxs, runwayMonthsList) : null;
  const runway = currentSnap && avgExpense != null ? runwayMonths(currentSnap.totalAssetsMinor, avgExpense) : null;
  const avgSavings = runwayTxs ? avgMonthlySavings(runwayTxs, runwayMonthsList) : null;
  const ytd = snapshots ? netWorthYtd(snapshots, month) : null;

  return (
    <>
      <Totals income={t.income} expense={t.expense} savings={savings} savingsPct={savingsPct} savingsPctDeltaPt={savingsPctDeltaPt} />
      {insight && <Note>{insight}</Note>}
      {partial && <Note>Partial data — this period may include days recorded before the app was used.</Note>}
      <Section title="Expense by category">
        <CategoryDonut items={cats} totalMinor={t.expense} />
        <CategoryBars items={cats} onSelect={setSelCat} />
      </Section>
      {selCat && <CategoryHistorySheet name={selCat} txs={txs} cats={cats} onClose={() => setSelCat(null)} />}
      <KeyNumbers avgExpense={avgExpense} avgSavings={avgSavings} runway={runway} ytd={ytd} thisExpense={t.expense} />
    </>
  );
}

function sumTotals(txs: readonly TxLite[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amountMinor;
    else expense += t.amountMinor;
  }
  return { income, expense };
}

export function YearlyView({ uid, historical }: { uid: string; historical: readonly HistoricalLite[] }) {
  const thisYear = Number(toDhakaDate(new Date()).slice(0, 4));
  const minYear = historical.length ? Math.min(thisYear, ...historical.map((h) => h.year)) : thisYear;
  const [year, setYear] = useState(thisYear);
  const tx = useRangeTransactions(uid, `${year}-01-01`, `${year}-12-31`);
  // Overview Enrichment ধাপ ২: vs আগের বছর তুলনার জন্য আগের বছরের tx (historical doc থাকলে resolveYear-এ ব্যবহৃত হয় না, কিন্তু hook unconditionally কল করা লাগে — MonthlyView-এর prevMonth প্যাটার্নের অনুরূপ)।
  const prevTx = useRangeTransactions(uid, `${year - 1}-01-01`, `${year - 1}-12-31`);
  const isHist = historical.some((h) => h.year === year);
  // pre-app মাসের আয়/ব্যয় (snapshot.flow) — শুধু historical-doc বছরে; snapshots না এলে লাইভ-ই (graceful)
  const snaps = useNetWorthSnapshots(uid);
  const flow = useMemo(
    () => (isHist && snaps.state.status === 'ready' ? flowByMonth(snaps.state.data, year) : new Map<string, { incomeMinor: number; expenseMinor: number }>()),
    [isHist, snaps.state, year],
  );

  return (
    <>
      <PeriodNav
        label={String(year)}
        onPrev={() => setYear(year - 1)}
        onNext={() => setYear(year + 1)}
        prevDisabled={year <= minYear}
        nextDisabled={year >= thisYear}
      />
      {tx.state.status === 'loading' && <SkeletonLoader />}
      {tx.state.status === 'error' && <ErrorBox onRetry={tx.retry} />}
      {tx.state.status === 'ready' && (
        <YearlyBody
          row={resolveYear(year, historical, tx.state.data)}
          prevRow={resolveYear(year - 1, historical, prevTx.state.status === 'ready' ? prevTx.state.data : [])}
          txs={tx.state.data}
          year={year}
          isHist={isHist}
          flow={flow}
          uid={uid}
          historical={historical}
          thisYear={thisYear}
          snapshots={snaps.state.status === 'ready' ? snaps.state.data : null}
        />
      )}
    </>
  );
}

function YearlyBody({
  row,
  prevRow,
  txs,
  year,
  isHist,
  flow,
  uid,
  historical,
  thisYear,
  snapshots,
}: {
  uid: string;
  historical: readonly HistoricalLite[];
  thisYear: number;
  snapshots: readonly { yyyymm: string; flow?: { incomeMinor: number; expenseMinor: number } }[] | null;
  row: YearRow;
  prevRow: YearRow;
  txs: readonly TxLite[];
  year: number;
  isHist: boolean;
  flow: ReadonlyMap<string, { incomeMinor: number; expenseMinor: number }>;
}) {
  const months = useMemo(() => monthRows(txs, year, flow), [txs, year, flow]);
  const cats = useMemo(() => categoryBreakdown(txs), [txs]);
  const [selCat, setSelCat] = useState<string | null>(null);
  const savingsPct = savingsRatePct(row.incomeMinor, row.expenseMinor);
  const prevSavingsPct = savingsRatePct(prevRow.incomeMinor, prevRow.expenseMinor);
  const savingsPctDeltaPt = savingsPct != null && prevSavingsPct != null ? savingsPct - prevSavingsPct : null;

  const { best, worst } = useMemo(() => bestWorstMonth(months), [months]);

  return (
    <>
      <Totals
        income={row.incomeMinor}
        expense={row.expenseMinor}
        savings={row.savingsMinor}
        savingsPct={savingsPct}
        savingsPctDeltaPt={savingsPctDeltaPt}
        deltaLabel="last year"
      />
      {(best || worst) && (
        <div className="mx-4 mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
          {best && <p>Best month: {monthLabel(best.yyyymm).split(' ')[0]} ({formatNet(best.savingsMinor)})</p>}
          {worst && <p>Toughest month: {monthLabel(worst.yyyymm).split(' ')[0]} ({formatNet(worst.savingsMinor)})</p>}
        </div>
      )}
      {isHist && (
        <Note>
          Pre-app record — totals come from your saved yearly summary
          {row.depositMinor !== null ? ` (Total Deposit ${formatAmount(row.depositMinor)})` : ''}. Charts below show only data recorded in the app (Partial data).
        </Note>
      )}
      {!isHist && txs.length === 0 && <p className="px-6 py-8 text-center text-sm text-muted">No data for this year.</p>}
      {(txs.length > 0 || flow.size > 0) && (
        <>
          <Section title="Income vs expense by month" right={<IncomeExpenseLegend />}><IncomeExpenseBars rows={months} /></Section>
          {txs.length > 0 && (
            <Section title="Expense by category">
              <CategoryDonut items={cats} totalMinor={row.expenseMinor} />
              <CategoryBars items={cats} onSelect={setSelCat} />
            </Section>
          )}
          {selCat && <CategoryHistorySheet name={selCat} txs={txs} cats={cats} onClose={() => setSelCat(null)} />}
        </>
      )}
      <YearlyBreakdown uid={uid} historical={historical} thisYear={thisYear} snapshots={snapshots} />
    </>
  );
}

export function AllTimeView({ uid, historical }: { uid: string; historical: readonly HistoricalLite[] }) {
  const thisYear = toDhakaDate(new Date()).slice(0, 4);
  // সব বছরের লেনদেন একবার (খাতওয়ারি চার্টের জন্য, Yearly-র মতোই সবসময় খোলা)। বছরের মোট আগের মতোই doc-precedence (C17)।
  const tx = useRangeTransactions(uid, '2000-01-01', `${thisYear}-12-31`);
  const snaps = useNetWorthSnapshots(uid);
  const allTxs = useMemo<readonly TxLite[]>(() => (tx.state.status === 'ready' ? tx.state.data : []), [tx.state]);
  const cats = useMemo(() => categoryBreakdown(allTxs), [allTxs]);
  const catTotal = useMemo(() => allTxs.reduce((a, t) => (t.type === 'expense' ? a + t.amountMinor : a), 0), [allTxs]);
  const [selCat, setSelCat] = useState<string | null>(null);

  if (tx.state.status === 'loading') return <SkeletonLoader />;
  if (tx.state.status === 'error') return <ErrorBox onRetry={tx.retry} />;

  const rows = allTimeRows(historical, tx.state.data);
  const sum = rows.reduce((a, r) => ({ i: a.i + r.incomeMinor, e: a.e + r.expenseMinor }), { i: 0, e: 0 });

  return (
    <>
      <div className="mx-4 flex items-center justify-between gap-2 pt-3">
        <span className="font-medium text-fg">All-Time</span>
      </div>
      <Totals income={sum.i} expense={sum.e} savings={sum.i - sum.e} savingsPct={savingsRatePct(sum.i, sum.e)} />
      {snaps.state.status === 'ready' && (() => {
        const growth = netWorthGrowthAllTime(snaps.state.data);
        return growth ? (
          <Card as="section" ariaLabel="Net worth growth" className="mx-4 mt-3 flex items-center gap-2 px-3 py-2.5">
            <IconBadge icon={Wallet} tone="primary" size={28} />
            <p className="min-w-0 flex-1 truncate text-xs text-muted">Net Worth · {growth.latestYyyymm}</p>
            <p className="shrink-0 text-base font-semibold text-fg">{formatTaka(growth.latestMinor)}</p>
            {growth.deltaPct != null && (
              <p className={`shrink-0 text-xs font-medium ${growth.deltaPct >= 0 ? 'text-income' : 'text-expense'}`} title={`vs ${growth.earliestYyyymm}`}>
                {growth.deltaPct >= 0 ? '↑' : '↓'}{Math.abs(growth.deltaPct).toFixed(1)}%
                <span className="sr-only"> vs {growth.earliestYyyymm}</span>
              </p>
            )}
          </Card>
        ) : null;
      })()}
      {allTxs.length > 0 && (
        <Section title="Expense by category">
          <CategoryDonut items={cats} totalMinor={catTotal} />
          <CategoryBars items={cats} onSelect={setSelCat} />
          <p className="mt-2 text-xs text-muted">All years, entries recorded in the app only — pre-app years may not add up to the yearly totals.</p>
        </Section>
      )}
      {selCat && <CategoryHistorySheet name={selCat} txs={allTxs} cats={cats} onClose={() => setSelCat(null)} />}
      <YearsCard uid={uid} rows={rows} historical={historical} liveTxs={tx.state.data} />
      <Section title="Net Worth Trend (Total Assets)">
        {snaps.state.status === 'ready' ? <TrendLine points={trendSeries(snaps.state.data)} /> : snaps.state.status === 'error' ? <p role="alert" className="text-sm text-muted">Couldn’t load snapshots.</p> : <SkeletonLoader />}
      </Section>
      <Section title="Savings rate by year">
        <SavingsRateBars items={yearlySavingsRates(rows)} />
      </Section>
    </>
  );
}

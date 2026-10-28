import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Flag } from 'lucide-react';
import { monthSpendStats } from '../../../lib/budgetPace';
import { monthLabel } from '../../../lib/date';
import { formatAmount, formatNet, formatPlain } from '../../../lib/format';

/** সংখ্যা ০ থেকে লক্ষ্যমানে গুনে ওঠে (~৭০০ms, ১০০ms দেরিতে); reduced-motion হলে সরাসরি মান। month বদলালে আবার চলে। */
const canAnimate = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && typeof requestAnimationFrame === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function useCountUp(target: number, resetKey: string): number {
  const [val, setVal] = useState(() => (canAnimate() ? 0 : target));
  useEffect(() => {
    if (!canAnimate()) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now() + 100;
    const tick = (now: number) => {
      const p = Math.min(Math.max((now - start) / 700, 0), 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setVal(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, resetKey]);
  return val;
}

export type TypeFilter = 'income' | 'expense' | null;

/** Home summary: Savings + Income/Expense চিপ (ট্যাপে ফিল্টার) + Target bar (overflow-aware) + Avg/Safe/Forecast।
 *  Owner-approved 2026-10-27 (আগের Month summary + MonthTargetCard-এর বদলে)। Pure display, নতুন query/schema নেই। */
export default function MonthSummaryCard({
  incomeMinor,
  expenseMinor,
  savingsMinor,
  budgetMinor,
  avgExpenseMinor = null,
  month,
  today,
  typeFilter,
  onTypeFilter,
}: {
  incomeMinor: number;
  expenseMinor: number;
  savingsMinor: number;
  budgetMinor: number | null;
  /** আগের ৩ মাসের গড় মাসিক ব্যয় (Overview-র মতোই); ডেটা না থাকলে null */
  avgExpenseMinor?: number | null;
  month: string;
  today: string;
  typeFilter: TypeFilter;
  onTypeFilter: (t: TypeFilter) => void;
}) {
  const avgRounded = avgExpenseMinor != null ? Math.round(avgExpenseMinor / 100) * 100 : 0;
  const aIncome = useCountUp(incomeMinor, month);
  const aExpense = useCountUp(expenseMinor, month);
  const aAvg = useCountUp(avgRounded, month);
  const aSavings = useCountUp(savingsMinor, month);
  const hasBudget = budgetMinor != null && budgetMinor > 0;
  const s = hasBudget ? monthSpendStats(expenseMinor, budgetMinor, month, today) : null;
  const pct = hasBudget ? (expenseMinor / budgetMinor) * 100 : 0;
  const aPct = useCountUp(Math.round(pct), month);
  const over = hasBudget && expenseMinor > budgetMinor;
  const forecastBad = !!s && s.forecastMinor != null && hasBudget && s.forecastMinor > budgetMinor;
  const negative = savingsMinor < 0;
  // কার্ডের ব্যাকগ্রাউন্ড আভা: উপরে ৩% → মাঝে ৫% → নিচে ১০% (theme token, সব theme-এ মেলে)
  const glow = over || negative ? 'from-muted/[0.03] via-muted/5 to-muted/10' : 'from-income/[0.03] via-income/5 to-income/10';
  const shortMonth = monthLabel(month).split(' ')[0].slice(0, 3);
  const daysLeftText = s && s.daysLeft > 0 && s.forecastMinor != null ? ` · ${s.daysLeft}d left` : '';

  // bar: over হলে মোট ব্যয়কে ১০০% ধরে, টিক = target-এর অবস্থান; নইলে bar = ব্যয়/target, টিক ডান প্রান্তে
  const tickPct = over ? (budgetMinor / expenseMinor) * 100 : 100;
  const fillPct = over ? tickPct : Math.min(pct, 100);
  const fillTone = pct >= 90 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-primary';
  const pctTone = over ? 'text-expense' : pct >= 90 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-primary';

  const tile = 'flex h-16 min-w-0 flex-col justify-center overflow-hidden whitespace-nowrap rounded-xl border border-muted/10 px-2.5 py-1.5';
  const chip = (kind: 'income' | 'expense', amount: number, shown: number, delay: number) => {
    const active = typeFilter === kind;
    const Icon = kind === 'income' ? ArrowUpRight : ArrowDownRight;
    const tone = kind === 'income' ? 'text-income' : 'text-expense';
    const bg = over || negative ? 'bg-muted/10' : kind === 'income' ? 'bg-income/10' : 'bg-expense/10';
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${kind === 'income' ? 'Income' : 'Expense'} ${formatAmount(amount)}`}
        onClick={() => onTypeFilter(active ? null : kind)}
        className={`${tile} ms-up text-left ${tone} ${bg} ${active ? 'ring-2 ring-current' : ''}`}
        style={{ animationDelay: `${delay}ms` }}
      >
        <span className="flex items-center gap-1 text-[11px] leading-tight text-muted">
          <Icon aria-hidden size={12} />
          {kind === 'income' ? 'Income' : 'Expense'}
        </span>
        <span className="text-base font-semibold leading-tight">{formatPlain(shown)}</span>
      </button>
    );
  };

  return (
    <section
      key={month}
      aria-label="Month summary"
      className={`mx-4 rounded-2xl border bg-canvas bg-gradient-to-b p-2.5 shadow-sm proportional-nums ${glow} border-muted/10`}
    >
      <div className="grid grid-cols-3 gap-2">
        {chip('income', incomeMinor, aIncome, 0)}
        {chip('expense', expenseMinor, aExpense, 50)}
        <div className={`${tile} ms-up bg-muted/10`} style={{ animationDelay: '100ms' }} aria-label="Average expense per month, last 3 months">
          <span className="text-[11px] leading-tight text-muted">⌀ Avg/mo · 3m</span>
          <span className="text-base font-semibold leading-tight text-fg">{avgExpenseMinor != null ? formatPlain(aAvg) : '—'}</span>
        </div>
      </div>

      {hasBudget && s && (
        <div className="relative my-2.5" role="img" aria-label={`${Math.round(pct)}% of target used`}>
          <div className="ms-bar flex h-2 overflow-hidden rounded-full bg-muted/15">
            <div className={`h-full ${fillTone}`} style={{ width: `${fillPct}%` }} />
            {over && <div className="h-full bg-expense" style={{ width: `${100 - fillPct}%` }} />}
          </div>
          <div
            aria-hidden
            className="ms-pop absolute top-1/2 -mt-2 flex h-4 w-4 items-center justify-center rounded-full border border-fg bg-canvas text-fg"
            style={{ left: `calc(${tickPct}% - ${tickPct >= 97 ? 14 : 8}px)` }}
          >
            <Flag size={9} />
          </div>
        </div>
      )}

      <div className={`grid gap-2 ${hasBudget && s ? 'grid-cols-2' : 'grid-cols-1'} ${hasBudget && s ? '' : 'mt-2'}`}>
        <div className={`${tile} ms-up bg-surface`} style={{ animationDelay: '250ms' }}>
          <p className="text-[11px] leading-tight text-muted">{`Savings · ${shortMonth}${daysLeftText}`}</p>
          <p className={`text-[19px] font-semibold leading-tight ${negative ? 'text-expense' : 'text-income'}`}>{formatNet(aSavings)}</p>
          {s && s.elapsedDays > 0 && (
            <p className="text-[11px] leading-tight text-muted">
              Avg <span className="font-medium text-fg">{formatPlain(s.avgPerDayMinor)}</span>
              {s.safePerDayMinor != null && (
                <>
                  {' · '}Safe <span className="font-medium text-fg">{formatPlain(s.safePerDayMinor)}</span>
                </>
              )}
              /day
            </p>
          )}
        </div>
        {hasBudget && s && (
          <div className={`${tile} ms-up bg-surface text-[10px] text-muted`} style={{ animationDelay: '300ms' }}>
            <span className="leading-tight">
              <span className={`text-[15px] font-semibold ${pctTone}`}>{aPct}%</span> of target {formatPlain(budgetMinor)}
            </span>
            <span className={`font-medium leading-tight ${pctTone}`}>
              {over ? `${formatPlain(expenseMinor - budgetMinor)} over` : `${formatPlain(budgetMinor - expenseMinor)} left`}
            </span>
            {s.elapsedDays > 0 && s.forecastMinor != null && (
              <span className="flex items-center gap-1 leading-tight">
                Forecast <span className={`font-medium ${forecastBad ? (over ? 'text-expense' : 'text-warning') : 'text-income'}`}>{formatPlain(s.forecastMinor)}</span>
                {forecastBad ? (
                  <AlertTriangle aria-label="Forecast is above target" size={11} className={over ? 'text-expense' : 'text-warning'} />
                ) : (
                  <Check aria-label="Forecast is within target" size={11} className="text-income" />
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

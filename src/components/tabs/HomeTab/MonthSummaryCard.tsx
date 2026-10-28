import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check } from 'lucide-react';
import { monthSpendStats } from '../../../lib/budgetPace';
import { monthLabel } from '../../../lib/date';
import { formatAmount, formatNet, formatPlain } from '../../../lib/format';

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
  const hasBudget = budgetMinor != null && budgetMinor > 0;
  const s = hasBudget ? monthSpendStats(expenseMinor, budgetMinor, month, today) : null;
  const pct = hasBudget ? (expenseMinor / budgetMinor) * 100 : 0;
  const over = hasBudget && expenseMinor > budgetMinor;
  const forecastBad = !!s && s.forecastMinor != null && hasBudget && s.forecastMinor > budgetMinor;
  const negative = savingsMinor < 0;
  // কার্ডের ব্যাকগ্রাউন্ড আভা: উপরে ৩% → মাঝে ৫% → নিচে ১০% (theme token, সব theme-এ মেলে)
  const glow = over || negative ? 'from-muted/[0.03] via-muted/5 to-muted/10' : 'from-income/[0.03] via-income/5 to-income/10';
  const shortMonth = monthLabel(month).split(' ')[0].slice(0, 3);
  const daysLeftText = s && s.daysLeft > 0 && s.forecastMinor != null ? ` · ${s.daysLeft} days left` : '';

  // bar: over হলে মোট ব্যয়কে ১০০% ধরে, টিক = target-এর অবস্থান; নইলে bar = ব্যয়/target, টিক ডান প্রান্তে
  const tickPct = over ? (budgetMinor / expenseMinor) * 100 : 100;
  const fillPct = over ? tickPct : Math.min(pct, 100);
  const fillTone = pct >= 90 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-primary';
  const pctTone = over ? 'text-expense' : pct >= 90 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-primary';

  const tile = 'flex h-[60px] min-w-0 flex-col justify-center overflow-hidden whitespace-nowrap rounded-xl px-2.5 py-1';
  const chip = (kind: 'income' | 'expense', amount: number) => {
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
        className={`${tile} text-left ${tone} ${bg} ${active ? 'ring-2 ring-current' : ''}`}
      >
        <span className="flex items-center gap-1 text-[11px] leading-tight text-muted">
          <Icon aria-hidden size={12} />
          {kind === 'income' ? 'Income' : 'Expense'}
        </span>
        <span className="text-base font-semibold leading-tight">{formatPlain(amount)}</span>
      </button>
    );
  };

  return (
    <section
      aria-label="Month summary"
      className={`mx-4 rounded-2xl border bg-canvas bg-gradient-to-b p-2.5 shadow-sm proportional-nums ${glow} border-muted/10`}
    >
      <div className="grid grid-cols-3 gap-2">
        {chip('income', incomeMinor)}
        {chip('expense', expenseMinor)}
        <div className={`${tile} bg-muted/10`} aria-label="Average expense per month, last 3 months">
          <span className="text-[11px] leading-tight text-muted">⌀ Avg/mo · 3m</span>
          <span className="text-base font-semibold leading-tight text-fg">{avgExpenseMinor != null ? formatPlain(Math.round(avgExpenseMinor / 100) * 100) : '—'}</span>
        </div>
      </div>

      {hasBudget && s && (
        <div className="relative mb-4 mt-2" role="img" aria-label={`${Math.round(pct)}% of target used`}>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted/15">
            <div className={`h-full ${fillTone}`} style={{ width: `${fillPct}%` }} />
            {over && <div className="h-full bg-expense" style={{ width: `${100 - fillPct}%` }} />}
          </div>
          <div className="absolute -top-[3px] h-3.5 w-0.5 rounded-sm bg-fg" style={{ left: `calc(${tickPct}% - 1px)` }} />
          <span
            aria-hidden
            className="absolute top-3 text-[9px] leading-none text-muted"
            style={{ left: `${tickPct}%`, transform: `translateX(${tickPct > 90 ? '-100%' : tickPct < 10 ? '0' : '-50%'})` }}
          >
            target
          </span>
        </div>
      )}

      <div className={`grid gap-2 ${hasBudget && s ? 'grid-cols-2' : 'grid-cols-1'} ${hasBudget && s ? '' : 'mt-2'}`}>
        <div className={`${tile} border border-muted/10 bg-surface`}>
          <p className="text-[11px] leading-tight text-muted">{`Savings · ${shortMonth}${daysLeftText}`}</p>
          <p className={`text-[19px] font-semibold leading-tight ${negative ? 'text-expense' : 'text-income'}`}>{formatNet(savingsMinor)}</p>
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
          <div className={`${tile} border border-muted/10 bg-surface text-[10px] text-muted`}>
            <span className="leading-tight">
              <span className={`text-[15px] font-semibold ${pctTone}`}>{Math.round(pct)}%</span> of target {formatPlain(budgetMinor)}
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

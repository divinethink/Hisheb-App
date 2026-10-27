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
  month,
  today,
  typeFilter,
  onTypeFilter,
}: {
  incomeMinor: number;
  expenseMinor: number;
  savingsMinor: number;
  budgetMinor: number | null;
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
  const shortMonth = monthLabel(month).split(' ')[0].slice(0, 3);
  const daysLeftText = s && s.daysLeft > 0 && s.forecastMinor != null ? ` · ${s.daysLeft} days left` : '';

  // bar: over হলে মোট ব্যয়কে ১০০% ধরে, টিক = target-এর অবস্থান; নইলে bar = ব্যয়/target, টিক ডান প্রান্তে
  const tickPct = over ? (budgetMinor / expenseMinor) * 100 : 100;
  const fillPct = over ? tickPct : Math.min(pct, 100);
  const fillTone = pct >= 90 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-primary';
  const pctTone = over ? 'text-expense' : pct >= 90 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-primary';

  const chip = (kind: 'income' | 'expense', amount: number) => {
    const active = typeFilter === kind;
    const Icon = kind === 'income' ? ArrowUpRight : ArrowDownRight;
    const tone = kind === 'income' ? 'text-income' : 'text-expense';
    const bg = over || negative ? 'bg-canvas' : kind === 'income' ? 'bg-income/10' : 'bg-expense/10';
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${kind === 'income' ? 'Income' : 'Expense'} ${formatAmount(amount)}`}
        onClick={() => onTypeFilter(active ? null : kind)}
        className={`flex min-h-7 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone} ${bg} ${active ? 'ring-2 ring-current' : ''}`}
      >
        <Icon aria-hidden size={13} />
        <span>{formatPlain(amount)}</span>
      </button>
    );
  };

  return (
    <section
      aria-label="Month summary"
      className={`mx-4 rounded-2xl border p-3 shadow-sm ${over ? 'border-expense/30 bg-expense/10' : 'border-muted/10 bg-canvas'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted">{`Savings · ${shortMonth}${daysLeftText}`}</p>
          <p className={`text-[22px] font-semibold leading-tight ${negative ? 'text-expense' : 'text-income'}`}>{formatNet(savingsMinor)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {chip('income', incomeMinor)}
          {chip('expense', expenseMinor)}
        </div>
      </div>

      {hasBudget && s && (
        <>
          <div className="relative mb-1 mt-2.5" role="img" aria-label={`${Math.round(pct)}% of target used`}>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted/15">
              <div className={`h-full ${fillTone}`} style={{ width: `${fillPct}%` }} />
              {over && <div className="h-full bg-expense" style={{ width: `${100 - fillPct}%` }} />}
            </div>
            <div className="absolute -top-[3px] h-3.5 w-0.5 rounded-sm bg-fg" style={{ left: `calc(${tickPct}% - 1px)` }} />
          </div>
          <div className="flex justify-between gap-1.5 text-xs text-muted">
            <span>
              <span className={`font-medium ${pctTone}`}>{Math.round(pct)}%</span> of target {formatPlain(budgetMinor)}
            </span>
            <span className={`font-medium ${pctTone}`}>
              {over ? `${formatPlain(expenseMinor - budgetMinor)} over` : `${formatPlain(budgetMinor - expenseMinor)} left`}
            </span>
          </div>
          {s.elapsedDays > 0 && (
            <div className="mt-0.5 flex justify-between gap-1.5 text-xs text-muted">
              <span>
                Avg <span className="font-medium text-fg">{formatPlain(s.avgPerDayMinor)}</span>
                {s.safePerDayMinor != null && (
                  <>
                    {' · '}Safe <span className="font-medium text-fg">{formatPlain(s.safePerDayMinor)}</span>
                  </>
                )}{' '}
                /day
              </span>
              {s.forecastMinor != null && (
                <span className="flex items-center gap-1">
                  Forecast <span className={`font-medium ${forecastBad ? (over ? 'text-expense' : 'text-warning') : 'text-income'}`}>{formatPlain(s.forecastMinor)}</span>
                  {forecastBad ? (
                    <AlertTriangle aria-label="Forecast is above target" size={13} className={over ? 'text-expense' : 'text-warning'} />
                  ) : (
                    <Check aria-label="Forecast is within target" size={13} className="text-income" />
                  )}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

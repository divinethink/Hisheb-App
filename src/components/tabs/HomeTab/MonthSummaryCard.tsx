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
  const fillTone =
    pct >= 90 ? 'from-danger/70 to-danger' : pct >= 80 ? 'from-warning/70 to-warning' : 'from-primary/70 to-primary';
  // কার্ডের আভা: উপরে হালকা (৩%) → মাঝে ৫% → নিচে একটু গাঢ় (৭%); রং theme token থেকে, তাই সব theme-এ মেলে
  const glow = over || negative ? 'from-expense/[0.03] via-expense/5 to-expense/[0.07]' : 'from-income/[0.03] via-income/5 to-income/[0.07]';
  const netMatch = formatNet(savingsMinor).match(/^([+−]?BDT )(.*)$/);
  const pctTone = over ? 'text-expense' : pct >= 90 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-primary';

  const chip = (kind: 'income' | 'expense', amount: number) => {
    const active = typeFilter === kind;
    const Icon = kind === 'income' ? ArrowUpRight : ArrowDownRight;
    const tone = kind === 'income' ? 'text-income' : 'text-expense';
    const bg = kind === 'income' ? 'bg-income/10' : 'bg-expense/10';
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${kind === 'income' ? 'Income' : 'Expense'} ${formatAmount(amount)}`}
        onClick={() => onTypeFilter(active ? null : kind)}
        className={`relative flex min-h-7 items-center gap-1 rounded-full before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] px-3 py-0.5 text-[13px] font-semibold ${tone} ${bg} ${active ? 'ring-2 ring-current' : ''}`}
      >
        <Icon aria-hidden size={13} />
        <span>{formatPlain(amount)}</span>
      </button>
    );
  };

  return (
    <section
      aria-label="Month summary"
      className={`mx-4 rounded-3xl border bg-canvas bg-gradient-to-b p-4 proportional-nums ${glow} ${over ? 'border-expense/25 shadow-[0_12px_28px_-12px_rgb(var(--color-expense)/0.28)]' : 'border-muted/10 shadow-sm'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted">{`Savings · ${shortMonth}${daysLeftText}`}</p>
          <p className={`mt-0.5 text-[30px] font-bold leading-tight tracking-tight ${negative ? 'text-expense' : 'text-income'}`}>
            {netMatch ? (
              <>
                <span className="mr-1 text-[15px] font-semibold opacity-70">{netMatch[1]}</span>
                {netMatch[2]}
              </>
            ) : (
              formatNet(savingsMinor)
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {chip('income', incomeMinor)}
          {chip('expense', expenseMinor)}
        </div>
      </div>

      {hasBudget && s && (
        <>
          <div className="relative mb-5 mt-5" role="img" aria-label={`${Math.round(pct)}% of target used`}>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/15">
              <div
                className={`h-full bg-gradient-to-r ${over ? 'from-warning/60 to-danger' : fillTone}`}
                style={{ width: `${fillPct}%` }}
              />
              {over && <div className="h-full bg-gradient-to-r from-expense/80 to-expense" style={{ width: `${100 - fillPct}%` }} />}
            </div>
            <div
              className="absolute -top-[5px] h-5 w-[3px] rounded-sm bg-gradient-to-b from-fg/10 via-fg/40 to-fg/85 shadow-[0_0_0_2px_rgb(var(--color-canvas))]"
              style={{ left: `calc(${tickPct}% - 1.5px)` }}
            />
            <span
              aria-hidden
              className="absolute top-[18px] text-[10px] leading-none text-muted"
              style={{ left: `${tickPct}%`, transform: `translateX(${tickPct > 90 ? '-100%' : tickPct < 10 ? '0' : '-50%'})` }}
            >
              target
            </span>
          </div>
          <div className="flex justify-between gap-1.5 text-[13px] text-muted">
            <span>
              <span className={`font-medium ${pctTone}`}>{Math.round(pct)}%</span> of target {formatPlain(budgetMinor)}
            </span>
            <span className={`font-medium ${pctTone}`}>
              {over ? `${formatPlain(expenseMinor - budgetMinor)} over` : `${formatPlain(budgetMinor - expenseMinor)} left`}
            </span>
          </div>
          {s.elapsedDays > 0 && (
            <div className="mt-3 flex items-end justify-between gap-2 border-t border-muted/10 pt-3 text-xs text-muted">
              <div className="flex gap-4">
                <div>
                  Avg / day
                  <span className="mt-0.5 block text-base font-semibold text-fg">{formatPlain(s.avgPerDayMinor)}</span>
                </div>
                {s.safePerDayMinor != null && (
                  <div>
                    Safe / day
                    <span className="mt-0.5 block text-base font-semibold text-fg">{formatPlain(s.safePerDayMinor)}</span>
                  </div>
                )}
              </div>
              {s.forecastMinor != null && (
                <div className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    Forecast
                    {forecastBad ? (
                      <AlertTriangle aria-label="Forecast is above target" size={13} className={over ? 'text-expense' : 'text-warning'} />
                    ) : (
                      <Check aria-label="Forecast is within target" size={13} className="text-income" />
                    )}
                  </span>
                  <span className={`mt-0.5 block text-base font-semibold ${forecastBad ? (over ? 'text-expense' : 'text-warning') : 'text-income'}`}>
                    {formatPlain(s.forecastMinor)}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

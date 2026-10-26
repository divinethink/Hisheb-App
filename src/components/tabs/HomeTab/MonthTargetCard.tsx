import { AlertTriangle, Check } from 'lucide-react';
import Card from '../../common/Card';
import { monthSpendStats } from '../../../lib/budgetPace';
import { formatAmount } from '../../../lib/format';

const R = 26;
const CIRC = 2 * Math.PI * R;

// BudgetProgressBar-এর ৪-স্তরের হুবহু থ্রেশহোল্ড (৮০/৯০/১০০) — শুধু stroke/text রঙ
function ringClass(pct: number): string {
  if (pct >= 100) return 'stroke-expense';
  if (pct >= 90) return 'stroke-danger';
  if (pct >= 80) return 'stroke-warning';
  return 'stroke-primary';
}
function toneText(pct: number): string {
  if (pct >= 100) return 'text-expense';
  if (pct >= 90) return 'text-danger';
  if (pct >= 80) return 'text-warning';
  return 'text-primary';
}

/** Home "Monthly target" — ring-gauge + Avg/Safe/Forecast (Owner-approved 2026-10-27)। Pure display, নতুন query/schema নেই। */
export default function MonthTargetCard({
  spentMinor,
  budgetMinor,
  month,
  today,
}: {
  spentMinor: number;
  budgetMinor: number;
  month: string;
  today: string;
}) {
  const pct = (spentMinor / budgetMinor) * 100;
  const arc = (Math.min(pct, 100) / 100) * CIRC;
  const over = spentMinor > budgetMinor;
  const s = monthSpendStats(spentMinor, budgetMinor, month, today);
  const forecastBad = s.forecastMinor != null && s.forecastMinor > budgetMinor;
  const forecastTone = !forecastBad ? 'text-income' : pct >= 100 ? 'text-expense' : 'text-warning';

  return (
    <Card as="section" ariaLabel="Monthly target" className="mx-4 mt-2 flex items-center gap-3.5 p-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" className="stroke-muted/15" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${CIRC}`}
            transform="rotate(-90 32 32)"
            className={ringClass(pct)}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${over ? 'text-expense' : 'text-fg'}`}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">Monthly target · {formatAmount(budgetMinor)}</p>
        <p className={`text-base font-semibold ${toneText(pct)}`}>
          {over ? `${formatAmount(spentMinor - budgetMinor)} over` : `${formatAmount(budgetMinor - spentMinor)} left`}
        </p>
        {s.elapsedDays > 0 && (
          <p className="mt-0.5 text-xs text-muted">
            Avg <span className="font-medium text-chart3">{formatAmount(s.avgPerDayMinor)}/day</span>
            {s.daysLeft > 0 && <> · {s.daysLeft} days left</>}
          </p>
        )}
        {s.safePerDayMinor != null && (
          <p className="text-xs text-muted">
            Safe <span className="font-medium text-fg">{formatAmount(s.safePerDayMinor)}/day</span>
          </p>
        )}
        {s.forecastMinor != null && (
          <p className="flex items-center gap-1 text-xs text-muted">
            Forecast <span className={`font-medium ${forecastTone}`}>{formatAmount(s.forecastMinor)}</span>
            {forecastBad ? (
              <AlertTriangle aria-label="Forecast is above target" size={12} className={forecastTone} />
            ) : (
              <Check aria-label="Forecast is within target" size={12} className={forecastTone} />
            )}
          </p>
        )}
      </div>
    </Card>
  );
}

import { formatAmount } from '../../lib/format';

// ৪-স্তর রঙ (Roadmap §৪.১০): <৮০% primary(info), ৮০%+ warning, ৯০%+ danger, ১০০%+ expense(critical)।
function levelColorClass(pct: number): string {
  if (pct >= 100) return 'bg-expense';
  if (pct >= 90) return 'bg-danger';
  if (pct >= 80) return 'bg-warning';
  return 'bg-primary';
}

export default function BudgetProgressBar({
  spentMinor,
  budgetMinor,
  paceMinor,
  showPace = false,
}: {
  spentMinor: number;
  budgetMinor: number;
  /** budgetPace()-এর expectedSpentMinor — শুধু চলতি মাসে caller পাঠাবে */
  paceMinor?: number;
  showPace?: boolean;
}) {
  const pct = budgetMinor > 0 ? (spentMinor / budgetMinor) * 100 : 0;
  const barPct = Math.min(pct, 100);
  const paceRatio = showPace && paceMinor != null && budgetMinor > 0 ? Math.min((paceMinor / budgetMinor) * 100, 100) : null;

  return (
    <div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/15">
        <div className={`h-full rounded-full ${levelColorClass(pct)}`} style={{ width: `${barPct}%` }} />
        {paceRatio !== null && (
          <span aria-hidden className="absolute top-0 h-full w-0.5 bg-fg/70" style={{ left: `${paceRatio}%` }} />
        )}
      </div>
      {paceRatio !== null && paceMinor != null && (
        <p className="mt-1 text-xs text-muted">Expected by today: {formatAmount(paceMinor)}</p>
      )}
    </div>
  );
}

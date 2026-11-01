import { CircleAlert, CircleCheck, Info, TrendingDown, TrendingUp } from 'lucide-react';
import Card from '../../common/Card';
import { formatAmount, formatNet } from '../../../lib/format';
import { monthName } from '../../../lib/historyCalc';
import type { NoteTone, SnapshotInsight } from '../../../lib/snapshotInsight';

// Net Worth → "Monthly Insight" কার্ড (owner-request 2026-11-01): snapshot বনাম আগের snapshot — কোথায় বাড়ল/কমল, আয়-ব্যয়,
// সচেতনতার নোট। শুধু দেখানো; হিসাব lib/snapshotInsight.ts-এ (pure)। কিছু store হয় না।

const NOTE_ICON: Record<NoteTone, { Icon: typeof Info; cls: string }> = {
  warn: { Icon: CircleAlert, cls: 'text-expense' },
  info: { Icon: Info, cls: 'text-muted' },
  good: { Icon: CircleCheck, cls: 'text-income' },
};

const lbl = (m: string) => `${monthName(m, true)} ${m.slice(0, 4)}`;

function Delta({ minor }: { minor: number }) {
  if (minor === 0) return <span className="text-muted">No change</span>;
  const up = minor > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 ${up ? 'text-income' : 'text-expense'}`}>
      <Icon aria-hidden size={12} />
      {formatNet(minor)}
    </span>
  );
}

export default function SnapshotInsightCard({ insight: i }: { insight: SnapshotInsight }) {
  const movers = i.accountMoves.slice(0, 3);
  return (
    <Card className="mx-4 mb-3 p-4">
      <h2 className="text-sm font-semibold text-fg">
        Monthly Insight <span className="font-normal text-muted">· {lbl(i.currentYyyymm)} vs {lbl(i.previousYyyymm)}</span>
      </h2>
      <p className="mt-1 flex items-center justify-between text-sm">
        <span className="text-muted">Total assets</span>
        <span className="font-medium">
          <Delta minor={i.totalDeltaMinor} />
          {i.totalDeltaPct !== null && i.totalDeltaMinor !== 0 ? <span className="text-muted"> ({i.totalDeltaPct}%)</span> : null}
        </span>
      </p>

      {i.components.length > 0 && (
        <dl className="mt-3 flex flex-col gap-1 border-t border-muted/10 pt-2 text-sm">
          <dt className="text-xs text-muted">Where it moved</dt>
          {i.components.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <dd className="min-w-0 truncate text-fg">{c.label}</dd>
              <dd className="shrink-0"><Delta minor={c.deltaMinor} /></dd>
            </div>
          ))}
        </dl>
      )}

      {movers.length > 0 && (
        <dl className="mt-3 flex flex-col gap-1 border-t border-muted/10 pt-2 text-sm">
          <dt className="text-xs text-muted">Biggest account changes</dt>
          {movers.map((a) => (
            <div key={a.name} className="flex items-center justify-between gap-3">
              <dd className="min-w-0 truncate text-fg">{a.name}</dd>
              <dd className="shrink-0"><Delta minor={a.deltaMinor} /></dd>
            </div>
          ))}
        </dl>
      )}

      {(i.incomeMinor > 0 || i.expenseMinor > 0) && (
        <dl className="mt-3 flex flex-col gap-1 border-t border-muted/10 pt-2 text-sm">
          <dt className="text-xs text-muted">Income &amp; expense in this period</dt>
          <div className="flex justify-between"><dd className="text-muted">Income</dd><dd className="text-fg">{formatAmount(i.incomeMinor)}</dd></div>
          <div className="flex justify-between"><dd className="text-muted">Expense</dd><dd className="text-fg">{formatAmount(i.expenseMinor)}</dd></div>
          <div className="flex justify-between"><dd className="font-medium text-fg">Saved</dd><dd className="font-medium"><Delta minor={i.savingsMinor} /></dd></div>
        </dl>
      )}

      {i.notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-muted/10 pt-3">
          {i.notes.map((n, idx) => {
            const { Icon, cls } = NOTE_ICON[n.tone];
            return (
              <li key={idx} className="flex items-start gap-2 text-sm text-fg">
                <Icon aria-hidden size={16} className={`mt-0.5 shrink-0 ${cls}`} />
                <span>{n.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

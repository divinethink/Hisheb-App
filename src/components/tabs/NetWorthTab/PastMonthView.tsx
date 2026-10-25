import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';
import CategoryIcon from '../../common/CategoryIcon';
import { formatAmount, formatNet } from '../../../lib/format';
import { formatDisplayDate, monthLabel } from '../../../lib/date';
import { monthName, type MonthDetail } from '../../../lib/historyCalc';

// Net Worth → `‹ মাস ›` (owner-approved): নির্বাচিত মাসের সাময়িক-নয়, সংরক্ষিত snapshot — শুধু পড়া (read-only)।
// কোনো নতুন query/schema নেই; ভাঙা-হিসাব না থাকলে শুধু মোট ("Total only"), snapshot না থাকলে "No snapshot"।

export function MonthStepper({
  month,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: {
  month: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}) {
  const btn = 'flex h-11 w-11 items-center justify-center disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
  return (
    <div className="flex items-center justify-center gap-2 px-2 pb-2">
      <button type="button" aria-label="Previous month" onClick={onPrev} disabled={prevDisabled} className={btn}>
        <ChevronLeft aria-hidden size={20} />
      </button>
      <span className="min-w-36 text-center font-medium text-fg">{monthLabel(month)}</span>
      <button type="button" aria-label="Next month" onClick={onNext} disabled={nextDisabled} className={btn}>
        <ChevronRight aria-hidden size={20} />
      </button>
    </div>
  );
}

export default function PastMonthView({ month, detail, dateFormat }: { month: string; detail: MonthDetail | null; dateFormat: 'dmy' | 'mdy' }) {
  if (!detail) {
    return (
      <Card className="mx-4 mb-3 p-4 text-center">
        <p className="text-sm text-fg">No snapshot for {monthLabel(month)}.</p>
        <p className="mt-1 text-xs text-muted">Balances are saved when you update them at the end of a month.</p>
      </Card>
    );
  }
  const b = detail.breakdown;
  return (
    <>
      <Card className="mx-4 mb-3 flex items-start gap-3 p-4">
        <IconBadge icon={Wallet} tone="primary" size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Total Assets (Gross)</p>
          <p className="text-3xl font-semibold leading-tight text-fg">{formatAmount(detail.totalMinor)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {detail.deltaMinor !== null && detail.prevYyyymm && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  detail.deltaMinor >= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
                }`}
              >
                {detail.deltaMinor >= 0 ? <TrendingUp aria-hidden size={12} /> : <TrendingDown aria-hidden size={12} />}
                {formatNet(detail.deltaMinor)}
                {detail.deltaPct !== null ? ` (${detail.deltaPct}%)` : ''} vs {monthName(detail.prevYyyymm, true)} {detail.prevYyyymm.slice(0, 4)}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Snapshot {formatDisplayDate(detail.snapshotDate, dateFormat)}
            </span>
          </div>
          {detail.unverified && <p className="mt-1 text-xs text-muted">This month is marked unverified (known mismatch with the old Excel).</p>}
        </div>
      </Card>

      {detail.accounts.length > 0 && (
        <Card className="mx-4 mb-3 overflow-hidden">
          <ul>
            {detail.accounts.map((a) => (
              <li key={a.name} className="flex min-h-14 items-center gap-3 border-t border-muted/10 px-4 py-2 first:border-t-0">
                <CategoryIcon name={a.name} />
                <span className="min-w-0 flex-1 truncate text-fg">{a.name}</span>
                <span className="shrink-0 font-medium text-fg">{formatAmount(a.balanceMinor)}</span>
              </li>
            ))}
            {detail.accountsDerived && detail.otherMinor !== null && (
              <li className="flex min-h-14 items-center gap-3 border-t border-muted/10 bg-surface px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fg">Ledger &amp; others</span>
                  <span className="block text-xs text-muted">Total − accounts (split not saved)</span>
                </span>
                <span className="shrink-0 font-medium text-fg">{formatAmount(detail.otherMinor)}</span>
              </li>
            )}
          </ul>
        </Card>
      )}

      {b ? (
        <Card className="mx-4 mb-3 flex flex-col gap-1 p-4 text-sm">
          <p className="flex justify-between pb-2">
            <span className="text-muted">Accounts Total</span>
            <span className="font-medium text-fg">{formatAmount(b.accountsMinor)}</span>
          </p>
          <p className="flex justify-between"><span className="text-muted">+ Total Receivable (Ledger)</span><span className="text-fg">{formatAmount(b.receivableMinor)}</span></p>
          <p className="flex justify-between"><span className="text-muted">+ Running Investment</span><span className="text-fg">{formatAmount(b.investmentMinor)}</span></p>
          <p className="flex justify-between"><span className="text-muted">+ Home Deposit (Net)</span><span className="text-fg">{formatAmount(b.homeDepositMinor)}</span></p>
          <p className="flex justify-between"><span className="text-muted">+ GPF Balance</span><span className="text-fg">{formatAmount(b.gpfMinor)}</span></p>
          <p className="flex justify-between border-t border-muted/10 pt-2 text-base">
            <span className="font-medium text-fg">Total Assets (Gross)</span>
            <span className="font-semibold text-fg">{formatAmount(detail.totalMinor)}</span>
          </p>
        </Card>
      ) : (
        <p className="mx-4 mb-3 text-xs text-muted">{detail.accountsDerived ? 'Account balances are from your monthly updates; ledger split was not saved.' : 'Total only — no split saved for this month.'}</p>
      )}
      <p className="mx-4 mb-3 text-xs text-muted">Past month — read-only. To update balances, go back to the current month.</p>
    </>
  );
}

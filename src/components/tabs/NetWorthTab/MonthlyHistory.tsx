import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, History, Table2 } from 'lucide-react';
import Card from '../../common/Card';
import { accountBalanceOf, accountColumns, groupHistoryByYear, monthName, type HistoryMonth } from '../../../lib/historyCalc';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import type { NetWorthSnapshot } from '../../../validation/netWorthSchema';

// Net Worth ট্যাবের নিচে "Monthly History" — বছর collapse/expand, মাস-কার্ড (ট্যাপে ভাঙা-হিসাব) ও Table view।
// Read-only, কোনো নতুন query নেই (netWorthSnapshots আগে থেকেই subscribe করা) — UI Mockup Net Worth §৬-এর সম্প্রসারণ।
export default function MonthlyHistory({
  snapshots,
  accountOrder,
  dateFormat,
  derivedByMonth,
}: {
  snapshots: NetWorthSnapshot[];
  accountOrder: string[];
  derivedByMonth: Map<string, { name: string; balanceMinor: number }[]>;
  dateFormat: 'dmy' | 'mdy';
}) {
  const years = useMemo(() => groupHistoryByYear(snapshots), [snapshots]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [table, setTable] = useState(false);

  if (years.length === 0) return null;

  function toggleYear(y: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  }

  return (
    <Card className="mx-4 mb-3 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-fg">
          <History aria-hidden size={18} className="text-primary" /> Monthly History
        </span>
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          aria-pressed={table}
          className="flex min-h-11 items-center gap-1 rounded-lg border border-primary/40 px-3 text-xs text-primary"
        >
          <Table2 aria-hidden size={14} /> {table ? 'Card view' : 'Table view'}
        </button>
      </div>

      {years.map((y) => {
        const isOpen = open.has(y.year);
        return (
          <section key={y.year} className="border-t border-muted/10">
            <button
              type="button"
              onClick={() => toggleYear(y.year)}
              aria-expanded={isOpen}
              className="flex min-h-11 w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-1 font-medium text-fg">
                {isOpen ? <ChevronDown aria-hidden size={16} /> : <ChevronRight aria-hidden size={16} />} {y.year}
              </span>
              <span className="text-xs text-muted">{y.months.length} snapshot{y.months.length === 1 ? '' : 's'}</span>
            </button>
            {isOpen &&
              (table ? (
                <YearTable months={y.months} accountOrder={accountOrder} />
              ) : (
                <ul className="flex flex-col gap-2 pb-3">
                  {y.months.map((m) => (
                    <MonthCard
                      key={m.yyyymm}
                      m={m}
                      expanded={expanded === m.yyyymm}
                      onToggle={() => setExpanded((cur) => (cur === m.yyyymm ? null : m.yyyymm))}
                      dateFormat={dateFormat}
                      derived={derivedByMonth.get(m.yyyymm)}
                    />
                  ))}
                </ul>
              ))}
          </section>
        );
      })}
    </Card>
  );
}

function Delta({ m }: { m: HistoryMonth }) {
  if (m.deltaMinor === null || m.prevYyyymm === null) return null;
  const up = m.deltaMinor >= 0;
  return (
    <p className={`text-xs ${up ? 'text-income' : 'text-expense'}`}>
      {up ? '▲' : '▼'} {formatAmount(Math.abs(m.deltaMinor))} vs {monthName(m.prevYyyymm, true)}
    </p>
  );
}

function MonthCard({
  m,
  expanded,
  onToggle,
  dateFormat,
  derived,
}: {
  m: HistoryMonth;
  expanded: boolean;
  onToggle: () => void;
  dateFormat: 'dmy' | 'mdy';
  derived?: { name: string; balanceMinor: number }[];
}) {
  const b = m.snapshot.breakdown;
  // breakdown না থাকলে সেই মাসের accountBalances থেকে account-ভিত্তিক ভাঙা (derived; কিছু লেখা হয় না)
  const hasDerived = !b && !!derived && derived.length > 0;
  const expandable = !!b || hasDerived;
  const derivedOther = hasDerived ? m.snapshot.totalAssetsMinor - derived.reduce((t, a) => t + a.balanceMinor, 0) : 0;
  return (
    <li className="rounded-xl bg-surface">
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        aria-expanded={expandable ? expanded : undefined}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block font-medium text-fg">{monthName(m.yyyymm)}</span>
          <span className="block text-xs text-muted">
            updated {formatDisplayDate(m.snapshot.snapshotDate, dateFormat)}
            {!b && <span className="ml-1 whitespace-nowrap rounded bg-muted/15 px-1.5 py-0.5 text-[11px]">no ledger split</span>}
            {m.snapshot.unverified && <span className="ml-1 rounded bg-muted/15 px-1.5 py-0.5 text-[11px]">unverified</span>}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-medium text-fg">{formatAmount(m.snapshot.totalAssetsMinor)}</span>
          <Delta m={m} />
        </span>
      </button>
      {hasDerived && expanded && (
        <dl className="flex flex-col gap-1 border-t border-muted/10 px-3 py-2 text-sm">
          {derived.map((a) => (
            <Line key={a.name} label={a.name} value={a.balanceMinor} />
          ))}
          <Line label="Ledger & others" value={derivedOther} />
        </dl>
      )}
      {b && expanded && (
        <dl className="flex flex-col gap-1 border-t border-muted/10 px-3 py-2 text-sm">
          {(b.accounts ?? []).map((a) => (
            <Line key={a.name} label={a.name} value={a.balanceMinor} />
          ))}
          <Line label="Receivable" value={b.receivableMinor} />
          <Line label="Investment" value={b.investmentMinor} />
          <Line label="Home deposit" value={b.homeDepositMinor} />
          {b.gpfMinor !== 0 && <Line label="GPF" value={b.gpfMinor} />}
        </dl>
      )}
    </li>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="text-fg">{formatAmount(value)}</dd>
    </div>
  );
}

function YearTable({ months, accountOrder }: { months: HistoryMonth[]; accountOrder: string[] }) {
  const cols = accountColumns(months, accountOrder);
  const th = 'whitespace-nowrap px-2 py-1.5 text-left text-xs font-normal text-muted';
  const td = 'whitespace-nowrap px-2 py-1.5 text-xs text-fg';
  const dash = <span className="text-muted">—</span>;
  return (
    <div className="mb-3 overflow-x-auto">
      <table className="min-w-max border-collapse">
        <thead>
          <tr>
            <th className={`${th} sticky left-0 bg-canvas`}>Month</th>
            {cols.map((c) => (
              <th key={c} className={th}>{c}</th>
            ))}
            <th className={th}>Recv.</th>
            <th className={th}>Invest.</th>
            <th className={th}>Home</th>
            <th className={th}>GPF</th>
            <th className={`${th} font-medium text-fg`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const b = m.snapshot.breakdown;
            return (
              <tr key={m.yyyymm} className="border-t border-muted/10">
                <td className={`${td} sticky left-0 bg-canvas font-medium`}>{monthName(m.yyyymm, true)}</td>
                {cols.map((c) => {
                  const v = accountBalanceOf(m, c);
                  return <td key={c} className={td}>{v === null ? dash : formatAmount(v).replace('BDT ', '')}</td>;
                })}
                <td className={td}>{b ? formatAmount(b.receivableMinor).replace('BDT ', '') : dash}</td>
                <td className={td}>{b ? formatAmount(b.investmentMinor).replace('BDT ', '') : dash}</td>
                <td className={td}>{b ? formatAmount(b.homeDepositMinor).replace('BDT ', '') : dash}</td>
                <td className={td}>{b ? formatAmount(b.gpfMinor).replace('BDT ', '') : dash}</td>
                <td className={`${td} font-medium`}>{formatAmount(m.snapshot.totalAssetsMinor).replace('BDT ', '')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

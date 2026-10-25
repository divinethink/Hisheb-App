import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import Card from '../../common/Card';
import SkeletonLoader from '../../common/SkeletonLoader';
import CategoryHistorySheet from './CategoryHistorySheet';
import { useRangeTransactions } from '../../../hooks/useData';
import { getCategoryIcon } from '../../../lib/categoryIcons';
import { monthLabel } from '../../../lib/date';
import { categoryColorIndex, formatAmount, formatNet } from '../../../lib/format';
import {
  categoryList,
  monthRows,
  txsInMonth,
  txsInYear,
  yearDetailKind,
  type CategoryShare,
  type HistoricalLite,
  type TxLite,
  type YearDetailKind,
  type YearRow,
} from '../../../lib/overviewCalc';

// Overview-এর দুটো collapsible তালিকা: Yearly → "Monthly breakdown", All-Time → "Years"।
// কোনো নতুন query/schema/rule নেই — Yearly লোড-হওয়া txs থেকে derive; All-Time-এ বছর খুললে তবেই সেই বছরের
// date-range query (lazy)। ডিফল্টে সব বন্ধ; একটা খুললে আরেকটা বন্ধ হয় না। হিসাব src/lib/overviewCalc.ts-এ (pure)।

const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-8'];
const noBdt = (s: string) => s.replace('BDT ', '');
const ROW_GRID = 'grid grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,1fr))_16px] items-center gap-1';

function toggled(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function ColumnHeads({ first }: { first: string }) {
  return (
    <div aria-hidden className={`${ROW_GRID} px-4 pb-1 text-[11px] text-muted`}>
      <span>{first}</span>
      <span className="text-right">Income</span>
      <span className="text-right">Expense</span>
      <span className="text-right">Savings</span>
      <span />
    </div>
  );
}

function SummaryRow({
  label,
  tag,
  income,
  expense,
  savings,
  open,
  onToggle,
  controlsId,
}: {
  label: string;
  tag?: string;
  income: number;
  expense: number;
  savings: number;
  open: boolean;
  onToggle: () => void;
  controlsId: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onToggle}
      className={`${ROW_GRID} min-h-11 w-full border-t border-muted/10 px-4 py-1 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
    >
      <span className="min-w-0 text-sm font-medium text-fg">
        {label}
        {tag && <span className="block text-[10px] font-normal text-muted">{tag}</span>}
      </span>
      <span className="text-right text-income">{noBdt(formatAmount(income))}</span>
      <span className="text-right text-expense">{noBdt(formatAmount(expense))}</span>
      <span className={`text-right ${savings < 0 ? 'text-expense' : 'text-income'}`}>{noBdt(formatNet(savings))}</span>
      <ChevronDown aria-hidden size={16} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

function CategoryList({
  title,
  type,
  items,
  onSelect,
}: {
  title: string;
  type: 'income' | 'expense';
  items: readonly CategoryShare[];
  onSelect: (name: string, type: 'income' | 'expense') => void;
}) {
  return (
    <div className="mt-2">
      <h3 className="mb-1 text-xs text-muted">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted">None this period.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((c) => (
            <li key={c.name}>
              <button
                type="button"
                onClick={() => onSelect(c.name, type)}
                className="block min-h-11 w-full py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="flex justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="shrink-0 text-sm leading-none">{getCategoryIcon(c.name, type)}</span>
                    <span className="min-w-0 truncate text-fg">{c.name}</span>
                  </span>
                  <span className="shrink-0 text-fg">
                    {noBdt(formatAmount(c.totalMinor))} <span className="text-muted">· {Math.round(c.share * 100)}%</span>
                  </span>
                </span>
                <span className="mt-1 block h-1.5 rounded bg-muted/15" aria-hidden>
                  <span
                    className="block h-1.5 rounded"
                    style={{ width: `${Math.max(2, c.share * 100)}%`, background: `rgb(var(${CHART_VARS[categoryColorIndex(c.name, CHART_VARS.length)]}))` }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Sel {
  name: string;
  type: 'income' | 'expense';
}

/** খোলা মাস/বছরের ভেতর: Income by category + Expense by category (সব category, Others ছাড়া)। */
function DetailBody({ id, txs, children }: { id: string; txs: readonly TxLite[]; children?: ReactNode }) {
  const [sel, setSel] = useState<Sel | null>(null);
  const income = useMemo(() => categoryList(txs, 'income'), [txs]);
  const expense = useMemo(() => categoryList(txs, 'expense'), [txs]);
  return (
    <div id={id} className="border-t border-muted/10 bg-surface px-4 pb-3 pt-2">
      {children}
      <CategoryList title="Income by category" type="income" items={income} onSelect={(name, type) => setSel({ name, type })} />
      <CategoryList title="Expense by category" type="expense" items={expense} onSelect={(name, type) => setSel({ name, type })} />
      {sel && <CategoryHistorySheet name={sel.name} type={sel.type} txs={txs} onClose={() => setSel(null)} />}
    </div>
  );
}

/** Yearly ভিউ: ১২ মাস। লেনদেনহীন মাস ধূসর "No data" (ট্যাপ হয় না)। */
export function MonthlyBreakdown({ txs, year, isHist }: { txs: readonly TxLite[]; year: number; isHist: boolean }) {
  const rows = useMemo(() => monthRows(txs, year), [txs, year]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  return (
    <Card as="section" ariaLabel="Monthly breakdown" className="mx-4 mt-3 overflow-hidden pt-4">
      <h2 className="px-4 pb-1 text-sm font-medium text-fg">Monthly breakdown</h2>
      {isHist && <p className="px-4 pb-2 text-xs text-muted">Pre-app record year — months show only data recorded in the app.</p>}
      <ColumnHeads first="Month" />
      {rows.map((r) =>
        r.txCount === 0 ? (
          <div key={r.yyyymm} className={`${ROW_GRID} min-h-11 border-t border-muted/10 px-4 py-1 text-sm text-muted`}>
            <span className="min-w-0">{monthLabel(r.yyyymm).split(' ')[0]}</span>
            <span className="col-span-3 text-center text-xs">No data</span>
            <span />
          </div>
        ) : (
          <div key={r.yyyymm}>
            <SummaryRow
              label={monthLabel(r.yyyymm).split(' ')[0]}
              income={r.incomeMinor}
              expense={r.expenseMinor}
              savings={r.savingsMinor}
              open={open.has(r.yyyymm)}
              onToggle={() => setOpen((s) => toggled(s, r.yyyymm))}
              controlsId={`mb-${r.yyyymm}`}
            />
            {open.has(r.yyyymm) && <DetailBody id={`mb-${r.yyyymm}`} txs={txsInMonth(txs, r.yyyymm)} />}
          </div>
        ),
      )}
    </Card>
  );
}

function YearDetail({ id, kind, txs }: { id: string; kind: YearDetailKind; txs: readonly TxLite[] }) {
  if (kind === 'none') {
    return (
      <div id={id} className="border-t border-muted/10 bg-surface px-4 py-3 text-xs text-muted">Pre-app record — category details not available.</div>
    );
  }
  return (
    <DetailBody id={id} txs={txs}>
      {kind === 'partial' && (
        <p className="text-xs text-muted">
          <span className="mr-2 rounded-full border border-muted/40 px-2 py-0.5 text-[10px]">Partial data</span>
          Year totals come from your saved yearly record. These category lists use only entries recorded in the app, so they won’t add up to those totals.
        </p>
      )}
    </DetailBody>
  );
}

/** doc-বছর (২০২৫/২০২৪/২০২৩…): খোলার পরেই সেই বছরের লেনদেন date-range query-তে লোড (lazy)। */
function HistoricalYearDetail({ uid, year }: { uid: string; year: number }) {
  const id = `yr-${year}`;
  const tx = useRangeTransactions(uid, `${year}-01-01`, `${year}-12-31`);
  if (tx.state.status === 'loading') return <SkeletonLoader rows={3} />;
  if (tx.state.status === 'error') {
    return (
      <div role="alert" className="border-t border-muted/10 px-4 py-3 text-center text-sm text-fg">
        Couldn’t load this year.
        <button type="button" onClick={tx.retry} className="ml-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">Retry</button>
      </div>
    );
  }
  return <YearDetail id={id} kind={yearDetailKind(true, tx.state.data.length)} txs={tx.state.data} />;
}

/** All-Time ভিউ: বছরের তালিকা, নতুন → পুরনো (rows আগে থেকেই sorted)। বছরের মোট doc-precedence (C17) অনুযায়ী rows থেকে আসে। */
export function YearsCard({
  uid,
  rows,
  historical,
  liveTxs,
}: {
  uid: string;
  rows: readonly YearRow[];
  historical: readonly HistoricalLite[];
  liveTxs: readonly TxLite[];
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  if (rows.length === 0) {
    return (
      <Card as="section" className="mx-4 mt-3 p-4">
        <h2 className="mb-2 text-sm font-medium text-fg">Years</h2>
        <p className="text-sm text-muted">No data yet.</p>
      </Card>
    );
  }
  return (
    <Card as="section" ariaLabel="Years" className="mx-4 mt-3 overflow-hidden pt-4">
      <h2 className="px-4 pb-2 text-sm font-medium text-fg">Years</h2>
      <ColumnHeads first="Year" />
      {rows.map((r) => {
        const key = String(r.year);
        const isOpen = open.has(key);
        const isHist = historical.some((h) => h.year === r.year);
        return (
          <div key={key}>
            <SummaryRow
              label={key}
              tag={r.source === 'historical' ? 'Pre-app record' : undefined}
              income={r.incomeMinor}
              expense={r.expenseMinor}
              savings={r.savingsMinor}
              open={isOpen}
              onToggle={() => setOpen((s) => toggled(s, key))}
              controlsId={`yr-${key}`}
            />
            {isOpen &&
              (isHist ? (
                <HistoricalYearDetail uid={uid} year={r.year} />
              ) : (
                <LiveYearDetail year={r.year} txs={txsInYear(liveTxs, r.year)} />
              ))}
          </div>
        );
      })}
    </Card>
  );
}

function LiveYearDetail({ year, txs }: { year: number; txs: readonly TxLite[] }) {
  return <YearDetail id={`yr-${year}`} kind={yearDetailKind(false, txs.length)} txs={txs} />;
}

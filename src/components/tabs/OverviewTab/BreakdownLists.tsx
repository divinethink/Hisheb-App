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
  flowByMonth,
  monthRows,
  resolveYear,
  txsInMonth,
  txsInYear,
  yearDetailKind,
  type CategoryShare,
  type HistoricalLite,
  type MonthFlow,
  type TxLite,
  type YearDetailKind,
  type YearRow,
} from '../../../lib/overviewCalc';

// Overview-এর দুটো collapsible তালিকা: Yearly → "বছরভিত্তিক হিসাব", All-Time → "বছরভিত্তিক হিসাব"।
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

function ColumnHeads({ first, indent = false }: { first: string; indent?: boolean }) {
  return (
    <div aria-hidden className={`${ROW_GRID} ${indent ? 'pl-7 pr-4' : 'px-4'} pb-1 pt-2 text-[11px] text-muted`}>
      <span>{first}</span>
      <span className="text-right">আয়</span>
      <span className="text-right">খরচ</span>
      <span className="text-right">সঞ্চয়</span>
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
  indent = false,
}: {
  indent?: boolean;
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
      className={`${ROW_GRID} min-h-11 w-full border-t border-muted/10 ${indent ? 'pl-7 pr-4' : 'px-4'} py-1 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
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
        <p className="text-xs text-muted">এই সময়ে কিছু নেই।</p>
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

/** খোলা মাস/বছরের ভেতর: খাতভিত্তিক আয় + খাতভিত্তিক খরচ (সব category, Others ছাড়া)। */
function DetailBody({ id, txs, children }: { id: string; txs: readonly TxLite[]; children?: ReactNode }) {
  const [sel, setSel] = useState<Sel | null>(null);
  const income = useMemo(() => categoryList(txs, 'income'), [txs]);
  const expense = useMemo(() => categoryList(txs, 'expense'), [txs]);
  return (
    <div id={id} className="border-t border-muted/10 bg-surface px-4 pb-3 pt-2">
      {children}
      <CategoryList title="খাতভিত্তিক আয়" type="income" items={income} onSelect={(name, type) => setSel({ name, type })} />
      <CategoryList title="খাতভিত্তিক খরচ" type="expense" items={expense} onSelect={(name, type) => setSel({ name, type })} />
      {sel && <CategoryHistorySheet name={sel.name} type={sel.type} txs={txs} onClose={() => setSel(null)} />}
    </div>
  );
}

/** একটা বছরের ১২ মাস (collapsible) — বছর খুললে তবেই তার লেনদেন date-range query-তে লোড (lazy)।
 *  লেনদেন ও record দুটোই নেই এমন মাস ধূসর "No data" (ট্যাপ হয় না)। flow থাকা (pre-app) মাসের আয়/ব্যয় সংরক্ষিত Excel-record থেকে;
 *  খাতওয়ারি তালিকা শুধু লাইভ লেনদেন থেকে। */
function YearMonths({
  uid,
  year,
  isHist,
  snapshots,
}: {
  uid: string;
  year: number;
  isHist: boolean;
  snapshots: readonly { yyyymm: string; flow?: MonthFlow }[] | null;
}) {
  const tx = useRangeTransactions(uid, `${year}-01-01`, `${year}-12-31`);
  const txs = useMemo<readonly TxLite[]>(() => (tx.state.status === 'ready' ? tx.state.data : []), [tx.state]);
  const flow = useMemo<ReadonlyMap<string, MonthFlow>>(
    () => (isHist && snapshots ? flowByMonth(snapshots, year) : new Map<string, MonthFlow>()),
    [isHist, snapshots, year],
  );
  const rows = useMemo(() => monthRows(txs, year, flow), [txs, year, flow]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  if (tx.state.status === 'loading') return <SkeletonLoader rows={3} />;
  if (tx.state.status === 'error') {
    return (
      <div role="alert" className="border-t border-muted/10 px-4 py-3 text-center text-sm text-fg">
        এই বছরের ডেটা লোড করা যায়নি।
        <button type="button" onClick={tx.retry} className="ml-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">আবার চেষ্টা করুন</button>
      </div>
    );
  }
  if (txs.length === 0 && flow.size === 0) {
    return <div className="border-t border-muted/10 bg-surface px-4 py-3 text-xs text-muted">অ্যাপ-পূর্ব রেকর্ড — মাসভিত্তিক বিস্তারিত নেই।</div>;
  }
  return (
    <div className="border-t border-muted/10 bg-surface/50">
      {isHist && <p className="px-4 pt-2 text-xs text-muted">বছরের মোট আপনার সংরক্ষিত বার্ষিক রেকর্ড থেকে। সংরক্ষিত অঙ্ক নেই এমন মাসে শুধু অ্যাপে এন্ট্রি-করা ডেটা দেখাবে।</p>}
      <ColumnHeads first="মাস" indent />
      {rows.map((r) => {
        const label = monthLabel(r.yyyymm).split(' ')[0];
        if (r.txCount === 0 && !r.fromRecord) {
          return (
            <div key={r.yyyymm} className={`${ROW_GRID} min-h-11 border-t border-muted/10 pl-7 pr-4 py-1 text-sm text-muted`}>
              <span className="min-w-0">{label}</span>
              <span className="col-span-3 text-center text-xs">ডেটা নেই</span>
              <span />
            </div>
          );
        }
        const isOpen = open.has(r.yyyymm);
        const id = `mb-${r.yyyymm}`;
        return (
          <div key={r.yyyymm}>
            <SummaryRow
              indent
              label={label}
              tag={r.fromRecord && r.txCount === 0 ? 'অ্যাপ-পূর্ব রেকর্ড' : undefined}
              income={r.incomeMinor}
              expense={r.expenseMinor}
              savings={r.savingsMinor}
              open={isOpen}
              onToggle={() => setOpen((st) => toggled(st, r.yyyymm))}
              controlsId={id}
            />
            {isOpen &&
              (r.txCount === 0 ? (
                <div id={id} className="border-t border-muted/10 bg-surface px-4 py-3 text-xs text-muted">অ্যাপ-পূর্ব রেকর্ড — খাতভিত্তিক বিস্তারিত নেই।</div>
              ) : (
                <DetailBody id={id} txs={txsInMonth(txs, r.yyyymm)}>
                  {r.fromRecord && (
                    <p className="text-xs text-muted">
                      <span className="mr-2 rounded-full border border-muted/40 px-2 py-0.5 text-[10px]">আংশিক ডেটা</span>
                      মাসের মোট সংরক্ষিত রেকর্ড থেকে। খাতভিত্তিক তালিকায় শুধু অ্যাপে এন্ট্রি-করা ডেটা আছে, তাই এগুলোর যোগফল ওই মোটের সাথে নাও মিলতে পারে।
                    </p>
                  )}
                </DetailBody>
              ))}
          </div>
        );
      })}
    </div>
  );
}

interface YearBlockProps {
  uid: string;
  year: number;
  isHist: boolean;
  snapshots: readonly { yyyymm: string; flow?: MonthFlow }[] | null;
  open: boolean;
  onToggle: () => void;
}

/** row == null → লোড হচ্ছে। doc-বছরের মোট doc থেকে (C17), নইলে লাইভ লেনদেন থেকে। */
function YearBlock({ row, ...p }: YearBlockProps & { row: YearRow | null }) {
  const plain = `${ROW_GRID} min-h-11 border-t border-muted/10 px-4 py-1 text-sm text-muted`;
  if (!row) {
    return (
      <div className={plain}>
        <span>{p.year}</span>
        <span className="col-span-3 text-center text-xs">…</span>
        <span />
      </div>
    );
  }
  if (!p.isHist && row.incomeMinor === 0 && row.expenseMinor === 0) {
    return (
      <div className={plain}>
        <span>{p.year}</span>
        <span className="col-span-3 text-center text-xs">ডেটা নেই</span>
        <span />
      </div>
    );
  }
  const id = `yb-${p.year}`;
  return (
    <div>
      <SummaryRow
        label={String(p.year)}
        tag={p.isHist ? 'অ্যাপ-পূর্ব রেকর্ড' : undefined}
        income={row.incomeMinor}
        expense={row.expenseMinor}
        savings={row.savingsMinor}
        open={p.open}
        onToggle={p.onToggle}
        controlsId={id}
      />
      {p.open && (
        <div id={id}>
          <YearMonths uid={p.uid} year={p.year} isHist={p.isHist} snapshots={p.snapshots} />
        </div>
      )}
    </div>
  );
}

function HistYearItem({ historical, ...p }: YearBlockProps & { historical: readonly HistoricalLite[] }) {
  return <YearBlock {...p} row={resolveYear(p.year, historical, [])} />;
}

function LiveYearItem({ historical, ...p }: YearBlockProps & { historical: readonly HistoricalLite[] }) {
  const tx = useRangeTransactions(p.uid, `${p.year}-01-01`, `${p.year}-12-31`);
  return <YearBlock {...p} row={tx.state.status === 'ready' ? resolveYear(p.year, historical, tx.state.data) : null} />;
}

/** Yearly ভিউয়ের নিচে: সব বছর (নতুন → পুরনো), ডিফল্টে সব বন্ধ। বছর ট্যাপ → ১২ মাস → মাস ট্যাপ → খাতওয়ারি। */
export function YearlyBreakdown({
  uid,
  historical,
  thisYear,
  snapshots,
}: {
  uid: string;
  historical: readonly HistoricalLite[];
  thisYear: number;
  snapshots: readonly { yyyymm: string; flow?: MonthFlow }[] | null;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const minYear = historical.length ? Math.min(thisYear, ...historical.map((h) => h.year)) : thisYear;
  const years = Array.from({ length: thisYear - minYear + 1 }, (_, i) => thisYear - i);
  return (
    <Card as="section" ariaLabel="বছরভিত্তিক হিসাব" className="mx-4 mt-3 overflow-hidden pt-4">
      <h2 className="px-4 text-[15px] font-semibold text-fg">বছরভিত্তিক হিসাব</h2>
      <p className="px-4 pb-2 mt-0.5 text-xs text-muted">বছরে ট্যাপ করলে মাসগুলো দেখবেন।</p>
      <ColumnHeads first="বছর" />
      {years.map((y) => {
        const isHist = historical.some((h) => h.year === y);
        const props = { uid, year: y, isHist, snapshots, historical, open: open.has(String(y)), onToggle: () => setOpen((s) => toggled(s, String(y))) };
        return isHist ? <HistYearItem key={y} {...props} /> : <LiveYearItem key={y} {...props} />;
      })}
    </Card>
  );
}

function YearDetail({ id, kind, txs }: { id: string; kind: YearDetailKind; txs: readonly TxLite[] }) {
  if (kind === 'none') {
    return (
      <div id={id} className="border-t border-muted/10 bg-surface px-4 py-3 text-xs text-muted">অ্যাপ-পূর্ব রেকর্ড — খাতভিত্তিক বিস্তারিত নেই।</div>
    );
  }
  return (
    <DetailBody id={id} txs={txs}>
      {kind === 'partial' && (
        <p className="text-xs text-muted">
          <span className="mr-2 rounded-full border border-muted/40 px-2 py-0.5 text-[10px]">আংশিক ডেটা</span>
          বছরের মোট সংরক্ষিত বার্ষিক রেকর্ড থেকে। খাতভিত্তিক তালিকায় শুধু অ্যাপে এন্ট্রি-করা ডেটা আছে, তাই এগুলোর যোগফল ওই মোটের সাথে নাও মিলতে পারে।
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
        এই বছরের ডেটা লোড করা যায়নি।
        <button type="button" onClick={tx.retry} className="ml-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">আবার চেষ্টা করুন</button>
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
        <h2 className="mb-2 text-[15px] font-semibold text-fg">বছরভিত্তিক হিসাব</h2>
        <p className="text-sm text-muted">এখনো কোনো ডেটা নেই।</p>
      </Card>
    );
  }
  return (
    <Card as="section" ariaLabel="বছরভিত্তিক হিসাব" className="mx-4 mt-3 overflow-hidden pt-4">
      <h2 className="px-4 pb-2 text-[15px] font-semibold text-fg">বছরভিত্তিক হিসাব</h2>
      <ColumnHeads first="বছর" />
      {rows.map((r) => {
        const key = String(r.year);
        const isOpen = open.has(key);
        const isHist = historical.some((h) => h.year === r.year);
        return (
          <div key={key}>
            <SummaryRow
              label={key}
              tag={r.source === 'historical' ? 'অ্যাপ-পূর্ব রেকর্ড' : undefined}
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

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import CollapsibleSection from '../../common/CollapsibleSection';
import { SearchToggle, SearchPanel } from '../../common/ListSearch';
import DebtSheet from './DebtSheet';
import DebtDetailScreen from './DebtDetailScreen';
import { formatAmount, formatTaka } from '../../../lib/format';
import { formatDisplayDate, isOverdue } from '../../../lib/date';
import {
  isSettledByRepayment,
  latestBorrowingDate,
  lineViews,
  partitionDebtsForList,
  receivableOutstandingMinor,
} from '../../../lib/debtCalc';
import { useDebts, useSettings } from '../../../hooks/useData';
import type { Debt } from '../../../validation/debtSchema';

type DateFormat = 'dmy' | 'mdy';

type DebtFilter = 'all' | 'active' | 'doubtful';
const FILTER_CHIPS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['doubtful', 'Doubtful'],
] as const;

const DIRECTIONS = [
  ['owe_me', 'Owed to Me'],
  ['i_owe', 'I Owe'],
] as const;

// owner-request (২০২৬-১০-২৫): ২ লাইনের কমপ্যাক্ট কার্ড — অবতার, নাম+বাকি, চিপ+Total+তারিখ; শোধের progress কার্ডের নিচের পাতলা দাগ।
// শুধু presentation; সব হিসাব আগের lib/debtCalc ফাংশন থেকেই (Net Worth লজিক অপরিবর্তিত)।
function DebtRow({ d, dir, dateFormat, onOpen }: { d: Debt; dir: Debt['direction']; dateFormat: DateFormat; onOpen: () => void }) {
  const views = lineViews(d);
  const paid = views.reduce((s, v) => s + v.paidMinor, 0);
  const out = dir === 'owe_me' ? receivableOutstandingMinor(d) : views.reduce((s, v) => s + v.outstandingMinor, 0);
  const settled = isSettledByRepayment(d);
  const woCount = dir === 'owe_me' ? views.filter((v) => v.status === 'written_off').length : 0;
  const dbCount = dir === 'owe_me' ? views.filter((v) => v.status === 'doubtful').length : 0;
  const pct = d.totalAmountMinor > 0 ? Math.min(100, Math.round((paid / d.totalAmountMinor) * 100)) : 0;
  // মেয়াদ পেরোনো + বাকি আছে → তারিখ লাল (owner-approved ২০২৬-১০-২৫)
  const overdue = out > 0 && isOverdue(d.expectedRepaymentDate);

  const chip = settled
    ? { text: 'Fully paid', cls: 'bg-income/10 text-income' }
    : woCount > 0
      ? { text: `Written-off ${woCount}`, cls: 'bg-expense/10 text-expense' }
      : dbCount > 0
        ? { text: `Doubtful ${dbCount}`, cls: 'bg-warning/10 text-warning' }
        : paid > 0
          ? { text: 'Partly paid', cls: 'bg-primary/10 text-primary' }
          : { text: 'Outstanding', cls: 'bg-muted/10 text-muted' };

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-2xl border border-muted/15 bg-surface px-3 py-2 text-left active:bg-muted/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {d.person.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-fg">{d.person}</span>
          <span className={`shrink-0 text-sm font-semibold ${settled ? 'text-muted' : 'text-fg'}`}>{formatAmount(out)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
          <span className={`shrink-0 rounded-full px-2 py-px ${chip.cls}`}>{chip.text}</span>
          <span className="truncate">
            Total {formatAmount(d.totalAmountMinor)} · {formatDisplayDate(latestBorrowingDate(d), dateFormat)}
            {overdue && d.expectedRepaymentDate && (
              <span className="text-expense"> · Due {formatDisplayDate(d.expectedRepaymentDate, dateFormat)}</span>
            )}
          </span>
        </span>
      </span>
      <ChevronRight aria-hidden size={16} className="shrink-0 text-muted" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 block h-[3px] bg-muted/15">
        <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
    </button>
  );
}

// সব লাইন written-off (এবং পুরো-শোধ নয়) → নিচের ভাঁজযোগ্য Written-off অংশে (owner-request ২০২৬-১০-২৫)
function isAllWrittenOff(d: Debt): boolean {
  const v = lineViews(d);
  return v.length > 0 && v.every((x) => x.status === 'written_off');
}
const paidOf = (list: readonly Debt[]) => list.reduce((s, d) => s + lineViews(d).reduce((a, v) => a + v.paidMinor, 0), 0);
const totalOf = (list: readonly Debt[]) => list.reduce((s, d) => s + d.totalAmountMinor, 0);

export default function DebtsScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const debts = useDebts(uid);
  const settings = useSettings(uid);
  const dateFormat: DateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  const [dir, setDir] = useState<Debt['direction']>('owe_me');
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Debt | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DebtFilter>('all');

  if (debts.state.status === 'ready' && selected) {
    // লাইভ আপডেট রিফ্লেক্ট করতে সবসময় সর্বশেষ ডেটা থেকে খুঁজে ব্যবহার
    const fresh = debts.state.data.find((d) => d.id === selected.id) ?? selected;
    return <DebtDetailScreen uid={uid} debt={fresh} onBack={() => setSelected(null)} />;
  }

  const all = debts.state.status === 'ready' ? debts.state.data : [];
  const dirList = all.filter((d) => d.direction === dir);
  // সার্চ/ফিল্টার শুধু তালিকা ছাঁকে; Total কার্ড দিকের পুরো তালিকা থেকেই (হিসাব অপরিবর্তিত)
  const q = query.trim().toLowerCase();
  const searching = searchOpen && (q !== '' || filter !== 'all');
  const list = !searching
    ? dirList
    : dirList.filter((d) => {
        if (q && !d.person.toLowerCase().includes(q)) return false;
        if (filter === 'all') return true;
        return lineViews(d).some((v) => v.status === filter && v.outstandingMinor > 0);
      });
  const countOf = (k: Debt['direction']) => all.filter((d) => d.direction === k).length;
  // ক্রম: বাকি/written-off ওপরে, পুরো-শোধ নিচে; দুই দলেই সর্বশেষ ধারের তারিখে নতুন আগে (lib/debtCalc)
  const { open: openAll, settled } = partitionDebtsForList(list);
  const writtenOff = dir === 'owe_me' ? openAll.filter(isAllWrittenOff) : [];
  const open = openAll.filter((d) => !writtenOff.includes(d));
  // owe_me: Total = Active + Doubtful + Written-off (বাকি অংশের যোগফল); নিচে তিনটা আলাদা (owner-request ২০২৬-১০-২৫)।
  // Net Worth-এ যায় শুধু Active + Doubtful (receivableOutstandingMinor অপরিবর্তিত)।
  const byStatus = { active: 0, doubtful: 0, written_off: 0 };
  if (dir === 'owe_me') {
    for (const d of dirList) for (const v of lineViews(d)) byStatus[v.status] += v.outstandingMinor;
  }
  const totalOutstanding =
    dir === 'owe_me'
      ? byStatus.active + byStatus.doubtful + byStatus.written_off
      : dirList.reduce((s, d) => s + lineViews(d).reduce((a, v) => a + v.outstandingMinor, 0), 0);

  const footer =
    debts.state.status === 'ready' ? (
      <button type="button" onClick={() => setAddOpen(true)} className="min-h-12 flex-1 rounded-xl bg-primary text-sm font-medium text-canvas">
        + Add New
      </button>
    ) : undefined;

  const row = (d: Debt) => <DebtRow key={d.id} d={d} dir={dir} dateFormat={dateFormat} onOpen={() => setSelected(d)} />;

  return (
    <FullScreenPage
      title="Debts & Receivables"
      onBack={onBack}
      footer={footer}
      actions={<SearchToggle open={searchOpen} onToggle={() => setSearchOpen((o) => !o)} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex rounded-xl bg-surface p-1">
          {DIRECTIONS.map(([d, label]) => (
            <button
              key={d}
              type="button"
              onClick={() => setDir(d)}
              aria-pressed={dir === d}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm transition-colors ${
                dir === d ? 'bg-canvas font-medium text-primary shadow-sm' : 'text-muted'
              }`}
            >
              {label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${dir === d ? 'bg-primary/10' : 'bg-muted/10'}`}>{countOf(d)}</span>
            </button>
          ))}
        </div>

        {searchOpen && (
          <SearchPanel query={query} onQuery={setQuery} placeholder="Search name" chips={FILTER_CHIPS} active={filter} onChip={setFilter} />
        )}

        {debts.state.status === 'loading' && <SkeletonLoader />}

        {debts.state.status === 'error' && (
          <div role="alert" className="rounded-lg bg-surface p-4 text-center">
            <p className="text-sm text-fg">Couldn’t load entries.</p>
            <button type="button" onClick={debts.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
              Retry
            </button>
          </div>
        )}

        {debts.state.status === 'ready' && (
          <>
            <div className="rounded-2xl bg-primary/10 px-4 py-3">
              <p className="text-xs text-muted">{dir === 'owe_me' ? 'Total to receive' : 'Total I owe'}</p>
              <p className="mt-1 text-2xl font-semibold text-fg">{formatAmount(totalOutstanding)}</p>
              {dir === 'owe_me' && (
                <p className="mt-1 flex justify-between gap-2 whitespace-nowrap text-[11px] text-muted">
                  <span>
                    Active <span className="text-fg">{formatTaka(byStatus.active)}</span>
                  </span>
                  <span>
                    Doubtful <span className="text-warning">{formatTaka(byStatus.doubtful)}</span>
                  </span>
                  <span>
                    Written-off <span className="text-expense">{formatTaka(byStatus.written_off)}</span>
                  </span>
                </p>
              )}
            </div>

            {list.length === 0 ? (
              <p className="py-10 text-center text-muted">{searching ? 'No match.' : 'No entries yet.'}</p>
            ) : (
              <>
                {open.length > 0 && <div className="flex flex-col gap-2">{open.map(row)}</div>}
                {settled.length > 0 && (
                  <CollapsibleSection key={`s${searching}`} title="Fully repaid" count={settled.length} summary={`Repaid ${formatTaka(paidOf(settled))}`} defaultOpen>
                    {settled.map(row)}
                  </CollapsibleSection>
                )}
                {writtenOff.length > 0 && (
                  <CollapsibleSection key={`w${searching}`} title="Written-off" count={writtenOff.length} summary={`Repaid ${formatTaka(paidOf(writtenOff))} · Total ${formatTaka(totalOf(writtenOff))}`} defaultOpen={searching}>
                    {writtenOff.map(row)}
                  </CollapsibleSection>
                )}
              </>
            )}
          </>
        )}
      </div>

      {addOpen && <DebtSheet uid={uid} initial={null} onClose={() => setAddOpen(false)} />}
    </FullScreenPage>
  );
}

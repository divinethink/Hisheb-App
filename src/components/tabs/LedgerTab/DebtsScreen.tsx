import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import CollapsibleSection from '../../common/CollapsibleSection';
import DebtSheet from './DebtSheet';
import DebtDetailScreen from './DebtDetailScreen';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
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

const DIRECTIONS = [
  ['owe_me', 'Owed to Me'],
  ['i_owe', 'I Owe'],
] as const;

// owner-request (২০২৬-১০-২৫): কার্ড-স্টাইল সারি — অবতার (নামের প্রথম অক্ষর), রঙিন স্ট্যাটাস-চিপ, শোধের progress-bar,
// সর্বশেষ ধারের তারিখ। শুধু presentation; সব হিসাব আগের lib/debtCalc ফাংশন থেকেই (Net Worth লজিক অপরিবর্তিত)।
function DebtRow({ d, dir, dateFormat, onOpen }: { d: Debt; dir: Debt['direction']; dateFormat: DateFormat; onOpen: () => void }) {
  const views = lineViews(d);
  const paid = views.reduce((s, v) => s + v.paidMinor, 0);
  const out = dir === 'owe_me' ? receivableOutstandingMinor(d) : views.reduce((s, v) => s + v.outstandingMinor, 0);
  const settled = isSettledByRepayment(d);
  const woCount = dir === 'owe_me' ? views.filter((v) => v.status === 'written_off').length : 0;
  const dbCount = dir === 'owe_me' ? views.filter((v) => v.status === 'doubtful').length : 0;
  const pct = d.totalAmountMinor > 0 ? Math.min(100, Math.round((paid / d.totalAmountMinor) * 100)) : 0;

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
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-muted/15 bg-surface p-3 text-left active:bg-muted/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary"
      >
        {d.person.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-fg">{d.person}</span>
          <span className={`shrink-0 font-semibold ${settled ? 'text-muted' : 'text-fg'}`}>{formatAmount(out)}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className={`rounded-full px-2 py-0.5 ${chip.cls}`}>{chip.text}</span>
          <span>Total {formatAmount(d.totalAmountMinor)}</span>
          <span>· {formatDisplayDate(latestBorrowingDate(d), dateFormat)}</span>
        </span>
        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </span>
      </span>
      <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
    </button>
  );
}

export default function DebtsScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const debts = useDebts(uid);
  const settings = useSettings(uid);
  const dateFormat: DateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  const [dir, setDir] = useState<Debt['direction']>('owe_me');
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Debt | null>(null);

  if (debts.state.status === 'ready' && selected) {
    // লাইভ আপডেট রিফ্লেক্ট করতে সবসময় সর্বশেষ ডেটা থেকে খুঁজে ব্যবহার
    const fresh = debts.state.data.find((d) => d.id === selected.id) ?? selected;
    return <DebtDetailScreen uid={uid} debt={fresh} onBack={() => setSelected(null)} />;
  }

  const all = debts.state.status === 'ready' ? debts.state.data : [];
  const list = all.filter((d) => d.direction === dir);
  const countOf = (k: Debt['direction']) => all.filter((d) => d.direction === k).length;
  // ক্রম: বাকি/written-off ওপরে, পুরো-শোধ নিচে; দুই দলেই সর্বশেষ ধারের তারিখে নতুন আগে (lib/debtCalc)
  const { open, settled } = partitionDebtsForList(list);
  const totalOutstanding =
    dir === 'owe_me'
      ? list.reduce((s, d) => s + receivableOutstandingMinor(d), 0) // written-off লাইন বাদ
      : list.reduce((s, d) => s + lineViews(d).reduce((a, v) => a + v.outstandingMinor, 0), 0);

  const footer =
    debts.state.status === 'ready' ? (
      <button type="button" onClick={() => setAddOpen(true)} className="min-h-12 flex-1 rounded-xl bg-primary text-sm font-medium text-canvas">
        + Add New
      </button>
    ) : undefined;

  const row = (d: Debt) => <DebtRow key={d.id} d={d} dir={dir} dateFormat={dateFormat} onOpen={() => setSelected(d)} />;

  return (
    <FullScreenPage title="Debts & Receivables" onBack={onBack} footer={footer}>
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
            <div className="rounded-2xl bg-primary/10 p-4">
              <p className="text-xs text-muted">{dir === 'owe_me' ? 'Total to receive (Net Worth)' : 'Total I owe'}</p>
              <p className="mt-1 text-2xl font-semibold text-fg">{formatAmount(totalOutstanding)}</p>
            </div>

            {list.length === 0 ? (
              <p className="py-10 text-center text-muted">No entries yet.</p>
            ) : (
              <>
                {open.length > 0 && <div className="flex flex-col gap-2">{open.map(row)}</div>}
                {settled.length > 0 && (
                  <CollapsibleSection title="Fully repaid" count={settled.length} defaultOpen>
                    {settled.map(row)}
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

import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import DebtSheet from './DebtSheet';
import DebtDetailScreen from './DebtDetailScreen';
import { formatAmount } from '../../../lib/format';
import { outstandingMinor, repaymentStatus, REPAYMENT_STATUS_LABEL } from '../../../lib/debtCalc';
import { useDebts } from '../../../hooks/useData';
import type { Debt } from '../../../validation/debtSchema';

const RECEIVABLE_LABEL: Record<Debt['receivableStatus'], string> = {
  active: 'Active',
  doubtful: 'Doubtful',
  forgiven: 'Forgiven',
};

export default function DebtsScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const debts = useDebts(uid);
  const [dir, setDir] = useState<Debt['direction']>('owe_me');
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Debt | null>(null);

  if (debts.state.status === 'ready' && selected) {
    // লাইভ আপডেট রিফ্লেক্ট করতে সবসময় সর্বশেষ ডেটা থেকে খুঁজে ব্যবহার
    const fresh = debts.state.data.find((d) => d.id === selected.id) ?? selected;
    return <DebtDetailScreen uid={uid} debt={fresh} onBack={() => setSelected(null)} />;
  }

  const list = debts.state.status === 'ready' ? debts.state.data.filter((d) => d.direction === dir) : [];
  const totalOutstanding =
    dir === 'owe_me'
      ? list.filter((d) => d.receivableStatus !== 'forgiven').reduce((s, d) => s + outstandingMinor(d.totalAmountMinor, d.repayments), 0)
      : list.reduce((s, d) => s + outstandingMinor(d.totalAmountMinor, d.repayments), 0);

  return (
    <FullScreenPage title="Debts & Receivables" onBack={onBack}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(['owe_me', 'i_owe'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDir(d)}
              aria-pressed={dir === d}
              className={`min-h-11 flex-1 rounded-lg border text-sm ${dir === d ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`}
            >
              {d === 'owe_me' ? 'Owed to Me' : 'I Owe'}
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
            {list.length === 0 ? (
              <p className="py-10 text-center text-muted">No entries yet.</p>
            ) : (
              <ul>
                {list.map((d) => {
                  const status = repaymentStatus(d.totalAmountMinor, d.repayments);
                  const out = outstandingMinor(d.totalAmountMinor, d.repayments);
                  return (
                    <li key={d.id} className="border-b border-muted/20">
                      <button
                        type="button"
                        onClick={() => setSelected(d)}
                        className="flex min-h-16 w-full flex-col gap-0.5 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="flex items-center justify-between">
                          <span className="text-fg">{d.person}</span>
                          <span className="flex items-center gap-2">
                            {dir === 'owe_me' && (
                              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{RECEIVABLE_LABEL[d.receivableStatus]}</span>
                            )}
                            <span className="font-medium text-fg">{formatAmount(out)}</span>
                          </span>
                        </span>
                        <span className="text-xs text-muted">
                          {REPAYMENT_STATUS_LABEL[status]} (Total {formatAmount(d.totalAmountMinor)})
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="flex justify-between border-t border-muted/20 pt-3 text-sm">
              <span className="text-muted">Total Outstanding{dir === 'owe_me' ? ' (Net Worth)' : ''}</span>
              <span className="font-medium text-fg">{formatAmount(totalOutstanding)}</span>
            </p>

            <button type="button" onClick={() => setAddOpen(true)} className="min-h-11 rounded-lg bg-primary text-sm font-medium text-canvas">
              + Add New
            </button>
          </>
        )}
      </div>

      {addOpen && <DebtSheet uid={uid} initial={null} onClose={() => setAddOpen(false)} />}
    </FullScreenPage>
  );
}

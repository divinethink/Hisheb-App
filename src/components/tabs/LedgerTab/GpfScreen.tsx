import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import GpfEntrySheet from './GpfEntrySheet';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { gpfTotalsMinor } from '../../../lib/gpfCalc';
import { deleteGpfEntry } from '../../../data/gpfRepo';
import { settleOrPending } from '../../../lib/async';
import { useGpfEntries, useSettings } from '../../../hooks/useData';
import type { GpfEntry } from '../../../validation/gpfSchema';

export default function GpfScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const q = useGpfEntries(uid);
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<GpfEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loading = q.state.status === 'loading';
  const errored = q.state.status === 'error';
  const entries = q.state.status === 'ready' ? q.state.data : [];
  const t = gpfTotalsMinor(entries);

  async function removeEntry(id: string) {
    await settleOrPending(deleteGpfEntry(uid, id), 3000).catch(() => {});
    setDeleteId(null);
  }

  return (
    <FullScreenPage title="GPF" onBack={onBack}>
      <div className="flex flex-col gap-5">
        {loading && <SkeletonLoader />}

        {errored && (
          <div role="alert" className="rounded-lg bg-surface p-4 text-center">
            <p className="text-sm text-fg">Couldn’t load entries.</p>
            <button type="button" onClick={q.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
              Retry
            </button>
          </div>
        )}

        {!loading && !errored && (
          <>
            <div>
              <p className="text-sm text-muted">Current GPF Balance</p>
              <p className="text-lg font-semibold text-fg">{formatAmount(t.balance)}</p>
              <p className="mt-1 text-xs text-muted">
                Contributions {formatAmount(t.contributions)} · Interest {formatAmount(t.interest)}
                {t.withdrawals > 0 && ` · Withdrawals ${formatAmount(t.withdrawals)}`}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted">Entries</p>
              {entries.length === 0 ? (
                <p className="text-sm text-muted">No entries yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between border-b border-muted/20 py-2">
                      <span className="flex flex-col">
                        <span className="text-sm text-fg">
                          {formatDisplayDate(e.date, dateFormat)} <span className="text-xs capitalize text-muted">· {e.type}</span>
                        </span>
                        {(e.note || e.accountingMonth) && <span className="text-xs text-muted">{e.note || e.accountingMonth}</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className={e.type === 'withdrawal' ? 'text-expense' : 'text-fg'}>
                          {e.type === 'withdrawal' ? '−' : ''}
                          {formatAmount(e.amountMinor)}
                        </span>
                        {deleteId === e.id ? (
                          <span className="flex items-center gap-1">
                            <button type="button" onClick={() => void removeEntry(e.id)} className="min-h-8 rounded border border-expense px-2 text-xs text-expense">
                              Delete
                            </button>
                            <button type="button" onClick={() => setDeleteId(null)} className="min-h-8 rounded border border-muted/40 px-2 text-xs text-muted">
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <button type="button" aria-label="Edit entry" onClick={() => setEditEntry(e)} className="flex h-8 w-8 items-center justify-center text-muted">
                              <Pencil aria-hidden size={16} />
                            </button>
                            <button type="button" aria-label="Delete entry" onClick={() => setDeleteId(e.id)} className="flex h-8 w-8 items-center justify-center text-muted">
                              <X aria-hidden size={16} />
                            </button>
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="button" onClick={() => setAddOpen(true)} className="min-h-11 rounded-lg bg-primary text-sm font-medium text-canvas">
              + Add Entry
            </button>
          </>
        )}
      </div>

      {addOpen && <GpfEntrySheet uid={uid} onClose={() => setAddOpen(false)} />}
      {editEntry && <GpfEntrySheet uid={uid} editing={editEntry} onClose={() => setEditEntry(null)} />}
    </FullScreenPage>
  );
}

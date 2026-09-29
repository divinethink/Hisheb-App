import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import HomeDepositEntrySheet from './HomeDepositEntrySheet';
import FundSheet from './FundSheet';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { useSettings } from '../../../hooks/useData';
import { netBalanceMinor } from '../../../lib/homeDepositCalc';
import { deleteHomeDeposit } from '../../../data/homeDepositRepo';
import { settleOrPending } from '../../../lib/async';
import type { Fund, HomeDepositEntry } from '../../../validation/homeDepositSchema';

export default function FundDetailScreen({
  uid,
  fund,
  entries,
  onBack,
}: {
  uid: string;
  fund: Fund;
  entries: HomeDepositEntry[];
  onBack: () => void;
}) {
  const [addType, setAddType] = useState<'deposit' | 'withdrawal' | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<HomeDepositEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  const net = netBalanceMinor(entries);

  async function removeEntry(id: string) {
    await settleOrPending(deleteHomeDeposit(uid, id), 3000).catch(() => {});
    setDeleteId(null);
  }

  if (editOpen) return <FundSheet uid={uid} initial={fund} onClose={() => setEditOpen(false)} />;

  return (
    <FullScreenPage title={fund.name} onBack={onBack}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Current Net Balance</p>
            <p className="text-lg font-semibold text-fg">{formatAmount(net)}</p>
          </div>
          <button type="button" onClick={() => setEditOpen(true)} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm">
            Edit
          </button>
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
                    <span className="text-sm text-fg">{formatDisplayDate(e.date, dateFormat)}</span>
                    {e.note && <span className="text-xs text-muted">{e.note}</span>}
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

        <div className="flex gap-2">
          <button type="button" onClick={() => setAddType('deposit')} className="min-h-11 flex-1 rounded-lg border border-dashed border-muted/60 text-sm text-muted">
            + Add Deposit
          </button>
          <button type="button" onClick={() => setAddType('withdrawal')} className="min-h-11 flex-1 rounded-lg border border-dashed border-muted/60 text-sm text-muted">
            + Add Withdrawal
          </button>
        </div>
      </div>

      {addType && (
        <HomeDepositEntrySheet uid={uid} fundId={fund.id} initialType={addType} onClose={() => setAddType(null)} />
      )}
      {editEntry && (
        <HomeDepositEntrySheet uid={uid} fundId={fund.id} editing={editEntry} onClose={() => setEditEntry(null)} />
      )}
    </FullScreenPage>
  );
}

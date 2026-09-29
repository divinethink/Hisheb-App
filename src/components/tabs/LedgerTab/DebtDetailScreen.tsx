import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import RepaymentSheet from './RepaymentSheet';
import BorrowingSheet from './BorrowingSheet';
import DebtSheet from './DebtSheet';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { useSettings } from '../../../hooks/useData';
import { outstandingMinor, repaymentStatus, sumRepayments, REPAYMENT_STATUS_LABEL } from '../../../lib/debtCalc';
import { setReceivableStatus, setRepayments, setBorrowings, updateDebt } from '../../../data/debtRepo';
import { settleOrPending } from '../../../lib/async';
import { ReceivableStatusSchema, type Debt } from '../../../validation/debtSchema';
import type { z } from 'zod';

type ReceivableStatus = z.infer<typeof ReceivableStatusSchema>;
const STATUS_OPTIONS: readonly ReceivableStatus[] = ['active', 'doubtful', 'forgiven'];
const STATUS_LABEL: Record<ReceivableStatus, string> = { active: 'Active', doubtful: 'Doubtful', forgiven: 'Forgiven' };

export default function DebtDetailScreen({ uid, debt, onBack }: { uid: string; debt: Debt; onBack: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [editRepaymentIdx, setEditRepaymentIdx] = useState<number | null>(null);
  const [addBorrowOpen, setAddBorrowOpen] = useState(false);
  const [deleteBorrowIdx, setDeleteBorrowIdx] = useState<number | null>(null);
  const [editBorrowIdx, setEditBorrowIdx] = useState<number | null>(null);
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  const status = repaymentStatus(debt.totalAmountMinor, debt.repayments);
  const outstanding = outstandingMinor(debt.totalAmountMinor, debt.repayments);

  async function removeRepayment(idx: number) {
    const next = debt.repayments.filter((_, i) => i !== idx);
    await settleOrPending(setRepayments(uid, debt.id, next), 3000).catch(() => {});
    setDeleteIdx(null);
  }

  // অন্তত একটা borrowing থাকা বাধ্যতামূলক — নাহলে totalAmountMinor 0 হয়ে rules-এর posInt() reject করবে
  async function removeBorrowing(idx: number) {
    if (debt.borrowings.length <= 1) {
      setDeleteBorrowIdx(null);
      return;
    }
    const next = debt.borrowings.filter((_, i) => i !== idx);
    await settleOrPending(setBorrowings(uid, debt.id, next), 3000).catch(() => {});
    setDeleteBorrowIdx(null);
  }

  if (editOpen) return <DebtSheet uid={uid} initial={debt} onClose={() => setEditOpen(false)} />;

  return (
    <FullScreenPage title={debt.person} onBack={onBack}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Total</p>
            <p className="text-lg font-semibold text-fg">{formatAmount(debt.totalAmountMinor)}</p>
          </div>
          <button type="button" onClick={() => setEditOpen(true)} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm">
            Edit
          </button>
        </div>

        <p className="text-sm text-muted">
          Repayment Status: <span className="text-fg">{REPAYMENT_STATUS_LABEL[status]}</span>
        </p>

        {debt.direction === 'owe_me' && (
          <div>
            <p className="mb-1 text-sm text-muted">Receivable Status</p>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void setReceivableStatus(uid, debt.id, s)}
                  aria-pressed={debt.receivableStatus === s}
                  className={`min-h-11 flex-1 rounded-lg border text-sm ${debt.receivableStatus === s ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="exp-date" className="mb-1 block text-sm text-muted">
            Expected Repayment Date (optional)
          </label>
          <input
            id="exp-date"
            type="date"
            lang="en-GB"
            value={debt.expectedRepaymentDate ?? ''}
            onChange={(e) => void updateDebt(uid, debt.id, { expectedRepaymentDate: e.target.value || null })}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-muted">Borrowing History</p>
          <ul className="flex flex-col gap-1">
            {debt.borrowings.map((b, i) => (
              <li key={`${b.date}-${i}`} className="flex items-center justify-between border-b border-muted/20 py-2">
                <span className="flex flex-col text-sm text-fg">
                  {formatDisplayDate(b.date, dateFormat)}
                  {b.note && <span className="text-xs text-muted">{b.note}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-fg">{formatAmount(b.amountMinor)}</span>
                  {deleteBorrowIdx === i ? (
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => void removeBorrowing(i)} className="min-h-8 rounded border border-expense px-2 text-xs text-expense">
                        Delete
                      </button>
                      <button type="button" onClick={() => setDeleteBorrowIdx(null)} className="min-h-8 rounded border border-muted/40 px-2 text-xs text-muted">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label="Edit borrowing" onClick={() => setEditBorrowIdx(i)} className="flex h-8 w-8 items-center justify-center text-muted">
                        <Pencil aria-hidden size={16} />
                      </button>
                      {debt.borrowings.length > 1 && (
                        <button type="button" aria-label="Delete borrowing" onClick={() => setDeleteBorrowIdx(i)} className="flex h-8 w-8 items-center justify-center text-muted">
                          <X aria-hidden size={16} />
                        </button>
                      )}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setAddBorrowOpen(true)} className="mt-2 min-h-11 w-full rounded-lg border border-dashed border-muted/60 text-sm text-muted">
            + Add Borrowing
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted">Repayment History</p>
          {debt.repayments.length === 0 ? (
            <p className="text-sm text-muted">No repayments yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {debt.repayments.map((r, i) => (
                <li key={`${r.date}-${i}`} className="flex items-center justify-between border-b border-muted/20 py-2">
                  <span className="flex flex-col text-sm text-fg">
                    {formatDisplayDate(r.date, dateFormat)}
                    {r.note && <span className="text-xs text-muted">{r.note}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-fg">{formatAmount(r.amountMinor)}</span>
                    {deleteIdx === i ? (
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => void removeRepayment(i)} className="min-h-8 rounded border border-expense px-2 text-xs text-expense">
                          Delete
                        </button>
                        <button type="button" onClick={() => setDeleteIdx(null)} className="min-h-8 rounded border border-muted/40 px-2 text-xs text-muted">
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <button type="button" aria-label="Edit repayment" onClick={() => setEditRepaymentIdx(i)} className="flex h-8 w-8 items-center justify-center text-muted">
                          <Pencil aria-hidden size={16} />
                        </button>
                        <button type="button" aria-label="Delete repayment" onClick={() => setDeleteIdx(i)} className="flex h-8 w-8 items-center justify-center text-muted">
                          <X aria-hidden size={16} />
                        </button>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex justify-between text-sm">
            <span className="text-muted">Outstanding</span>
            <span className="font-medium text-fg">{formatAmount(outstanding)}</span>
          </p>
          {sumRepayments(debt.repayments) > debt.totalAmountMinor && (
            <p className="mt-1 text-sm text-muted">Total paid exceeds the original amount — please confirm.</p>
          )}
        </div>

        <button type="button" onClick={() => setAddOpen(true)} className="min-h-11 rounded-lg border border-dashed border-muted/60 text-sm text-muted">
          + Add Repayment
        </button>
      </div>

      {addOpen && <RepaymentSheet uid={uid} debt={debt} onClose={() => setAddOpen(false)} />}
      {editRepaymentIdx !== null && (
        <RepaymentSheet uid={uid} debt={debt} editIndex={editRepaymentIdx} onClose={() => setEditRepaymentIdx(null)} />
      )}
      {addBorrowOpen && <BorrowingSheet uid={uid} debt={debt} onClose={() => setAddBorrowOpen(false)} />}
      {editBorrowIdx !== null && (
        <BorrowingSheet uid={uid} debt={debt} editIndex={editBorrowIdx} onClose={() => setEditBorrowIdx(null)} />
      )}
    </FullScreenPage>
  );
}

import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import RepaymentSheet from './RepaymentSheet';
import BorrowingSheet from './BorrowingSheet';
import DebtSheet from './DebtSheet';
import BorrowingActionSheet, { LINE_STATUS_LABEL } from './BorrowingActionSheet';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate, toDhakaDate } from '../../../lib/date';
import { useSettings } from '../../../hooks/useData';
import { lineViews, repaymentStatus, sumRepayments, REPAYMENT_STATUS_LABEL, type LineView } from '../../../lib/debtCalc';
import { setRepayments, setBorrowings, updateDebt } from '../../../data/debtRepo';
import { settleOrPending } from '../../../lib/async';
import type { Debt } from '../../../validation/debtSchema';

export default function DebtDetailScreen({ uid, debt, onBack }: { uid: string; debt: Debt; onBack: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [editRepaymentIdx, setEditRepaymentIdx] = useState<number | null>(null);
  const [addBorrowOpen, setAddBorrowOpen] = useState(false);
  const [deleteBorrowIdx, setDeleteBorrowIdx] = useState<number | null>(null);
  const [editBorrowIdx, setEditBorrowIdx] = useState<number | null>(null);
  const [actionIdx, setActionIdx] = useState<number | null>(null);
  const [repayPreset, setRepayPreset] = useState<string | undefined>(undefined);
  // এক-ট্যাপ "Mark fully repaid": প্রথম ট্যাপে নিশ্চিতকরণ (ভুল ট্যাপ ঠেকাতে), দ্বিতীয় ট্যাপে সেভ; busy গার্ড = double-tap-এ duplicate নয়
  const [confirmRepaidIdx, setConfirmRepaidIdx] = useState<number | null>(null);
  const [repaying, setRepaying] = useState(false);
  const [repayError, setRepayError] = useState('');
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  const status = repaymentStatus(debt.totalAmountMinor, debt.repayments);
  const views = lineViews(debt);
  const owe = debt.direction === 'owe_me';
  const outstanding = views.reduce((s, v) => s + v.outstandingMinor, 0);
  const writtenOff = views.filter((v) => v.excluded).reduce((s, v) => s + v.outstandingMinor, 0);
  const statusSummary = (['doubtful', 'written_off'] as const)
    .map((k) => [k, views.filter((v) => v.status === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${LINE_STATUS_LABEL[k]} ${n}`)
    .join(' · ');

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

  async function markRepaid(v: LineView) {
    if (repaying || v.outstandingMinor <= 0) return;
    setRepaying(true);
    setRepayError('');
    try {
      const link = v.line.id ? { borrowingId: v.line.id } : {};
      await settleOrPending(
        setRepayments(uid, debt.id, [
          ...debt.repayments,
          { date: toDhakaDate(new Date()), amountMinor: v.outstandingMinor, note: '', ...link },
        ]),
        3000,
      );
      setConfirmRepaidIdx(null);
    } catch {
      setRepayError('Could not save. Check your connection and try again.');
    } finally {
      setRepaying(false);
    }
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

        {owe && (
          <p className="text-sm text-muted">
            Receivable: <span className="text-fg">{statusSummary || 'All Active'}</span>
          </p>
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
            {debt.borrowings.map((b, i) => {
              const v = views[i];
              return (
              <li key={`${b.id ?? b.date}-${i}`} className="border-b border-muted/20 py-2">
              <div className="flex items-center justify-between">
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
              </div>
              {v && (
                <div className={`mt-1 flex flex-col gap-2 px-1 ${v.excluded ? 'opacity-80' : ''}`}>
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-surface px-2 py-0.5 text-muted">{REPAYMENT_STATUS_LABEL[v.payStatus]}</span>
                    {owe && v.status !== 'active' && (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-expense">{LINE_STATUS_LABEL[v.status]}</span>
                    )}
                    <span className="text-muted">
                      {formatAmount(v.paidMinor)} / {formatAmount(b.amountMinor)}
                    </span>
                    {owe && (
                      <button
                        type="button"
                        onClick={() => setActionIdx(i)}
                        aria-label="Change borrowing status"
                        className="ml-auto flex min-h-8 items-center text-primary"
                      >
                        Status ›
                      </button>
                    )}
                  </span>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((v.paidMinor / b.amountMinor) * 100))}%` }} />
                  </span>
                  {v.outstandingMinor > 0 &&
                    (confirmRepaidIdx === i ? (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          disabled={repaying}
                          onClick={() => void markRepaid(v)}
                          className="min-h-11 flex-1 rounded-lg bg-primary px-3 text-sm font-medium text-canvas disabled:opacity-60"
                        >
                          {repaying ? 'Saving…' : `Confirm · ${formatAmount(v.outstandingMinor)} repaid`}
                        </button>
                        <button
                          type="button"
                          disabled={repaying}
                          onClick={() => setConfirmRepaidIdx(null)}
                          className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-muted disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmRepaidIdx(i)}
                          className="min-h-11 flex-1 rounded-lg border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary"
                        >
                          ✅ Mark fully repaid
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRepayPreset(b.id);
                            setAddOpen(true);
                          }}
                          className="min-h-11 flex-1 rounded-lg border border-muted/40 px-3 text-sm"
                        >
                          + Add repayment
                        </button>
                      </span>
                    ))}
                </div>
              )}
              </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setAddBorrowOpen(true)} className="mt-2 min-h-11 w-full rounded-lg border border-dashed border-muted/60 text-sm text-muted">
            + Add Borrowing
          </button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted">Repayment History</p>
            <button
              type="button"
              onClick={() => {
                setRepayPreset(undefined);
                setAddOpen(true);
              }}
              className="min-h-8 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary"
            >
              + Add
            </button>
          </div>
          {debt.repayments.length === 0 ? (
            <p className="text-sm text-muted">No repayments yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {debt.repayments.map((r, i) => (
                <li key={`${r.date}-${i}`} className="flex items-center justify-between border-b border-muted/20 py-2">
                  <span className="flex flex-col text-sm text-fg">
                    {formatDisplayDate(r.date, dateFormat)}
                    {r.borrowingId && debt.borrowings.length > 1 && (
                      <span className="text-xs text-muted">
                        → {formatDisplayDate(debt.borrowings.find((b) => b.id === r.borrowingId)?.date ?? debt.date, dateFormat)} borrowing
                      </span>
                    )}
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
          {owe && writtenOff > 0 && (
            <>
              <p className="mt-1 flex justify-between text-sm">
                <span className="text-muted">Written-off</span>
                <span className="text-fg">− {formatAmount(writtenOff)}</span>
              </p>
              <p className="mt-1 flex justify-between text-sm">
                <span className="text-muted">Receivable (Net Worth)</span>
                <span className="font-medium text-fg">{formatAmount(outstanding - writtenOff)}</span>
              </p>
            </>
          )}
          {sumRepayments(debt.repayments) > debt.totalAmountMinor && (
            <p className="mt-1 text-sm text-muted">Total paid exceeds the original amount — please confirm.</p>
          )}
        </div>

        {repayError && (
          <p role="alert" className="text-sm text-expense">
            {repayError}
          </p>
        )}
      </div>

      {addOpen && (
        <RepaymentSheet
          uid={uid}
          debt={debt}
          presetBorrowingId={repayPreset}
          onClose={() => {
            setAddOpen(false);
            setRepayPreset(undefined);
          }}
        />
      )}
      {actionIdx !== null && views[actionIdx] && (
        <BorrowingActionSheet
          uid={uid}
          debt={debt}
          view={views[actionIdx]}
          onClose={() => setActionIdx(null)}
        />
      )}
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

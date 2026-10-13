// প্রতিটি Borrowing লাইনের দ্রুত অ্যাকশন: পুরো ফেরত / শোধ যোগ / Active-Doubtful-Written-off (owner-approved, 2026-10-13)
import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import { formatAmount } from '../../../lib/format';
import { toDhakaDate } from '../../../lib/date';
import { type LineStatus, type LineView } from '../../../lib/debtCalc';
import { setBorrowingStatus, setRepayments } from '../../../data/debtRepo';
import { settleOrPending } from '../../../lib/async';
import type { Debt } from '../../../validation/debtSchema';

export const LINE_STATUS_LABEL: Record<LineStatus, string> = { active: 'Active', doubtful: 'Doubtful', written_off: 'Written-off' };
const STATUS_OPTIONS: readonly LineStatus[] = ['active', 'doubtful', 'written_off'];

export default function BorrowingActionSheet({
  uid,
  debt,
  view,
  onAddRepayment,
  onClose,
}: {
  uid: string;
  debt: Debt;
  view: LineView;
  onAddRepayment: (borrowingId: string | undefined) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owe = debt.direction === 'owe_me';

  async function run(op: Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await settleOrPending(op, 3000);
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setBusy(false);
    }
  }

  // একটাই tap-এ বাকি টাকা ফেরত — এই লাইনের সাথে লিংকড repayment (double-tap-এ busy গার্ড)
  function markRepaid() {
    void run(
      setRepayments(uid, debt.id, [
        ...debt.repayments,
        { date: toDhakaDate(new Date()), amountMinor: view.outstandingMinor, note: '', ...(view.line.id ? { borrowingId: view.line.id } : {}) },
      ]),
    );
  }

  const footer = (
    <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-muted/40 px-4 text-sm">
      Close
    </button>
  );

  return (
    <BottomSheet title={`Borrowing · ${formatAmount(view.line.amountMinor)}`} onRequestClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Paid {formatAmount(view.paidMinor)} · Outstanding {formatAmount(view.outstandingMinor)}
        </p>

        {view.outstandingMinor > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={markRepaid}
            className="min-h-12 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60"
          >
            ✅ Mark fully repaid ({formatAmount(view.outstandingMinor)})
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onAddRepayment(view.line.id);
            onClose();
          }}
          className="min-h-12 rounded-lg border border-muted/40 px-4 text-sm"
        >
          + Add repayment for this borrowing
        </button>

        {owe && (
          <div>
            <p className="mb-1 text-sm text-muted">Status</p>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  aria-pressed={view.status === s}
                  onClick={() => void run(setBorrowingStatus(uid, debt, view.index, s))}
                  className={`min-h-11 flex-1 rounded-lg border text-sm ${view.status === s ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`}
                >
                  {LINE_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Written-off: the unpaid part is excluded from Net Worth. Payment history stays.</p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

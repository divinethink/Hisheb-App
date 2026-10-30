// repayments-এর সিমেট্রিক UI — RepaymentSheet.tsx-এর হুবহু mirror (owner-approved, 2026-09-26)।
import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput from '../../common/AmountInput';
import { resolveAmountMinor, minorToInput } from '../../../lib/money';
import { newBorrowingId, setBorrowings } from '../../../data/debtRepo';
import { settleOrPending } from '../../../lib/async';
import type { Debt } from '../../../validation/debtSchema';
import DateInput from '../../common/DateInput';
import { toDhakaDate } from '../../../lib/date';

function today(): string {
  return toDhakaDate(new Date()); // Asia/Dhaka (UTC নয়) — রাত ১২–ভোর ৬টায় আগের দিন বসত
}

export default function BorrowingSheet({
  uid,
  debt,
  editIndex,
  onClose,
}: {
  uid: string;
  debt: Debt;
  editIndex?: number;
  onClose: () => void;
}) {
  const editing = editIndex !== undefined ? debt.borrowings[editIndex] : undefined;
  const [date, setDate] = useState(editing?.date ?? today());
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = resolveAmountMinor(amount);

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (!date || parsed === null) return;
    setSaving(true);
    setError('');
    try {
      const next =
        editIndex !== undefined
          ? debt.borrowings.map((b, i) => (i === editIndex ? { ...b, date, amountMinor: parsed, note } : b))
          : [...debt.borrowings, { id: newBorrowingId(), date, amountMinor: parsed, note }];
      await settleOrPending(setBorrowings(uid, debt.id, next), 3000);
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  const footer = (
    <>
      <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm disabled:opacity-60">
        Cancel
      </button>
      <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </>
  );

  return (
    <BottomSheet title={editing ? 'Edit borrowing' : 'Add borrowing'} onRequestClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <AmountInput value={amount} onChange={setAmount} showError={submitted} autoFocus={!editing} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="bor-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <DateInput uid={uid} id="bor-date" value={date} onChange={setDate} invalid={submitted && !date} variant="tall" />
          </div>
          <div>
            <label htmlFor="bor-note" className="mb-1 block text-sm text-muted">
              Note (optional)
            </label>
            <input
              id="bor-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

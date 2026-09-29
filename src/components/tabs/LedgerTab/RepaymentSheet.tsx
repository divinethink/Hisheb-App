import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput, { AmountKeypad } from '../../common/AmountInput';
import { parseAmountToMinor, minorToInput } from '../../../lib/money';
import { sumRepayments } from '../../../lib/debtCalc';
import { setRepayments } from '../../../data/debtRepo';
import { settleOrPending } from '../../../lib/async';
import type { Debt } from '../../../validation/debtSchema';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RepaymentSheet({
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
  const editing = editIndex !== undefined ? debt.repayments[editIndex] : undefined;
  const [date, setDate] = useState(editing?.date ?? today());
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = parseAmountToMinor(amount);
  // এডিট হলে নিজের পুরনো amount বাদ দিয়ে বাকিদের যোগফলের সাথে তুলনা
  const othersSum = sumRepayments(editIndex !== undefined ? debt.repayments.filter((_, i) => i !== editIndex) : debt.repayments);
  const willExceed = parsed !== null && othersSum + parsed > debt.totalAmountMinor;

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (!date || parsed === null) return;
    setSaving(true);
    setError('');
    try {
      const next =
        editIndex !== undefined
          ? debt.repayments.map((r, i) => (i === editIndex ? { date, amountMinor: parsed, note } : r))
          : [...debt.repayments, { date, amountMinor: parsed, note }];
      await settleOrPending(setRepayments(uid, debt.id, next), 3000);
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
    <BottomSheet title={editing ? 'Edit repayment' : 'Add repayment'} onRequestClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <AmountInput value={amount} showError={submitted} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="rep-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <input
              id="rep-date"
              type="date"
              lang="en-GB"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={submitted && !date}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
          <div>
            <label htmlFor="rep-note" className="mb-1 block text-sm text-muted">
              Note (optional)
            </label>
            <input
              id="rep-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
        </div>
        <AmountKeypad value={amount} onChange={setAmount} />
        {willExceed && (
          <p className="text-sm text-muted">Total paid exceeds the original amount — please confirm.</p>
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

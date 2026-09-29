import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput, { AmountKeypad } from '../../common/AmountInput';
import { parseAmountToMinor, minorToInput } from '../../../lib/money';
import { setInvestmentRepayments } from '../../../data/investmentRepo';
import { settleOrPending } from '../../../lib/async';
import type { Investment } from '../../../validation/investmentSchema';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InvestmentRepaymentSheet({
  uid,
  investment,
  editIndex,
  onClose,
}: {
  uid: string;
  investment: Investment;
  editIndex?: number;
  onClose: () => void;
}) {
  const editing = editIndex !== undefined ? investment.repayments[editIndex] : undefined;
  const [date, setDate] = useState(editing?.date ?? today());
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = parseAmountToMinor(amount);

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (!date || parsed === null) return;
    setSaving(true);
    setError('');
    try {
      const next =
        editIndex !== undefined
          ? investment.repayments.map((r, i) => (i === editIndex ? { date, amountMinor: parsed, note } : r))
          : [...investment.repayments, { date, amountMinor: parsed, note }];
      await settleOrPending(setInvestmentRepayments(uid, investment.id, next), 3000);
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
            <label htmlFor="inv-rep-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <input
              id="inv-rep-date"
              type="date"
              lang="en-GB"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={submitted && !date}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
          <div>
            <label htmlFor="inv-rep-note" className="mb-1 block text-sm text-muted">
              Note (optional)
            </label>
            <input
              id="inv-rep-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
        </div>
        <AmountKeypad value={amount} onChange={setAmount} />
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

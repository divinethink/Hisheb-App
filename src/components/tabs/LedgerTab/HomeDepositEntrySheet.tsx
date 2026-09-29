import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput, { AmountKeypad } from '../../common/AmountInput';
import { parseAmountToMinor, minorToInput } from '../../../lib/money';
import { addHomeDeposit, updateHomeDeposit } from '../../../data/homeDepositRepo';
import { settleOrPending } from '../../../lib/async';
import { HomeDepositTypeSchema, type HomeDepositEntry } from '../../../validation/homeDepositSchema';
import type { z } from 'zod';

type EntryType = z.infer<typeof HomeDepositTypeSchema>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HomeDepositEntrySheet({
  uid,
  fundId,
  initialType,
  editing,
  onClose,
}: {
  uid: string;
  fundId: string;
  /** নতুন এন্ট্রির জন্য — "+ Add Deposit"/"+ Add Withdrawal" কোন বাটনে চাপা হয়েছে তা থেকে প্রিসেট। */
  initialType?: EntryType;
  /** এডিটের জন্য বিদ্যমান এন্ট্রি। */
  editing?: HomeDepositEntry;
  onClose: () => void;
}) {
  const [date, setDate] = useState(editing?.date ?? today());
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : '');
  const [type, setType] = useState<EntryType>(editing?.type ?? initialType ?? 'deposit');
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
      // TS-union inference limitation (Promise<void>|Promise<string>) এড়াতে দুই ব্রাঞ্চ আলাদা —
      // আচরণ অপরিবর্তিত, DebtSheet.tsx/InvestmentSheet.tsx-এর একই fix pattern reuse (২০২৬-০৯-২২)
      if (editing) {
        await settleOrPending(
          updateHomeDeposit(uid, editing.id, { date, amountMinor: parsed, type, note: note.trim() }),
          3000,
        );
      } else {
        await settleOrPending(
          addHomeDeposit(uid, { fundId, date, amountMinor: parsed, type, note: note.trim() }),
          3000,
        );
      }
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
    <BottomSheet
      title={editing ? 'Edit entry' : type === 'deposit' ? 'Add Deposit' : 'Add Withdrawal'}
      onRequestClose={onClose}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        {editing && (
          <div className="flex gap-2">
            {(['deposit', 'withdrawal'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={`min-h-11 flex-1 rounded-lg border text-sm capitalize ${type === t ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <AmountInput value={amount} showError={submitted} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="hd-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <input
              id="hd-date"
              type="date"
              lang="en-GB"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={submitted && !date}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
          <div>
            <label htmlFor="hd-note" className="mb-1 block text-sm text-muted">
              Note (optional)
            </label>
            <input
              id="hd-note"
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

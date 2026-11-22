import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput from '../../common/AmountInput';
import DateInput from '../../common/DateInput';
import { minorToInput, resolveAmountMinor } from '../../../lib/money';
import { toDhakaDate } from '../../../lib/date';
import { addZakatPayment, updateZakatPayment } from '../../../data/zakatRepo';
import { settleOrPending } from '../../../lib/async';
import type { ZakatPayment } from '../../../validation/zakatSchema';

export default function ZakatPaymentSheet({ uid, editing, onClose }: { uid: string; editing?: ZakatPayment; onClose: () => void }) {
  const [date, setDate] = useState(editing?.date ?? toDhakaDate(new Date()));
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
    const input = { date, amountMinor: parsed, note: note.trim() };
    try {
      if (editing) await settleOrPending(updateZakatPayment(uid, editing.id, input), 3000);
      else await settleOrPending(addZakatPayment(uid, input), 3000);
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
    <BottomSheet title={editing ? 'Edit payment' : 'Record Zakat payment'} onRequestClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <AmountInput value={amount} onChange={setAmount} showError={submitted} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="zp-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <DateInput uid={uid} id="zp-date" value={date} onChange={setDate} invalid={submitted && !date} variant="tall" />
          </div>
          <div>
            <label htmlFor="zp-note" className="mb-1 block text-sm text-muted">
              Note (optional)
            </label>
            <input
              id="zp-note"
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

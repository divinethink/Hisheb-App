import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput from '../../common/AmountInput';
import DateInput from '../../common/DateInput';
import { minorToInput, resolveAmountMinor } from '../../../lib/money';
import { toDhakaDate } from '../../../lib/date';
import { addZakatPayment, setZakatCycleDue, updateZakatPayment } from '../../../data/zakatRepo';
import { formatTakaWhole } from '../../../lib/format';
import { cycleStartOf, summarizeCycles } from '../../../lib/zakatCycle';
import { settleOrPending } from '../../../lib/async';
import type { ZakatCycle, ZakatPayment } from '../../../validation/zakatSchema';

interface Props {
  uid: string;
  editing?: ZakatPayment;
  onClose: () => void;
  payments: ZakatPayment[];
  cycles: ZakatCycle[];
  /** বার্ষিক তারিখ (settings.zakatCalculationDate) — যাকাত-বছর ঠিক করতে */
  anniversary: string | null;
  /** আজকের হিসাবে যাকাত (ফরজ না হলে 0) */
  liveDueMinor: number;
}

export default function ZakatPaymentSheet({ uid, editing, onClose, payments, cycles, anniversary, liveDueMinor }: Props) {
  const [date, setDate] = useState(editing?.date ?? toDhakaDate(new Date()));
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = resolveAmountMinor(amount);

  // এই তারিখের যাকাত-বছর ও বাকি (সম্পাদনায় নিজের পুরনো অঙ্ক বাদ দিয়ে)
  const today = toDhakaDate(new Date());
  const cycleStart = editing && editing.date === date && editing.cycleStart ? editing.cycleStart : cycleStartOf(date, anniversary);
  const others = payments.filter((x) => x.id !== editing?.id);
  const cyc = summarizeCycles(others, cycles, anniversary, today, liveDueMinor).find((c) => c.start === cycleStart);
  const hint =
    cyc?.dueMinor != null
      ? parsed !== null
        ? `After this: ${formatTakaWhole(Math.max(0, cyc.dueMinor - cyc.paidMinor - parsed))} remaining of ${formatTakaWhole(cyc.dueMinor)}.`
        : `Remaining now: ${formatTakaWhole(cyc.remainingMinor ?? 0)} of ${formatTakaWhole(cyc.dueMinor)}.`
      : null;

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (!date || parsed === null) return;
    setSaving(true);
    setError('');
    const input = { date, amountMinor: parsed, note: note.trim(), cycleStart };
    try {
      if (editing) await settleOrPending(updateZakatPayment(uid, editing.id, input), 3000);
      else await settleOrPending(addZakatPayment(uid, input), 3000);
      // বছরের প্রথম পেমেন্টে "দেয়" অঙ্ক লক (পরে সম্পদ বদলালেও বাকি নড়বে না)। শুধু চলতি বছরে, ফরজ থাকলে।
      const locked = cycles.some((c) => c.id === cycleStart);
      if (!locked && cycleStart === cycleStartOf(today, anniversary) && liveDueMinor > 0) {
        await settleOrPending(setZakatCycleDue(uid, cycleStart, liveDueMinor), 3000).catch(() => {}); // ব্যর্থ হলে পেমেন্ট সেভ থাকে; পরের পেমেন্টে আবার লক হবে
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
    <BottomSheet title={editing ? 'Edit payment' : 'Record Zakat payment'} onRequestClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <AmountInput value={amount} onChange={setAmount} showError={submitted} />
        {hint && (
          <p role="status" className="-mt-2 text-xs text-muted">
            {hint}
          </p>
        )}
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

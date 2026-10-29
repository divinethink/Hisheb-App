import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput from '../../common/AmountInput';
import { resolveAmountMinor, minorToInput } from '../../../lib/money';
import { lineViews, sumRepayments } from '../../../lib/debtCalc';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { setRepayments } from '../../../data/debtRepo';
import { useSettings } from '../../../hooks/useData';
import { settleOrPending } from '../../../lib/async';
import type { Debt } from '../../../validation/debtSchema';
import DateInput from '../../common/DateInput';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RepaymentSheet({
  uid,
  debt,
  editIndex,
  presetBorrowingId,
  onClose,
}: {
  uid: string;
  debt: Debt;
  editIndex?: number;
  presetBorrowingId?: string;
  onClose: () => void;
}) {
  const editing = editIndex !== undefined ? debt.repayments[editIndex] : undefined;
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  const [date, setDate] = useState(editing?.date ?? today());
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  // কোন Borrowing-এর বিপরীতে — '' = Oldest first (auto)
  const [borrowingId, setBorrowingId] = useState(editing?.borrowingId ?? presetBorrowingId ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = resolveAmountMinor(amount);
  // এডিট হলে নিজের পুরনো amount বাদ দিয়ে বাকিদের যোগফলের সাথে তুলনা
  const othersSum = sumRepayments(editIndex !== undefined ? debt.repayments.filter((_, i) => i !== editIndex) : debt.repayments);
  const views = lineViews(debt);
  const target = borrowingId ? views.find((v) => v.line.id === borrowingId) : undefined;
  const linkedOthers = target
    ? debt.repayments.reduce((s, r, i) => (i !== editIndex && r.borrowingId === borrowingId ? s + r.amountMinor : s), 0)
    : 0;
  const willExceed = target
    ? parsed !== null && linkedOthers + parsed > target.line.amountMinor
    : parsed !== null && othersSum + parsed > debt.totalAmountMinor;

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (!date || parsed === null) return;
    setSaving(true);
    setError('');
    try {
      const link = target ? { borrowingId } : {};
      const next =
        editIndex !== undefined
          ? debt.repayments.map((r, i) => (i === editIndex ? { date, amountMinor: parsed, note, ...link } : r))
          : [...debt.repayments, { date, amountMinor: parsed, note, ...link }];
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

  // শোধ-ফর্ম সহজ (owner-request, ২০২৬-১০-২৫): ১) Amount সবার আগে, নতুন entry-তে কীবোর্ড সাথে সাথে;
  // ২) "Full due" এক-ট্যাপে বাকি পুরোটা বসায়; ৩) নির্দিষ্ট ধারের কার্ড থেকে এলে "কোন ধার" আর জিজ্ঞেস করা হয় না
  // (শুধু দেখানো হয়); শুধু সাধারণ "+ Add" থেকে এলে (একাধিক ধার থাকলে) dropdown, ডিফল্ট Auto (পুরনো আগে)।
  const locked = !editing && presetBorrowingId !== undefined && target !== undefined;
  const dueMinor = target ? target.outstandingMinor : views.reduce((sum, v) => sum + v.outstandingMinor, 0);

  return (
    <BottomSheet title={editing ? 'Edit repayment' : 'Add repayment'} onRequestClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        {locked && target && (
          <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
            For borrowing: <span className="text-fg">{formatDisplayDate(target.line.date, dateFormat)} · {formatAmount(target.line.amountMinor)}</span>
          </p>
        )}
        <AmountInput value={amount} onChange={setAmount} showError={submitted} autoFocus={!editing} />
        {!editing && dueMinor > 0 && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setAmount(minorToInput(dueMinor))}
            className="-mt-2 min-h-11 self-start rounded-full border border-primary/40 bg-primary/10 px-4 text-sm text-primary active:bg-primary/20"
          >
            Full due · {formatAmount(dueMinor)}
          </button>
        )}
        {!locked && views.length > 1 && (
          <div>
            <label htmlFor="rep-for" className="mb-1 block text-sm text-muted">
              Repayment for
            </label>
            <select
              id="rep-for"
              value={target ? borrowingId : ''}
              onChange={(e) => setBorrowingId(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            >
              <option value="">Auto (oldest first)</option>
              {views.map((v) => (
                <option key={v.line.id ?? v.index} value={v.line.id ?? ''} disabled={!v.line.id}>
                  {formatDisplayDate(v.line.date, dateFormat)} · {formatAmount(v.line.amountMinor)} · due {formatAmount(v.outstandingMinor)}
                </option>
              ))}
            </select>
          </div>
        )}
        {target?.status === 'written_off' && (
          <p className="text-xs text-muted">This borrowing is written off — a payment here counts as a recovery.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="rep-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <DateInput uid={uid} id="rep-date" value={date} onChange={setDate} invalid={submitted && !date} variant="tall" />
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

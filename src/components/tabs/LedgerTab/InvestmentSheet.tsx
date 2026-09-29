import { useEffect, useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import AmountInput, { AmountKeypad } from '../../common/AmountInput';
import { minorToInput, parseAmountToMinor } from '../../../lib/money';
import { addInvestment, updateInvestment } from '../../../data/investmentRepo';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { settleOrPending } from '../../../lib/async';
import type { Investment } from '../../../validation/investmentSchema';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InvestmentSheet({
  uid,
  initial,
  ledgerId = null,
  onClose,
}: {
  uid: string;
  initial: Investment | null;
  ledgerId?: string | null;
  onClose: () => void;
}) {
  const [investedTo, setInvestedTo] = useState(initial?.investedTo ?? '');
  const [medium, setMedium] = useState(initial?.medium ?? '');
  const [amount, setAmount] = useState(initial ? minorToInput(initial.principalMinor) : '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [duration, setDuration] = useState(initial?.duration ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = initial
    ? investedTo.trim() !== initial.investedTo || medium !== initial.medium || duration !== initial.duration || note !== initial.note || date !== initial.date
    : investedTo.trim() !== '' || amount !== '' || medium !== '' || duration !== '' || note !== '';

  useEffect(() => {
    if (!dirty) return;
    markDirty();
    return () => markClean();
  }, [dirty]);

  function requestBack() {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  async function save() {
    if (saving) return;
    setSubmitted(true);
    const trimmedTo = investedTo.trim();
    const parsed = parseAmountToMinor(amount);
    setError('');
    if (!trimmedTo || parsed === null || !date) return;
    setSaving(true);
    try {
      if (initial) {
        await settleOrPending(
          updateInvestment(uid, initial.id, { investedTo: trimmedTo, medium, principalMinor: parsed, date, duration, note }),
          3000,
        );
      } else {
        await settleOrPending(
          addInvestment(uid, {
            investedTo: trimmedTo,
            medium,
            principalMinor: parsed,
            currency: 'BDT',
            date,
            duration,
            note,
            investmentOutcome: 'running',
            zakatable: true,
            expectedRepaymentDate: null,
            ledgerId,
          }),
          3000,
        );
      }
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  if (confirmDiscard) {
    return (
      <FullScreenPage title={initial ? 'Edit entry' : 'New entry'} onBack={() => setConfirmDiscard(false)}>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-fg">Discard changes?</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmDiscard(false)} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm">
              Keep editing
            </button>
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-expense px-4 text-sm font-medium text-canvas">
              Discard
            </button>
          </div>
        </div>
      </FullScreenPage>
    );
  }

  return (
    <FullScreenPage
      title={initial ? 'Edit entry' : 'New entry'}
      onBack={requestBack}
      footer={
        <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="inv-to" className="mb-1 block text-sm text-muted">
            Invested To
          </label>
          <input
            id="inv-to"
            autoFocus
            value={investedTo}
            maxLength={60}
            onChange={(e) => setInvestedTo(e.target.value)}
            aria-invalid={submitted && !investedTo.trim()}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
          {submitted && !investedTo.trim() && (
            <p role="alert" className="mt-1 text-sm text-expense">
              Enter a name.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="inv-medium" className="mb-1 block text-sm text-muted">
            Medium (optional)
          </label>
          <input
            id="inv-medium"
            value={medium}
            maxLength={60}
            onChange={(e) => setMedium(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
        </div>

        <AmountInput value={amount} showError={submitted} />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="inv-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <input
              id="inv-date"
              type="date"
              lang="en-GB"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
          <div>
            <label htmlFor="inv-note" className="mb-1 block text-sm text-muted">
              Note (optional)
            </label>
            <input
              id="inv-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
        </div>

        <AmountKeypad value={amount} onChange={setAmount} />

        <div>
          <label htmlFor="inv-duration" className="mb-1 block text-sm text-muted">
            Duration (optional)
          </label>
          <input
            id="inv-duration"
            value={duration}
            maxLength={40}
            onChange={(e) => setDuration(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </FullScreenPage>
  );
}

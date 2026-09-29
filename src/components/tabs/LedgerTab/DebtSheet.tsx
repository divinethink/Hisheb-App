import { useEffect, useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import AmountInput, { AmountKeypad } from '../../common/AmountInput';
import { minorToInput, parseAmountToMinor } from '../../../lib/money';
import { addDebt, updateDebt } from '../../../data/debtRepo';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { settleOrPending } from '../../../lib/async';
import type { Debt } from '../../../validation/debtSchema';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DebtSheet({ uid, initial, onClose }: { uid: string; initial: Debt | null; onClose: () => void }) {
  const [person, setPerson] = useState(initial?.person ?? '');
  const [direction, setDirection] = useState<Debt['direction']>(initial?.direction ?? 'owe_me');
  const [amount, setAmount] = useState(initial ? minorToInput(initial.totalAmountMinor) : '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = initial
    ? person.trim() !== initial.person || note !== initial.note || date !== initial.date
    : person.trim() !== '' || amount !== '' || note !== '';

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
    const trimmedPerson = person.trim();
    const parsed = parseAmountToMinor(amount);
    setError('');
    if (!trimmedPerson || !date) return;
    if (!initial && parsed === null) return;
    setSaving(true);
    try {
      // TS-union inference limitation (Promise<void>|Promise<string>) এড়াতে দুই ব্রাঞ্চ আলাদা —
      // আচরণ অপরিবর্তিত, শুধু build-blocking pre-existing type error ঠিক করা হলো
      if (initial) {
        await settleOrPending(updateDebt(uid, initial.id, { person: trimmedPerson, direction, date, note }), 3000);
      } else if (parsed !== null) {
        await settleOrPending(
          addDebt(uid, {
            person: trimmedPerson,
            direction,
            totalAmountMinor: parsed,
            currency: 'BDT',
            date,
            note,
            receivableStatus: 'active',
            expectedRepaymentDate: null,
            borrowings: [{ date, amountMinor: parsed, note: '' }],
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
        <div className="flex gap-2">
          {(['owe_me', 'i_owe'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              aria-pressed={direction === d}
              className={`min-h-11 flex-1 rounded-lg border text-sm ${direction === d ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`}
            >
              {d === 'owe_me' ? 'Owed to Me' : 'I Owe'}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="debt-person" className="mb-1 block text-sm text-muted">
            Person
          </label>
          <input
            id="debt-person"
            autoFocus
            value={person}
            maxLength={60}
            onChange={(e) => setPerson(e.target.value)}
            aria-invalid={submitted && !person.trim()}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
          {submitted && !person.trim() && (
            <p role="alert" className="mt-1 text-sm text-expense">
              Enter a name.
            </p>
          )}
        </div>

        {!initial && <AmountInput value={amount} showError={submitted} />}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="debt-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <input
              id="debt-date"
              type="date"
              lang="en-GB"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
          <div>
            <label htmlFor="debt-note" className="mb-1 block text-sm text-muted">
              Note (optional)
            </label>
            <input
              id="debt-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
        </div>

        {!initial && <AmountKeypad value={amount} onChange={setAmount} />}

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </FullScreenPage>
  );
}

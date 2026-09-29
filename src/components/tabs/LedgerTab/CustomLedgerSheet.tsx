import { useEffect, useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import { addCustomLedger } from '../../../data/customLedgerRepo';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { settleOrPending } from '../../../lib/async';
import type { CustomLedger } from '../../../validation/customLedgerSchema';

export default function CustomLedgerSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CustomLedger['kind']>('deposit');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = name.trim() !== '';

  useEffect(() => {
    if (!dirty) return;
    markDirty();
    return () => markClean();
  }, [dirty]);

  function requestClose() {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  async function save() {
    if (saving) return;
    setSubmitted(true);
    setError('');
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await settleOrPending(addCustomLedger(uid, { name: trimmed, kind }), 3000);
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  const footer = confirmDiscard ? (
    <>
      <p className="flex-1 self-center text-sm">Discard changes?</p>
      <button type="button" onClick={() => setConfirmDiscard(false)} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm">
        Keep editing
      </button>
      <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-expense px-4 text-sm font-medium text-canvas">
        Discard
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={requestClose} disabled={saving} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm disabled:opacity-60">
        Cancel
      </button>
      <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </>
  );

  return (
    <BottomSheet title="Add New Ledger" onRequestClose={requestClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="ledger-name" className="mb-1 block text-sm text-muted">
            Name
          </label>
          <input
            id="ledger-name"
            autoFocus
            value={name}
            maxLength={60}
            placeholder="e.g. Wife's Business Fund"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && !name.trim()}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
          {submitted && !name.trim() && (
            <p role="alert" className="mt-1 text-sm text-expense">
              Enter a name.
            </p>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm text-muted">Type</p>
          <div className="flex gap-2">
            {(['deposit', 'investment'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`min-h-11 flex-1 rounded-lg border text-sm ${kind === k ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`}
              >
                {k === 'deposit' ? 'Deposit' : 'Investment'}
              </button>
            ))}
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

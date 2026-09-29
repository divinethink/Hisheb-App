import { useEffect, useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import { addAccount, updateAccount } from '../../../data/accountRepo';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { settleOrPending } from '../../../lib/async';
import type { Account } from '../../../validation/accountSchema';

export default function AccountSheet({
  uid,
  initial,
  onClose,
}: {
  uid: string;
  initial: Account | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [holder, setHolder] = useState(initial?.holder ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'BDT');
  const [zakatable, setZakatable] = useState(initial?.zakatable ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = initial
    ? name.trim() !== initial.name || holder.trim() !== (initial.holder ?? '') || zakatable !== initial.zakatable
    : name.trim() !== '' || holder.trim() !== '';

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
      const write: Promise<string | void> = initial
        ? updateAccount(uid, initial.id, { name: trimmed, holder: holder.trim() || null, zakatable })
        : addAccount(uid, { name: trimmed, holder: holder.trim() || null, currency, zakatable, archived: false });
      await settleOrPending(write, 3000);
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  async function archive() {
    if (!initial || saving) return;
    setSaving(true);
    setError('');
    try {
      await settleOrPending(updateAccount(uid, initial.id, { archived: true }), 3000);
      onClose();
    } catch {
      setError('Could not archive. Check your connection and try again.');
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
    <BottomSheet title={initial ? 'Edit account' : 'Add account'} onRequestClose={requestClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="acc-name" className="mb-1 block text-sm text-muted">
            Name
          </label>
          <input
            id="acc-name"
            autoFocus
            value={name}
            maxLength={60}
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
          <label htmlFor="acc-holder" className="mb-1 block text-sm text-muted">
            Holder (optional)
          </label>
          <input
            id="acc-holder"
            value={holder}
            maxLength={30}
            placeholder="e.g. Me, Wife, Joint"
            onChange={(e) => setHolder(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
        </div>

        {!initial && (
          <div>
            <label htmlFor="acc-currency" className="mb-1 block text-sm text-muted">
              Currency
            </label>
            <input
              id="acc-currency"
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="min-h-12 w-24 rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
        )}

        <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
          <input type="checkbox" checked={zakatable} onChange={(e) => setZakatable(e.target.checked)} className="h-5 w-5" />
          Zakatable
        </label>

        {initial && (
          <button type="button" onClick={() => void archive()} disabled={saving} className="min-h-11 self-start text-sm text-expense disabled:opacity-60">
            Archive this account
          </button>
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

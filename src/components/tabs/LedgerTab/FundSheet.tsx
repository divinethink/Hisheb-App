import { useEffect, useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import { addFund, updateFund } from '../../../data/homeDepositRepo';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { settleOrPending } from '../../../lib/async';
import type { Fund } from '../../../validation/homeDepositSchema';

export default function FundSheet({
  uid,
  initial,
  onClose,
}: {
  uid: string;
  initial: Fund | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'BDT');
  const [zakatable, setZakatable] = useState(initial?.zakatable ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = initial
    ? name.trim() !== initial.name || zakatable !== initial.zakatable
    : name.trim() !== '';

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
        ? updateFund(uid, initial.id, { name: trimmed, zakatable })
        : addFund(uid, { name: trimmed, currency, zakatable, archived: false });
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
      await settleOrPending(updateFund(uid, initial.id, { archived: true }), 3000);
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
    <BottomSheet title={initial ? 'Edit fund' : 'Add New Fund'} onRequestClose={requestClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="fund-name" className="mb-1 block text-sm text-muted">
            Name
          </label>
          <input
            id="fund-name"
            autoFocus
            value={name}
            maxLength={60}
            placeholder="e.g. My Piggybank"
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

        {!initial && (
          <div>
            <label htmlFor="fund-currency" className="mb-1 block text-sm text-muted">
              Currency
            </label>
            <input
              id="fund-currency"
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
            Archive this fund
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

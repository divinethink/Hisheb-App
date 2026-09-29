// নতুন Category/Label তৈরির শেয়ার্ড ফর্ম (owner-request, ২০২৬-০৯-২৬) — Menu → Manage
// Categories/Labels-এর "+ Create New" ও Home → Add Transaction-এর "+ New Category/Label"
// দুই জায়গাতেই এই একই component/UX (name+color+icon) reuse হয়, যাতে আলাদা আলাদা UI/logic
// তৈরি না হয়। UI/logic ManageCatalog.tsx-এর EditForm-এর সাথে সামঞ্জস্যপূর্ণ রাখা হয়েছে।
import { useState } from 'react';
import FullScreenPage from './FullScreenPage';
import CategoryIcon from './CategoryIcon';
import { ICON_OPTIONS, COLOR_OPTIONS } from '../../lib/iconOptions';

export interface CatalogEntryResult {
  name: string;
  icon: string | null;
  color: string | null;
}

export default function CatalogEntryForm({
  kind,
  onClose,
  onCreate,
}: {
  kind: 'category' | 'label';
  onClose: () => void;
  onCreate: (data: CatalogEntryResult) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onCreate({ name: trimmed, icon, color });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try a different name.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenPage
      title={`New ${kind === 'category' ? 'Category' : 'Label'}`}
      onBack={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm text-fg">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Create'}
          </button>
        </>
      }
    >
      <div className="flex justify-center">
        <CategoryIcon name={name || '?'} icon={icon} color={color} size={56} />
      </div>

      <label className="mt-4 block text-sm text-muted" htmlFor="new-catalog-name">
        Name
      </label>
      <input
        id="new-catalog-name"
        autoFocus
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
      />

      <h3 className="mt-5 text-sm text-muted">Color</h3>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          aria-pressed={color === null}
          onClick={() => setColor(null)}
          className={`flex h-9 items-center justify-center rounded-full border px-3 text-xs text-muted ${color === null ? 'border-primary text-fg' : 'border-muted/40'}`}
        >
          Auto
        </button>
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className={`h-9 w-9 rounded-full border-2 ${color === c ? 'border-fg' : 'border-transparent'}`}
            style={{ background: c }}
          />
        ))}
      </div>

      <h3 className="mt-5 text-sm text-muted">Icon</h3>
      <div className="mt-2 grid grid-cols-6 gap-2">
        {ICON_OPTIONS.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={icon === i}
            onClick={() => setIcon(icon === i ? null : i)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl ${icon === i ? 'border-primary bg-primary/10' : 'border-muted/40'}`}
          >
            {i}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-expense">
          {error}
        </p>
      )}
    </FullScreenPage>
  );
}

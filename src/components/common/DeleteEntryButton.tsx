import { useState } from 'react';
import { Trash2 } from 'lucide-react';

// ভুল এন্ট্রি স্থায়ীভাবে মোছার বাটন — একবার confirm; ব্যর্থ হলে error দেখায় (silent failure নয়)।
export default function DeleteEntryButton({
  label,
  warning,
  onDelete,
}: {
  label: string;
  warning: string;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
    } catch {
      setError('Could not delete. Check your connection and try again.');
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-expense/50 text-sm font-medium text-expense"
      >
        <Trash2 aria-hidden size={16} /> {label}
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={label} className="mt-2 rounded-lg border border-expense/50 p-3">
      <p className="text-sm text-fg">{warning}</p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-expense">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm text-fg disabled:opacity-60">
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={() => void run()} className="min-h-11 flex-1 rounded-lg bg-expense text-sm font-medium text-canvas disabled:opacity-60">
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

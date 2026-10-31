import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useBackClose } from '../../hooks/useBackClose';

// ভুল এন্ট্রি মোছা (owner-approved ২০২৬-১০-৩১): হেডারের ডানে ছোট ধূসর আইকন (ভুলে চাপ এড়াতে);
// চাপলে নিচ থেকে ছোট কনফার্ম-শিট — নাম/অঙ্ক দেখায়। ব্যর্থ হলে error দেখায় (silent failure নয়)।
function ConfirmSheet({
  title,
  detail,
  onClose,
  onDelete,
}: {
  title: string;
  detail: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useBackClose(onClose); // ফোনের ব্যাক = Cancel

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

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={() => !busy && onClose()} className="absolute inset-0 bg-fg/40" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg rounded-t-2xl bg-canvas p-5 text-fg"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <p className="text-lg font-semibold text-expense">{title}</p>
        <p className="mt-2 text-sm text-fg">{detail}</p>
        <p className="mt-1 text-xs text-muted">This cannot be undone.</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-expense">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm text-fg disabled:opacity-60">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => void run()} className="min-h-11 flex-1 rounded-lg bg-expense text-sm font-medium text-canvas disabled:opacity-60">
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DeleteEntryButton({ title, detail, onDelete }: { title: string; detail: string; onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Delete entry"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-muted/70 active:bg-muted/10"
      >
        <Trash2 aria-hidden size={18} />
      </button>
      {open && <ConfirmSheet title={title} detail={detail} onClose={() => setOpen(false)} onDelete={onDelete} />}
    </>
  );
}

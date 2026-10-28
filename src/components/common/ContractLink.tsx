import { useState } from 'react';
import { FileText } from 'lucide-react';
import { getEnv } from '../../config/env';
import { getContractViewLink, isGoogleDriveConfigured } from '../../data/googleDrive';

const DRIVE_CLIENT_ID = getEnv().googleDriveClientId;

/** সংযুক্ত PDF খোলার বাটন — Drive-এর দেখার লিংকে। ফাইল না থাকলে স্পষ্ট error (silent fail নয়)। */
export default function ContractLink({ fileId, name }: { fileId: string; name: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function open() {
    if (busy) return;
    setError('');
    if (!isGoogleDriveConfigured(DRIVE_CLIENT_ID)) {
      setError("Google Drive isn't set up for this build yet.");
      return;
    }
    // popup-blocker এড়াতে ক্লিকের মুহূর্তেই ফাঁকা ট্যাব খুলি, লিংক পেলে সেখানে বসাই
    const w = window.open('', '_blank');
    setBusy(true);
    getContractViewLink(DRIVE_CLIENT_ID, fileId)
      .then((link) => {
        if (w) w.location.href = link;
        else window.location.href = link;
      })
      .catch((e: unknown) => {
        w?.close();
        setError(e instanceof Error && e.message ? e.message : 'Could not open the PDF.');
      })
      .finally(() => setBusy(false));
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-muted/15 bg-surface px-3 text-left text-sm text-fg disabled:opacity-60"
      >
        <FileText aria-hidden size={18} className="shrink-0 text-expense" />
        <span className="min-w-0 flex-1 truncate">{name || 'Contract.pdf'}</span>
        <span className="shrink-0 text-xs font-medium text-primary">{busy ? 'Opening…' : 'Open'}</span>
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-expense">
          {error}
        </p>
      )}
    </div>
  );
}

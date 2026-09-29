// gpf_import.csv → gpfEntries (one-time, idempotent — importKey আগে থেকে থাকলে skip, তাই আবার চালালে duplicate হয় না)।
// pick→review→done→error প্যাটার্ন (ImportExcelMonthlySnapshots-এর মতো)।
import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import { parseGpfCsv, type GpfImportRow } from '../../../lib/gpfImport';
import { addGpfEntry, getGpfImportKeys } from '../../../data/gpfRepo';
import { gpfTotalsMinor } from '../../../lib/gpfCalc';
import { formatAmount } from '../../../lib/format';

type Step = 'pick' | 'review' | 'done' | 'error';

export default function ImportGpf({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<GpfImportRow[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const res = parseGpfCsv(await file.text());
      const keys = await getGpfImportKeys(uid);
      const fresh = res.rows.filter((r) => !keys.has(r.importKey));
      if (fresh.length === 0) {
        setError(res.rows.length === 0 ? 'কোনো বৈধ row নেই — `amount` কলামে পূর্ণ টাকা (দশমিক ছাড়া) থাকতে হবে' : 'সব row আগেই import করা আছে');
        setStep('error');
        return;
      }
      setRows(fresh);
      setExistingCount(res.rows.length - fresh.length);
      setSkippedCount(res.skipped.length);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSV পড়া যায়নি');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      for (const r of rows) {
        await addGpfEntry(uid, { ...r, note: '' });
      }
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenPage title="Import GPF Entries" onBack={onClose}>
      {step === 'pick' && (
        <div>
          <p className="text-sm text-muted">
            gpf_import.csv বেছে নিন (কলাম `amount` = পূর্ণ টাকা, দশমিক ছাড়া)। যে row-এর importKey আগে থেকেই আছে সেটা আবার যোগ হবে না।
          </p>
          <input type="file" accept=".csv" disabled={busy} onChange={(e) => void handleFile(e.target.files)} className="mt-4 block text-sm text-fg" />
          {busy && <p className="mt-4 text-sm text-muted">Reading…</p>}
        </div>
      )}
      {step === 'review' && (
        <div>
          <p className="text-sm text-fg">
            {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} ready — resulting balance {formatAmount(gpfTotalsMinor(rows).balance)}
          </p>
          {(existingCount > 0 || skippedCount > 0) && (
            <p className="mt-1 text-xs text-muted">
              {existingCount > 0 && `${existingCount}টা আগেই আছে (বাদ)। `}
              {skippedCount > 0 && `${skippedCount}টা অবৈধ row (বাদ)।`}
            </p>
          )}
          <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.importKey} className="flex items-center justify-between rounded-lg border border-muted/30 p-3 text-sm">
                <span className="text-fg">
                  {r.date} <span className="text-xs capitalize text-muted">· {r.type}</span>
                </span>
                <span className="text-muted">{formatAmount(r.amountMinor)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setStep('pick')} disabled={busy} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
              Back
            </button>
            <button type="button" onClick={() => void confirmImport()} disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-40">
              {busy ? 'Importing…' : `Import ${rows.length}`}
            </button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div>
          <p className="text-base font-semibold text-fg">✅ Import Complete</p>
          <p className="mt-2 text-sm text-fg">{rows.length}টা GPF entry বসানো হয়েছে</p>
          <button type="button" onClick={onClose} className="mt-6 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas">
            Done
          </button>
        </div>
      )}
      {step === 'error' && (
        <div>
          <p role="alert" className="text-sm text-fg">
            {error}
          </p>
          <button type="button" onClick={() => setStep('pick')} className="mt-4 min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
            Try again
          </button>
        </div>
      )}
    </FullScreenPage>
  );
}

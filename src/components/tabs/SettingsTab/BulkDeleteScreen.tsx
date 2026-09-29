// Bulk Delete (P5, Roadmap §৪.৮/Checklist P5) — ফিল্টার-ভিত্তিক PERMANENT delete।
// soft-delete (transactions.deleted flag) থেকে সম্পূর্ণ আলাদা ফিচার।
// নিয়ম (Roadmap §৪.৮ + Audit): auto-backup বাধ্যতামূলক আগে + "DELETE" টাইপ-করে-confirm।
// Blocker-fix: backup ধাপ ব্যর্থ/অসম্পূর্ণ হলে confirm-input কখনো enable হবে না —
// silent backup-failure + permanent delete এড়াতে (টাকার অ্যাপে সবচেয়ে খারাপ ফলাফল)।
import { useState } from 'react';
import type { SessionUser } from '../../../auth/AuthProvider';
import FullScreenPage from '../../common/FullScreenPage';
import { buildBackupPayload } from '../../../data/backupRepo';
import { countTransactionsInRange, hardDeleteTransactionsByRange } from '../../../data/transactionRepo';
import { currentMonth, toDhakaDate } from '../../../lib/date';

type RangeType = 'daily' | 'monthly' | 'yearly' | 'all';
type Step = 'filter' | 'backup' | 'confirm' | 'done' | 'error';

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function downloadJson(payload: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** নির্বাচিত ফিল্টার থেকে [start, end] date-string বের করে; All-Time-এ [null, null]। */
function rangeFor(type: RangeType, day: string, month: string, year: string): [string | null, string | null] {
  if (type === 'daily') return [day, day];
  if (type === 'monthly') return [`${month}-01`, `${month}-31`];
  if (type === 'yearly') return [`${year}-01-01`, `${year}-12-31`];
  return [null, null];
}

function rangeLabel(type: RangeType, day: string, month: string, year: string): string {
  if (type === 'daily') return day;
  if (type === 'monthly') return month;
  if (type === 'yearly') return year;
  return 'All-Time (সব লেনদেন)';
}

export default function BulkDeleteScreen({ user, onClose }: { user: SessionUser; onClose: () => void }) {
  const today = toDhakaDate(new Date());
  const [step, setStep] = useState<Step>('filter');
  const [rangeType, setRangeType] = useState<RangeType>('monthly');
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);

  const [backupOk, setBackupOk] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletedCount, setDeletedCount] = useState(0);

  const [start, end] = rangeFor(rangeType, day, month, year);
  const label = rangeLabel(rangeType, day, month, year);

  async function handlePreview() {
    setBusy(true);
    setError('');
    try {
      const count = await countTransactionsInRange(user.uid, start, end);
      setMatchCount(count);
      setBackupOk(false);
      setConfirmText('');
      setStep('backup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not count transactions.');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  // auto-backup — এই ধাপ throw করলে backupOk কখনো true হবে না, ফলে delete UI আনলক হবে না।
  async function handleBackup() {
    setBackupBusy(true);
    setError('');
    try {
      const payload = await buildBackupPayload(user.uid, user.email);
      downloadJson(payload, `hisheb_pre-bulk-delete-backup_${dateStamp()}.json`);
      setBackupOk(true);
      setStep('confirm');
    } catch (e) {
      setBackupOk(false);
      setError(e instanceof Error ? e.message : 'Backup failed — delete blocked until backup succeeds.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleDelete() {
    if (!backupOk || confirmText !== 'DELETE' || busy) return;
    setBusy(true);
    setError('');
    try {
      const n = await hardDeleteTransactionsByRange(user.uid, start, end);
      setDeletedCount(n);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed partway through — check your data and backup file.');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenPage title="Delete Data (Permanent)" onBack={onClose}>
      {step === 'filter' && (
        <div>
          <p className="text-sm text-muted">
            এটা <span className="font-medium text-fg">permanent delete</span> — soft-delete/Undo থেকে আলাদা। শুধু
            লেনদেন (transactions) মুছবে, Debts/Investments/Home Deposit-এ প্রভাব পড়বে না।
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['daily', 'monthly', 'yearly', 'all'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRangeType(t)}
                className={`min-h-11 rounded-lg border px-3 text-sm capitalize ${
                  rangeType === t ? 'border-primary bg-primary text-canvas' : 'border-muted/40 text-fg'
                }`}
              >
                {t === 'all' ? 'All-Time' : t}
              </button>
            ))}
          </div>

          {rangeType === 'daily' && (
            <input
              type="date"
              lang="en-GB"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-4 min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg"
            />
          )}
          {rangeType === 'monthly' && (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-4 min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg"
            />
          )}
          {rangeType === 'yearly' && (
            <input
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, ''))}
              className="mt-4 min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg"
            />
          )}
          {rangeType === 'all' && (
            <p className="mt-4 text-xs text-expense">সব-সময়ের সব লেনদেন মুছে যাবে — সবচেয়ে ঝুঁকিপূর্ণ অপশন।</p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-xs text-expense">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={busy || (rangeType === 'yearly' && year.length !== 4)}
            className="mt-6 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Next'}
          </button>
        </div>
      )}

      {step === 'backup' && (
        <div>
          <p className="text-sm text-fg">
            রেঞ্জ: <span className="font-medium">{label}</span>
          </p>
          <p className="mt-1 text-sm text-fg">
            <span className="font-semibold">{matchCount}</span>-টা transaction মুছে যাবে।
          </p>
          <p className="mt-3 text-xs text-muted">
            চালিয়ে যাওয়ার আগে একটা নিরাপত্তা-ব্যাকআপ ডিভাইসে ডাউনলোড হবে। ব্যাকআপ ব্যর্থ হলে ডিলিট এগোবে না।
          </p>
          {error && (
            <p role="alert" className="mt-3 text-xs text-expense">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleBackup()}
            disabled={backupBusy}
            className="mt-4 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-60"
          >
            {backupBusy ? 'Backing up…' : '☁️ Back up now & Continue'}
          </button>
          <button
            type="button"
            onClick={() => setStep('filter')}
            disabled={backupBusy}
            className="mt-2 min-h-11 w-full rounded-lg border border-muted/40 text-sm text-fg disabled:opacity-60"
          >
            Back
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div>
          <p className="text-sm text-income">✅ Safety backup downloaded.</p>
          <p className="mt-3 text-sm text-fg">
            রেঞ্জ: <span className="font-medium">{label}</span> · <span className="font-semibold">{matchCount}</span>
            -টা transaction স্থায়ীভাবে মুছে যাবে। এই কাজ Undo করা যাবে না — শুধু নিরাপত্তা-ব্যাকআপ থেকে restore করে
            ফিরে আনা যাবে।
          </p>
          <label className="mt-4 block text-xs text-muted">
            নিশ্চিত করতে DELETE টাইপ করুন
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={busy}
              className="mt-1 min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-sm text-fg"
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-xs text-expense">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!backupOk || confirmText !== 'DELETE' || busy}
            className="mt-4 min-h-11 w-full rounded-lg bg-expense text-sm font-medium text-canvas disabled:opacity-40"
          >
            {busy ? 'Deleting…' : `Permanently Delete ${matchCount ?? ''} Transaction(s)`}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="mt-2 min-h-11 w-full rounded-lg border border-muted/40 text-sm text-fg disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}

      {step === 'done' && (
        <div>
          <p className="text-base font-semibold text-fg">✅ Delete Complete</p>
          <p className="mt-2 text-sm text-fg">{deletedCount} transaction(s) permanently deleted.</p>
          <p className="mt-1 text-xs text-muted">
            নিরাপত্তা-ব্যাকআপ ফাইল আপনার ডিভাইসে ডাউনলোড-ফোল্ডারে আছে — ভুল হলে সেটা দিয়ে Restore করতে পারবেন।
          </p>
          <button type="button" onClick={onClose} className="mt-6 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas">
            Done
          </button>
        </div>
      )}

      {step === 'error' && (
        <div>
          <p role="alert" className="text-sm text-fg">
            সমস্যা হয়েছে: {error}
          </p>
          <button type="button" onClick={() => setStep('filter')} className="mt-4 min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
            আবার শুরু করুন
          </button>
        </div>
      )}
    </FullScreenPage>
  );
}

import { useRef, useState } from 'react';
import type { SessionUser } from '../../../auth/AuthProvider';
import { getEnv } from '../../../config/env';
import { buildBackupPayload, parseBackupPayload, restoreFromBackup, type BackupPayload } from '../../../data/backupRepo';
import { isGoogleDriveConfigured, uploadBackupToDrive } from '../../../data/googleDrive';

const DRIVE_CLIENT_ID = getEnv().googleDriveClientId;

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

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

export default function BackupRestore({ user, onClose }: { user: SessionUser; onClose: () => void }) {
  const [driveBusy, setDriveBusy] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const driveReady = isGoogleDriveConfigured(DRIVE_CLIENT_ID);

  // --- JSON Restore state ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupPayload | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

  function pickRestoreFile() {
    setStatus(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const payload = parseBackupPayload(JSON.parse(text));
      setConfirmText('');
      setPendingRestore(payload);
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'Could not read that file.' });
    }
  }

  async function handleConfirmRestore() {
    if (!pendingRestore || confirmText !== 'RESTORE' || restoreBusy) return;
    setRestoreBusy(true);
    setStatus(null);
    try {
      // auto-backup বাধ্যতামূলক (Roadmap §৪.৮) — restore-এর ঠিক আগে বর্তমান ডেটার
      // একটা ডিভাইস-লোকাল কপি নেওয়া হয়, যাতে ভুল হলে রোলব্যাক সম্ভব।
      setRestoreProgress('Backing up current data first…');
      const safetyBackup = await buildBackupPayload(user.uid, user.email);
      downloadJson(safetyBackup, `hisheb_pre-restore-backup_${dateStamp()}.json`);
      await restoreFromBackup(user.uid, pendingRestore, (label) => setRestoreProgress(label));
      setPendingRestore(null);
      setStatus({ type: 'ok', text: 'Restore complete. All data replaced from the backup file.' });
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'Restore failed partway through — check your data.' });
    } finally {
      setRestoreBusy(false);
      setRestoreProgress(null);
    }
  }

  async function handleDeviceBackup() {
    if (deviceBusy) return;
    setStatus(null);
    setDeviceBusy(true);
    try {
      const payload = await buildBackupPayload(user.uid, user.email);
      downloadJson(payload, `hisheb_backup_${dateStamp()}.json`);
      setStatus({ type: 'ok', text: 'Backup downloaded.' });
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'Backup failed.' });
    } finally {
      setDeviceBusy(false);
    }
  }

  async function handleDriveBackup() {
    if (!driveReady || driveBusy) return;
    setStatus(null);
    setDriveBusy(true);
    try {
      const payload = await buildBackupPayload(user.uid, user.email);
      await uploadBackupToDrive(DRIVE_CLIENT_ID, payload);
      setStatus({ type: 'ok', text: 'Backed up to Google Drive.' });
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'Drive backup failed.' });
    } finally {
      setDriveBusy(false);
    }
  }

  // --- Confirmation screen (replaces the main sheet content while pending) ---
  if (pendingRestore) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
        <div className="w-full max-w-sm rounded-t-2xl bg-canvas p-5 sm:rounded-2xl">
          <h2 className="text-sm font-semibold text-fg">Restore from JSON?</h2>
          <p className="mt-2 text-xs text-muted">
            Backup date: {new Date(pendingRestore.backupTime).toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-expense">
            This replaces ALL current app data with the contents of this file. A safety backup of your current data
            downloads to this device first. This cannot be undone — recovery means restoring that safety backup.
          </p>
          {restoreProgress && <p className="mt-3 text-xs text-muted">{restoreProgress}</p>}
          {status?.type === 'error' && <p className="mt-2 text-xs text-expense">{status.text}</p>}
          <label className="mt-4 block text-xs text-muted">
            Type RESTORE to confirm
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={restoreBusy}
              className="mt-1 min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-sm text-fg"
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingRestore(null);
                setStatus(null);
              }}
              disabled={restoreBusy}
              className="min-h-11 flex-1 rounded-lg bg-surface text-sm font-medium text-fg disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmRestore()}
              disabled={confirmText !== 'RESTORE' || restoreBusy}
              className="min-h-11 flex-1 rounded-lg bg-expense text-sm font-medium text-canvas disabled:opacity-60"
            >
              {restoreBusy ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl bg-canvas p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-fg">Backup / Restore</h2>
        <p className="mt-1 text-xs text-muted">To restore from a Spendee CSV, use Menu → Import Spendee CSV (same duplicate-safe importer). Reports: Overview tab.</p>
        {status && (
          <p className={`mt-3 text-xs ${status.type === 'ok' ? 'text-income' : 'text-expense'}`}>{status.text}</p>
        )}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => void handleDriveBackup()}
            disabled={!driveReady || driveBusy}
            className="min-h-11 w-full rounded-lg bg-primary px-4 text-left text-sm font-medium text-canvas disabled:opacity-60"
          >
            {driveBusy ? 'Backing up…' : '☁️ Back up to Google Drive'}
          </button>
          {!driveReady && <p className="text-xs text-muted">Google Drive backup isn't set up for this build yet.</p>}
          <button
            type="button"
            onClick={() => void handleDeviceBackup()}
            disabled={deviceBusy}
            className="min-h-11 w-full rounded-lg border border-muted/40 px-4 text-left text-sm text-fg disabled:opacity-60"
          >
            {deviceBusy ? 'Preparing…' : '📲 Download Backup to Device'}
          </button>
          <button
            type="button"
            onClick={pickRestoreFile}
            className="min-h-11 w-full rounded-lg border border-muted/40 px-4 text-left text-sm text-fg"
          >
            📤 Restore from JSON
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => void handleFileSelected(e)} />
        </div>
        <button type="button" onClick={onClose} className="mt-4 min-h-11 w-full rounded-lg bg-surface text-sm font-medium text-fg">
          Close
        </button>
      </div>
    </div>
  );
}

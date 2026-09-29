// Excel "Monthly Statement" শীট → netWorthSnapshots/{yyyymm} monthly backfill (P4, Checklist P4,
// Overview → Net Worth Trend chart history)। ImportExcelHistorical.tsx-এর pick→review→done→error প্যাটার্ন
// reuse করা হয়েছে। শুধু chart-এর জন্য — Cross-check কখনো এই ডেটা ব্যবহার করবে না (C7, Architecture Plan §৪
// crossCheck.ts)। owner-এর নিজে "Update This Month's Balance" দিয়ে নেওয়া বিদ্যমান snapshot (Aug ২০২৬
// baseline সহ) কখনো overwrite হয় না — existing yyyymm-দের মধ্যে সবচেয়ে ছোটটাই exclusive upper-bound।
import { useState } from 'react';
import * as XLSX from 'xlsx';
import FullScreenPage from '../../common/FullScreenPage';
import { parseMonthlyNetWorthSnapshots, type MonthlySnapshotRow } from '../../../lib/excelMigration';
import { getExistingNetWorthYyyymms, setNetWorthSnapshot } from '../../../data/netWorthRepo';
import { formatAmount } from '../../../lib/format';

const MIN_YYYYMM = '2025-01';
// DF11 (Checklist "ঙ"/"ঘ" ৬): Jul ২০২৬-এর Excel Deviation-অমিল এখনো root-cause-confirmed না — chart-এ দেখাবে
// কিন্তু "unverified" চিহ্নসহ। Aug ২০২৬-এর অমিলও আছে, কিন্তু সেই মাসের doc আগে থেকেই owner-এর নিজের
// baseline (620,146) — এই importer সেটা কখনো ছোঁবে না (নিচের exclusiveMaxYyyymm লজিক দ্রষ্টব্য)।
const UNVERIFIED_YYYYMM = ['2026-07'];

type Step = 'pick' | 'review' | 'done' | 'error';

export default function ImportExcelMonthlySnapshots({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<MonthlySnapshotRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [protectedCount, setProtectedCount] = useState(0);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const existing = await getExistingNetWorthYyyymms(uid);
      const existingSet = new Set(existing);
      // বিদ্যমান সবচেয়ে ছোট yyyymm-ই exclusive upper-bound — owner-এর নিজে-নেওয়া কোনো baseline (Aug ২০২৬
      // সহ) কখনো ছোঁয়া হয় না, ভবিষ্যতে আরও পুরনো baseline যোগ হলেও এই লজিক নিরাপদ থাকে।
      const minExisting = existing.length > 0 ? existing.reduce((a, b) => (a < b ? a : b)) : '9999-12';

      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const res = parseMonthlyNetWorthSnapshots(wb, {
        minYyyymm: MIN_YYYYMM,
        exclusiveMaxYyyymm: minExisting,
        unverifiedYyyymm: UNVERIFIED_YYYYMM,
      });
      if (res.errors.length) {
        setError(res.errors.join(' · '));
        setStep('error');
        return;
      }
      // দ্বিতীয় safety-net: parse-রেঞ্জের বাইরে হলেও কোনো yyyymm ইতিমধ্যে থাকলে বাদ (overwrite-protection)
      const filtered = res.rows.filter((r) => !existingSet.has(r.yyyymm));
      if (filtered.length === 0) {
        setError('আমদানিযোগ্য কোনো নতুন মাস পাওয়া যায়নি (সব হয় বিদ্যমান, নয় ফাঁকা/০)');
        setStep('error');
        return;
      }
      setRows(filtered);
      setSkippedCount(res.skipped.length);
      setProtectedCount(res.rows.length - filtered.length);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel file পড়া যায়নি');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    setBusy(true);
    setError('');
    try {
      for (const r of rows) {
        await setNetWorthSnapshot(uid, r.yyyymm, r.totalDepositMinor, r.snapshotDate, r.unverified);
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
    <FullScreenPage title="Migrate Monthly Net Worth History" onBack={onClose}>
      {step === 'pick' && (
        <div>
          <p className="text-sm text-muted">
            সর্বশেষ Excel (.xlsx) বেছে নিন — "Monthly Statement" শীটের প্রতিটা মাসের "Total Deposit" কলাম দিয়ে
            পুরনো মাসগুলোর netWorthSnapshots ব্যাকফিল হবে (শুধু Overview-এর Net Worth Trend chart-এর জন্য,
            Cross-check-এ ধরা হবে না)। যেসব মাসের doc আগে থেকেই আছে (যেমন owner-এর Aug ২০২৬ baseline) সেগুলো
            কখনো overwrite হবে না।
          </p>
          <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={(e) => void handleFile(e.target.files)} className="mt-4 block text-sm text-fg" />
          {busy && <p className="mt-4 text-sm text-muted">Reading…</p>}
        </div>
      )}
      {step === 'review' && (
        <div>
          <p className="text-sm text-fg">{rows.length} month(s) ready</p>
          {(skippedCount > 0 || protectedCount > 0) && (
            <p className="mt-1 text-xs text-muted">
              {skippedCount > 0 && `${skippedCount}টা মাস ফাঁকা/০ বলে বাদ। `}
              {protectedCount > 0 && `${protectedCount}টা মাস বিদ্যমান doc বলে বাদ (overwrite হয়নি)।`}
            </p>
          )}
          <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.yyyymm} className="flex items-center justify-between rounded-lg border border-muted/30 p-3 text-sm">
                <span className="text-fg">
                  {r.yyyymm}
                  {r.unverified && <span className="ml-2 text-xs text-muted">⚠️ unverified (DF11)</span>}
                </span>
                <span className="text-muted">{formatAmount(r.totalDepositMinor)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setStep('pick')} disabled={busy} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">Back</button>
            <button type="button" onClick={() => void confirmImport()} disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-40">
              Import {rows.length}
            </button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div>
          <p className="text-base font-semibold text-fg">✅ Import Complete</p>
          <p className="mt-2 text-sm text-fg">{rows.length}টা মাসের netWorthSnapshots বসানো হয়েছে</p>
          <button type="button" onClick={onClose} className="mt-6 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas">Done</button>
        </div>
      )}
      {step === 'error' && (
        <div>
          <p role="alert" className="text-sm text-fg">{error}</p>
          <button type="button" onClick={() => setStep('pick')} className="mt-4 min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">Try again</button>
        </div>
      )}
    </FullScreenPage>
  );
}

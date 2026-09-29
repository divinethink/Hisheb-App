// Excel → historicalYearlyTotals one-time migration (P4, Architecture Plan §২/C1/C17)। pick→review→done→error।
import { useState } from 'react';
import * as XLSX from 'xlsx';
import FullScreenPage from '../../common/FullScreenPage';
import { parseHistoricalYearly, type HistoricalYearRow } from '../../../lib/excelMigration';
import { setHistoricalYearlyTotal } from '../../../data/historicalRepo';
import { formatAmount } from '../../../lib/format';

// ২০২৬+ লাইভ transactions থেকে আসে — historical doc বানানো হবে না
const EXCLUDE_FROM = 2026;
type Step = 'pick' | 'review' | 'done' | 'error';

export default function ImportExcelHistorical({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<HistoricalYearRow[]>([]);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const res = parseHistoricalYearly(wb, [2026, 2027, 2028, 2029, 2030].filter((y) => y >= EXCLUDE_FROM));
      if (res.errors.length || res.rows.length === 0) {
        setError(res.errors.join(' · ') || 'কোনো বছর পাওয়া যায়নি');
        setStep('error');
        return;
      }
      setRows(res.rows);
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
      for (const r of rows) await setHistoricalYearlyTotal(uid, r);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenPage title="Migrate Historical Yearly Totals" onBack={onClose}>
      {step === 'pick' && (
        <div>
          <p className="text-sm text-muted">
            সর্বশেষ Excel (.xlsx) বেছে নিন — "Yearly Statement" (২০২৩–২০২৫) ও "Monthly Statement" শীট পড়া হবে।
            একই বছর আবার import করলে আগের doc overwrite হয় (duplicate না)।
          </p>
          <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={(e) => void handleFile(e.target.files)} className="mt-4 block text-sm text-fg" />
          {busy && <p className="mt-4 text-sm text-muted">Reading…</p>}
        </div>
      )}
      {step === 'review' && (
        <div>
          <p className="text-sm text-fg">{rows.length} year(s) ready</p>
          <div className="mt-3 space-y-2">
            {rows.map((r) => (
              <div key={r.year} className="rounded-lg border border-muted/30 p-3 text-sm text-fg">
                <div className="font-medium">{r.year}</div>
                <div className="text-muted">Income: {formatAmount(r.totalIncomeMinor)}</div>
                <div className="text-muted">Expense: {formatAmount(r.totalExpenseMinor)}</div>
                <div className="text-muted">
                  Deposit: {formatAmount(r.totalDepositMinor)} ({r.depositSource === 'monthly-december' ? 'Dec Monthly Statement' : 'Yearly sheet'})
                </div>
                {r.investmentIncomeExcludedMinor > 0 && (
                  <div className="text-xs text-muted">"বিনিয়োগ হতে" {formatAmount(r.investmentIncomeExcludedMinor)} Income থেকে বাদ (C1)</div>
                )}
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
          <p className="mt-2 text-sm text-fg">{rows.length}টা বছরের totals বসানো হয়েছে</p>
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

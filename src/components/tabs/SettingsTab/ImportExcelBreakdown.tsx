// Excel "Monthly Statement" → বিদ্যমান netWorthSnapshots-এ শুধু `breakdown` (Monthly History-র ভাঙা-হিসাব)।
// Total/snapshotDate কখনো বদলায় না; মিলে না এমন মাস (যেমন owner-নেওয়া Aug ২০২৬ baseline) অক্ষত থাকে।
// pick→review→done→error প্যাটার্ন (ImportExcelMonthlySnapshots-এর মতো)।
import { useState } from 'react';
import * as XLSX from 'xlsx';
import FullScreenPage from '../../common/FullScreenPage';
import { parseMonthlyBreakdowns, planBreakdownBackfill, type BackfillPlan } from '../../../lib/excelMigration';
import { getNetWorthSnapshots, setNetWorthBreakdown } from '../../../data/netWorthRepo';
import { formatAmount } from '../../../lib/format';

type Step = 'pick' | 'review' | 'done' | 'error';

export default function ImportExcelBreakdown({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<BackfillPlan>({ apply: [], skipped: [] });

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const parsed = parseMonthlyBreakdowns(wb);
      if (parsed.errors.length) throw new Error(parsed.errors.join(' · '));
      if (parsed.rows.length === 0) throw new Error('Excel থেকে কোনো মাস পড়া যায়নি (Monthly Statement-এর পাওনা/বাসায় জমা/Running Investment/ব্যাংক ঘর ফাঁকা বা সংরক্ষিত মান নেই?)');
      const existing = await getNetWorthSnapshots(uid);
      const p = planBreakdownBackfill(
        parsed.rows,
        existing.map((s) => ({ yyyymm: s.yyyymm, totalAssetsMinor: s.totalAssetsMinor, hasBreakdown: s.breakdown !== undefined })),
      );
      if (p.apply.length === 0) {
        throw new Error(
          `বসানোর মতো মাস নেই। Excel থেকে পড়া: ${parsed.rows.length}টা (${parsed.rows[0].yyyymm} – ${parsed.rows[parsed.rows.length - 1].yyyymm}); Net Worth snapshot: ${existing.length}টা। বাদ: ${p.skipped.slice(0, 8).map((s) => `${s.yyyymm} (${s.reason})`).join(', ')}`,
        );
      }
      setPlan(p);
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
      for (const r of plan.apply) {
        const accountsMinor = r.accounts.reduce((s, a) => s + a.balanceMinor, 0);
        await setNetWorthBreakdown(uid, r.yyyymm, {
          accountsMinor,
          receivableMinor: r.receivableMinor,
          investmentMinor: r.investmentMinor,
          homeDepositMinor: r.homeDepositMinor,
          gpfMinor: 0, // পুরনো Excel-এ GPF নেই (snapshot-total-ও GPF ছাড়া)
          accounts: r.accounts,
        });
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
    <FullScreenPage title="Migrate Monthly History Split" onBack={onClose}>
      {step === 'pick' && (
        <div>
          <p className="text-sm text-muted">
            সর্বশেষ Excel (.xlsx) বেছে নিন। "Monthly Statement" শীট থেকে প্রতি মাসের ব্যাংক, পাওনা, বাসায় জমা ও Running Investment
            বিদ্যমান মাসিক snapshot-এ ভাঙা-হিসাব হিসেবে যোগ হবে (Net Worth → Monthly History-র জন্য)। Total কখনো বদলাবে না;
            যে মাসের total Excel-এর সাথে মেলে না সেটা অক্ষত থাকবে।
          </p>
          <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={(e) => void handleFile(e.target.files)} className="mt-4 block text-sm text-fg" />
          {busy && <p className="mt-4 text-sm text-muted">Reading…</p>}
        </div>
      )}
      {step === 'review' && (
        <div>
          <p className="text-sm text-fg">{plan.apply.length} month(s) ready</p>
          {plan.skipped.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              বাদ: {plan.skipped.map((s) => `${s.yyyymm} (${s.reason})`).join(', ')}
            </p>
          )}
          <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
            {plan.apply.map((r) => (
              <div key={r.yyyymm} className="flex items-center justify-between rounded-lg border border-muted/30 p-3 text-sm">
                <span className="text-fg">{r.yyyymm}</span>
                <span className="text-muted">{formatAmount(r.excelTotalMinor)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setStep('pick')} disabled={busy} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">Back</button>
            <button type="button" onClick={() => void confirmImport()} disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-40">
              Import {plan.apply.length}
            </button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div>
          <p className="text-base font-semibold text-fg">✅ Import Complete</p>
          <p className="mt-2 text-sm text-fg">{plan.apply.length}টা মাসে ভাঙা-হিসাব বসানো হয়েছে</p>
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

// Excel "Monthly Statement" (মোট আয়/মোট ব্যয়) → বিদ্যমান netWorthSnapshots-এ শুধু `flow` — Overview → Yearly →
// "Monthly breakdown"-এ pre-app মাসের আয়/ব্যয় দেখানোর জন্য। শুধু historical-doc বছরে; Total/breakdown কখনো বদলায় না;
// আগে থেকে flow থাকা মাস অক্ষত। pick→review→done→error প্যাটার্ন (ImportExcelBreakdown-এর মতো)।
import { useState } from 'react';
import * as XLSX from 'xlsx';
import FullScreenPage from '../../common/FullScreenPage';
import { parseMonthlyFlow, planFlowBackfill, type FlowPlan } from '../../../lib/excelMigration';
import { getNetWorthSnapshots, setNetWorthFlow } from '../../../data/netWorthRepo';
import { useHistoricalTotals } from '../../../hooks/useData';
import { formatAmount } from '../../../lib/format';

type Step = 'pick' | 'review' | 'done' | 'error';

export default function ImportExcelMonthlyFlow({ uid, onClose }: { uid: string; onClose: () => void }) {
  const hist = useHistoricalTotals(uid);
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<FlowPlan>({ apply: [], skipped: [] });

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (hist.state.status !== 'ready') throw new Error('Yearly records এখনো লোড হয়নি — একটু পরে আবার চেষ্টা করুন');
      const years = hist.state.data.map((h) => h.year);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const parsed = parseMonthlyFlow(wb);
      if (parsed.errors.length) throw new Error(parsed.errors.join(' · '));
      const existing = await getNetWorthSnapshots(uid);
      const p = planFlowBackfill(
        parsed.rows,
        existing.map((s) => ({ yyyymm: s.yyyymm, hasFlow: s.flow !== undefined })),
        years,
      );
      if (p.apply.length === 0) throw new Error('বসানোর মতো কোনো মাস পাওয়া যায়নি (সব হয় আগেই আছে, নয় snapshot/yearly record নেই)');
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
      for (const r of plan.apply) await setNetWorthFlow(uid, r.yyyymm, { incomeMinor: r.incomeMinor, expenseMinor: r.expenseMinor });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenPage title="Migrate Monthly Income/Expense" onBack={onClose}>
      {step === 'pick' && (
        <div>
          <p className="text-sm text-muted">
            সর্বশেষ Excel (.xlsx) বেছে নিন। "Monthly Statement" শীটের মোট আয় ও মোট ব্যয় বিদ্যমান মাসিক snapshot-এ যোগ হবে (Overview → Yearly → Monthly breakdown-এর জন্য)।
            শুধু যে বছরের Yearly record আছে সেই বছর; Net Worth-এর কোনো সংখ্যা বদলাবে না।
          </p>
          <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={(e) => void handleFile(e.target.files)} className="mt-4 block text-sm text-fg" />
          {busy && <p className="mt-4 text-sm text-muted">Reading…</p>}
        </div>
      )}
      {step === 'review' && (
        <div>
          <p className="text-sm text-fg">{plan.apply.length} month(s) ready</p>
          {plan.skipped.length > 0 && (
            <p className="mt-1 text-xs text-muted">বাদ: {plan.skipped.map((s) => `${s.yyyymm} (${s.reason})`).join(', ')}</p>
          )}
          <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
            {plan.apply.map((r) => (
              <div key={r.yyyymm} className="flex items-center justify-between gap-2 rounded-lg border border-muted/30 p-3 text-sm">
                <span className="text-fg">{r.yyyymm}</span>
                <span className="text-right text-xs text-muted">
                  {formatAmount(r.incomeMinor)} / {formatAmount(r.expenseMinor)}
                </span>
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
          <p className="mt-2 text-sm text-fg">{plan.apply.length}টা মাসের আয়/ব্যয় বসানো হয়েছে</p>
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

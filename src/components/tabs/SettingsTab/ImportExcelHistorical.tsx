// Excel → historicalYearlyTotals one-time migration (P4, Architecture Plan §২/C1/C17)। pick→review→done→error।
import { useState } from 'react';
import * as XLSX from 'xlsx';
import FullScreenPage from '../../common/FullScreenPage';
import { parseHistoricalYearly, type HistoricalYearRow } from '../../../lib/excelMigration';
import { setHistoricalYearlyTotal } from '../../../data/historicalRepo';
import { formatAmount } from '../../../lib/format';
import { getCategoriesOnce } from '../../../data/catalogRepo';
import { matchCategory, mergeByKey } from '../../../lib/categoryMatch';

// ২০২৬+ লাইভ transactions থেকে আসে — historical doc বানানো হবে না
const EXCLUDE_FROM = 2026;
type Step = 'pick' | 'review' | 'done' | 'error';

export default function ImportExcelHistorical({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<HistoricalYearRow[]>([]);
  // খাত-মেলানো: Excel-নাম → অ্যাপের খাত ('' = Excel নামেই রাখো); sure=false হলে ⚠️ (owner যাচাই করবে)
  const [appCats, setAppCats] = useState<string[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [unsure, setUnsure] = useState<Set<string>>(new Set());

  // নির্বাচিত খাতে নাম বদলে একই খাতের সারি যোগ (ডাবল লাইন নয়); যোগফল মোটের সাথে না মিললে খাতওয়ারি লেখা হয় না
  const mappedFor = (r: HistoricalYearRow) => mergeByKey(r.categories.map((c) => ({ name: choice[c.name] || c.name, amountMinor: c.amountMinor })));
  const catSumOk = (r: HistoricalYearRow) => r.categories.length > 0 && r.categories.reduce((a, c) => a + c.amountMinor, 0) === r.totalExpenseMinor;

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
      const cats = await getCategoriesOnce(uid);
      const names = cats.filter((c) => c.type !== 'income').sort((a, b) => Number(a.archived) - Number(b.archived) || a.order - b.order).map((c) => c.name);
      const init: Record<string, string> = {};
      const warn = new Set<string>();
      for (const r of res.rows) {
        for (const c of r.categories) {
          if (c.name in init) continue;
          const m = matchCategory(c.name, names);
          init[c.name] = m.suggestion ?? '';
          if (!m.suggestion || !m.sure) warn.add(c.name);
        }
      }
      setAppCats(names);
      setChoice(init);
      setUnsure(warn);
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
      for (const r of rows) {
        await setHistoricalYearlyTotal(uid, { ...r, categoryTotals: catSumOk(r) ? mappedFor(r) : null });
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
                {r.categories.length > 0 && (
                  <div className={`text-xs ${catSumOk(r) ? 'text-muted' : 'text-expense'}`}>
                    {catSumOk(r) ? `খাতওয়ারি: ${mappedFor(r).length}টা খাত (যোগফল মোটের সাথে মিলেছে ✅)` : 'খাতওয়ারি যোগফল মোট ব্যয়ের সাথে মেলেনি — খাতওয়ারি বসবে না ❌'}
                  </div>
                )}
                {r.investmentIncomeExcludedMinor > 0 && (
                  <div className="text-xs text-muted">"বিনিয়োগ হতে" {formatAmount(r.investmentIncomeExcludedMinor)} Income থেকে বাদ (C1)</div>
                )}
              </div>
            ))}
          </div>
          {rows.some((r) => r.categories.length > 0) && (
            <div className="mt-4">
              <p className="text-sm font-medium text-fg">খাত মেলানো (Excel নাম → অ্যাপের খাত)</p>
              <p className="text-xs text-muted">একই খাতে একাধিক নাম গেলে যোগ হয়ে এক লাইনে আসবে। ⚠️ = অনিশ্চিত, যাচাই করুন।</p>
              <div className="mt-2 space-y-2">
                {[...new Set(rows.flatMap((r) => r.categories.map((c) => c.name)))].map((name) => (
                  <label key={name} className="flex items-center gap-2 text-xs text-fg">
                    <span className="w-2/5 min-w-0 break-words">{unsure.has(name) ? '⚠️ ' : ''}{name}</span>
                    <select
                      value={choice[name] ?? ''}
                      onChange={(e) => {
                        setChoice((c) => ({ ...c, [name]: e.target.value }));
                        setUnsure((u) => {
                          const n = new Set(u);
                          n.delete(name);
                          return n;
                        });
                      }}
                      className="min-h-11 min-w-0 flex-1 rounded-lg border border-muted/40 bg-canvas px-2 text-xs text-fg"
                    >
                      <option value="">(Excel নামেই রাখো)</option>
                      {appCats.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
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

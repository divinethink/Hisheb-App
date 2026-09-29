// Excel "Monthly Statement" শীট → Aug 2026 Account balance one-time seed (owner-approved, Roadmap §১৩.২
// Cutover-এর প্রথম netWorthSnapshots baseline)। ImportExcelInvestments.tsx-এর pick→review→done→error
// প্যাটার্ন reuse। Home Deposit ও netWorthSnapshot নিজে এখানে সেভ হয় না — Home Deposit ম্যানুয়ালি (per-fund
// split Excel-এ নেই) ও netWorthSnapshot বিদ্যমান "Update Balances" স্ক্রিন দিয়ে (live receivable/Running
// Investment/Home Deposit যোগ করে সঠিক Total Assets বসাতে, একই লজিক দুই জায়গায় duplicate না করতে)।
import { useState } from 'react';
import * as XLSX from 'xlsx';
import FullScreenPage from '../../common/FullScreenPage';
import { parseMonthlyAccountBalances, type AccountBalanceRow } from '../../../lib/excelMigration';
import { addAccount } from '../../../data/accountRepo';
import { setAccountBalance } from '../../../data/netWorthRepo';
import { formatAmount } from '../../../lib/format';
import { useAccounts } from '../../../hooks/useData';
import type { Account } from '../../../validation/accountSchema';

const MONTH_NAME = 'August';
const YYYYMM = '2026-08';
const SNAPSHOT_DATE = '2026-08-31';
// Excel-এর 5 কলামে নেই — biniyog.io Aug 2026-এ owner-confirmed ০ (Checklist "ঘ")
const EXTRA_ROWS: AccountBalanceRow[] = [{ label: 'Biniyog Wallet', balanceMinor: 0 }];

type Step = 'pick' | 'review' | 'done' | 'error';

function findExistingId(existing: Account[], label: string): string | null {
  const norm = label.trim().toLowerCase();
  return existing.find((a) => a.name.trim().toLowerCase() === norm)?.id ?? null;
}

export default function ImportExcelAccountBalances({ uid, onClose }: { uid: string; onClose: () => void }) {
  const accountsQ = useAccounts(uid);
  const existing = accountsQ.state.status === 'ready' ? accountsQ.state.data : [];

  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<AccountBalanceRow[]>([]);
  const [totalDepositMinor, setTotalDepositMinor] = useState<number | null>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const result = parseMonthlyAccountBalances(wb, MONTH_NAME);
      if (!result || result.accounts.length === 0) {
        setError(`"Monthly Statement" শীটে ${MONTH_NAME} row-এর Account কলামগুলো খুঁজে পাওয়া যায়নি`);
        setStep('error');
        return;
      }
      setRows([...result.accounts, ...EXTRA_ROWS]);
      setTotalDepositMinor(result.totalDepositMinor);
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
        const accountId = findExistingId(existing, r.label) ?? (await addAccount(uid, { name: r.label, currency: 'BDT', archived: false, zakatable: true, holder: null }));
        await setAccountBalance(uid, accountId, YYYYMM, r.balanceMinor, SNAPSHOT_DATE);
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
    <FullScreenPage title="Migrate Aug 2026 Account Balances" onBack={onClose}>
      {step === 'pick' && (
        <div>
          <p className="text-sm text-muted">
            owner-এর সর্বশেষ সংশোধিত Excel ফাইল ({'.xlsx'}) বেছে নিন — "Monthly Statement" শীটের {MONTH_NAME} 2026
            row-এর Account কলাম পড়া হবে ({SNAPSHOT_DATE}-এ snapshot হিসেবে বসবে)।
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={(e) => void handleFile(e.target.files)}
            className="mt-4 block text-sm text-fg"
          />
          {busy && <p className="mt-4 text-sm text-muted">Reading…</p>}
        </div>
      )}

      {step === 'review' && (
        <div>
          <p className="text-sm text-fg">{rows.length} account(s) ready — {MONTH_NAME} 2026 balance</p>
          {totalDepositMinor != null && (
            <p className="mt-1 text-xs text-muted">Sheet-এর নিজস্ব Total Deposit: {formatAmount(totalDepositMinor)} (cross-check-এর জন্য)</p>
          )}
          <div className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-muted/30 p-3">
                <span className="text-sm text-fg">{r.label}</span>
                <span className="text-sm text-muted">{formatAmount(r.balanceMinor)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            যে Account নাম আগে থেকে আছে তার balance আপডেট হবে; না থাকলে নতুন Account তৈরি হবে।
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setStep('pick')} disabled={busy} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
              Back
            </button>
            <button
              type="button"
              onClick={() => void confirmImport()}
              disabled={busy}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-40"
            >
              Import {rows.length}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div>
          <p className="text-base font-semibold text-fg">✅ Import Complete</p>
          <p className="mt-2 text-sm text-fg">{MONTH_NAME} 2026 balance বসানো হয়েছে {rows.length}টা Account-এ</p>
          <p className="mt-2 text-xs text-muted">
            এরপর: (১) Home Deposit-এ ২০২৬-এর opening entry ম্যানুয়ালি যোগ করুন, (২) Net Worth ট্যাব → "Update
            This Month's Balance" খুলে August 2026 বেছে Save & Snapshot চাপুন — তাতে প্রথম netWorthSnapshots
            baseline তৈরি হবে।
          </p>
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
            Retry
          </button>
        </div>
      )}
    </FullScreenPage>
  );
}

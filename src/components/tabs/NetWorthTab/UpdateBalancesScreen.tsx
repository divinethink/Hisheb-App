import { useMemo, useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import { setAccountBalance, setNetWorthSnapshot } from '../../../data/netWorthRepo';
import { accountsTotalMinor, parseBalanceToMinor, totalAssetsMinor } from '../../../lib/netWorthCalc';
import { depositNetAsOfMinor, receivableAsOfMinor, runningInvestmentAsOfMinor } from '../../../lib/ledgerAsOf';
import { gpfBalanceAsOfMinor } from '../../../lib/gpfCalc';
import { currentMonth, monthLabel, toDhakaDate } from '../../../lib/date';
import { formatAmount, formatNet } from '../../../lib/format';
import { minorToInput } from '../../../lib/money';
import type { Account } from '../../../validation/accountSchema';
import type { AccountBalance } from '../../../validation/netWorthSchema';
import type { Debt } from '../../../validation/debtSchema';
import type { Investment } from '../../../validation/investmentSchema';
import type { HomeDepositEntry } from '../../../validation/homeDepositSchema';
import type { GpfEntry } from '../../../validation/gpfSchema';

function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** yyyymm-এর শেষ দিন, "YYYY-MM-DD" — reminder fallback থেকে preselected মাসের জন্য Snapshot date ডিফল্ট (DF2)। */
function lastDayOfMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * মাস বদলালে Snapshot date-এর ডিফল্ট: সেই মাসে আগেই সেভ থাকলে তার তারিখ (re-save-এ তারিখ অক্ষত), নাহলে চলতি মাস হলে আজ,
 * অতীত মাস হলে মাসের শেষ দিন — backdated snapshot ভুলে "আজকের তারিখে" সেভ হয়ে as-of হিসাব না বিগড়ায়।
 */
function defaultSnapshotDate(month: string, balances: readonly AccountBalance[]): string {
  const saved = balances.find((b) => b.yyyymm === month);
  if (saved) return saved.snapshotDate;
  return month === currentMonth() ? toDhakaDate(new Date()) : lastDayOfMonth(month);
}

/** নির্দিষ্ট account-এর latest balance, ঐচ্ছিক yyyymm-cutoff (< before হলে) সহ — prefill ও prev-total-এর জন্য। */
function latestKnown(balances: readonly AccountBalance[], accountId: string, before?: string): number | null {
  let best: AccountBalance | null = null;
  for (const b of balances) {
    if (b.accountId !== accountId) continue;
    if (before !== undefined && b.yyyymm >= before) continue;
    if (!best || b.yyyymm > best.yyyymm) best = b;
  }
  return best ? best.balanceMinor : null;
}

export default function UpdateBalancesScreen({
  uid,
  accounts,
  balances,
  debts,
  investments,
  homeDeposits,
  gpfEntries,
  initialMonth,
  onBack,
}: {
  uid: string;
  accounts: Account[];
  balances: AccountBalance[];
  debts: Debt[];
  investments: Investment[];
  homeDeposits: HomeDepositEntry[];
  gpfEntries: GpfEntry[];
  /** reminder fallback থেকে এলে আগের মাস preselect (UI Mockup §৬.১) */
  initialMonth?: string;
  onBack: () => void;
}) {
  const [month, setMonth] = useState(() => initialMonth ?? currentMonth());
  // fallback (আগের মাস preselect) থেকে এলে Snapshot date ডিফল্ট সেই মাসের শেষ দিন — নাহলে আজ (DF2)
  const [snapshotDate, setSnapshotDate] = useState(() => defaultSnapshotDate(initialMonth ?? currentMonth(), balances));
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const a of accounts) {
      const saved = initialMonth ? balances.find((b) => b.accountId === a.id && b.yyyymm === initialMonth) : undefined;
      const v = saved ? saved.balanceMinor : latestKnown(balances, a.id);
      init[a.id] = v === null ? '' : minorToInput(v);
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleMonthChange(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSnapshotDate(defaultSnapshotDate(next, balances));
    // এই মাসে আগেই সেভ করা balance থাকলে সেটাই দেখাও, নাহলে latest-known অক্ষত থাকে
    setValues((prev) => {
      const out = { ...prev };
      for (const a of accounts) {
        const saved = balances.find((b) => b.accountId === a.id && b.yyyymm === next);
        if (saved) out[a.id] = minorToInput(saved.balanceMinor);
      }
      return out;
    });
  }

  const parsed = useMemo(() => {
    const out: { accountId: string; minor: number | null }[] = [];
    for (const a of accounts) out.push({ accountId: a.id, minor: parseBalanceToMinor(values[a.id] ?? '') });
    return out;
  }, [accounts, values]);

  const accTotal = accountsTotalMinor(parsed.filter((p) => p.minor !== null).map((p) => ({ balanceMinor: p.minor! })));
  // সব ledger উপাদান Snapshot date পর্যন্ত as-of (তারিখওয়ালা repayment/deposit/GPF) — Account balance-এর সাথে একই তারিখ,
  // তাই backdated snapshot-এ পরের তারিখের ধার/ইনভেস্টমেন্ট ঢোকে না (Cross-check baseline নির্ভুল)।
  const receivable = receivableAsOfMinor(debts, snapshotDate);
  const runningInv = runningInvestmentAsOfMinor(investments, snapshotDate);
  const homeDepositNet = depositNetAsOfMinor(homeDeposits, snapshotDate);
  const gpfBalance = gpfBalanceAsOfMinor(gpfEntries, snapshotDate);
  const newTotal = totalAssetsMinor({
    accountsTotalMinor: accTotal,
    receivableTotalMinor: receivable,
    runningInvestmentTotalMinor: runningInv,
    homeDepositNetMinor: homeDepositNet,
    gpfBalanceMinor: gpfBalance,
  });

  const prevAccTotal = accounts.reduce((s, a) => s + (latestKnown(balances, a.id, month) ?? 0), 0);
  const changeVsLast = accTotal - prevAccTotal;

  const allFilled = parsed.every((p) => p.minor !== null);

  async function handleSave() {
    if (!allFilled) {
      setError('Enter a valid amount for every account.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const p of parsed) {
        await setAccountBalance(uid, p.accountId, month, p.minor!, snapshotDate);
      }
      await setNetWorthSnapshot(uid, month, newTotal, snapshotDate);
      onBack();
    } catch {
      setError('Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FullScreenPage
      title="Update Balances"
      onBack={onBack}
      footer={
        <>
          <button type="button" onClick={onBack} className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm text-fg">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !allFilled}
            className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save & Snapshot'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Month</span>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Previous month" onClick={() => handleMonthChange(-1)} className="min-h-11 min-w-11 text-fg">
              ‹
            </button>
            <span className="text-fg">{monthLabel(month)}</span>
            <button type="button" aria-label="Next month" onClick={() => handleMonthChange(1)} className="min-h-11 min-w-11 text-fg">
              ›
            </button>
          </div>
        </div>

        <label className="flex items-center justify-between text-sm">
          <span className="text-muted">Snapshot date</span>
          <input
            type="date"
            lang="en-GB"
            value={snapshotDate}
            onChange={(e) => setSnapshotDate(e.target.value)}
            className="min-h-11 rounded-lg border border-muted/40 bg-surface px-2 text-fg"
          />
        </label>

        <ul className="flex flex-col gap-3">
          {accounts.map((a) => {
            const prev = latestKnown(balances, a.id);
            return (
              <li key={a.id}>
                <label htmlFor={`bal-${a.id}`} className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-fg">{a.name}</span>
                  <span className="text-xs text-muted">{prev === null ? 'No previous balance' : `Prev ${formatAmount(prev)}`}</span>
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-muted/40 bg-surface px-3">
                  <span className="text-muted">BDT</span>
                  <input
                    id={`bal-${a.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={values[a.id] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value.replace(/[^0-9.,-]/g, '') }))}
                    className="min-h-11 w-full bg-transparent text-fg outline-none"
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-1 border-t border-muted/20 pt-3 text-sm">
          <p className="flex justify-between">
            <span className="text-muted">Accounts Total (new)</span>
            <span className="font-medium text-fg">{formatAmount(accTotal)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted">Change vs last snapshot</span>
            <span className="text-fg">{formatNet(changeVsLast)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted">+ Receivable, Investment, Home Deposit (as of snapshot date)</span>
            <span className="text-fg">{formatAmount(receivable + runningInv + homeDepositNet)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted">+ GPF (as of snapshot date)</span>
            <span className="text-fg">{formatAmount(gpfBalance)}</span>
          </p>
          <p className="flex justify-between border-t border-muted/20 pt-2">
            <span className="font-medium text-fg">Total Assets (new)</span>
            <span className="font-semibold text-fg">{formatAmount(newTotal)}</span>
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </FullScreenPage>
  );
}

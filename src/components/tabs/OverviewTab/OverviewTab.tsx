import { useState } from 'react';
import { Download } from 'lucide-react';
import { AllTimeView, MonthlyView, YearlyView } from './OverviewViews';
import { useHistoricalTotals } from '../../../hooks/useData';
import { getAllTransactions } from '../../../data/transactionRepo';
import { subscribeDebts } from '../../../data/debtRepo';
import { subscribeInvestments } from '../../../data/investmentRepo';
import { subscribeFunds, subscribeHomeDeposits } from '../../../data/homeDepositRepo';
import { subscribeGpfEntries } from '../../../data/gpfRepo';
import { subscribeAccounts } from '../../../data/accountRepo';
import { subscribeAccountBalances, subscribeNetWorthSnapshots } from '../../../data/netWorthRepo';
import { subscribeHistoricalTotals } from '../../../data/historicalRepo';
import { currentMonth, toDhakaDate } from '../../../lib/date';
import type { Debt } from '../../../validation/debtSchema';
import type { Investment } from '../../../validation/investmentSchema';
import type { Fund, HomeDepositEntry } from '../../../validation/homeDepositSchema';
import type { GpfEntry } from '../../../validation/gpfSchema';
import type { Account } from '../../../validation/accountSchema';
import type { AccountBalance, NetWorthSnapshot } from '../../../validation/netWorthSchema';
import type { HistoricalYearlyTotal } from '../../../validation/historicalSchema';

type View = 'monthly' | 'yearly' | 'all';
const VIEWS: { key: View; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'all', label: 'All-Time' },
];

/** subscribeX (realtime) থেকে প্রথম snapshot নিয়ে সাথে সাথে unsubscribe — export-এর জন্য one-shot। */
function fetchOnce<T>(subscribe: (onData: (d: T) => void, onError: (e: Error) => void) => () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const unsub = subscribe(
      (d) => { unsub(); resolve(d); },
      (e) => { unsub(); reject(e); },
    );
  });
}

// P4: Monthly / Yearly / All-Time। একটাই Excel বাটন — পুরো Workbook (Monthly/Yearly/All-Time/Ledger/Net Worth) একবারে ডাউনলোড করে (P5)।
export default function OverviewTab({ uid }: { uid: string }) {
  const [view, setView] = useState<View>('monthly');
  const [exportBusy, setExportBusy] = useState(false);
  const hist = useHistoricalTotals(uid);
  // historical লোড না হওয়া পর্যন্ত doc-precedence (C17) অজানা — ভুল/double-count টোটাল না দেখিয়ে অপেক্ষা
  const historical = hist.state.status === 'ready' ? hist.state.data : null;

  async function handleExportWorkbook() {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const month = currentMonth();
      const [allTxs, historicalRows, snapshots, debts, investments, funds, homeDeposits, gpf, accounts, accountBalances] = await Promise.all([
        getAllTransactions(uid),
        fetchOnce<HistoricalYearlyTotal[]>((d, e) => subscribeHistoricalTotals(uid, d, undefined, e)),
        fetchOnce<NetWorthSnapshot[]>((d, e) => subscribeNetWorthSnapshots(uid, d, undefined, e)),
        fetchOnce<Debt[]>((d, e) => subscribeDebts(uid, d, undefined, e)),
        fetchOnce<Investment[]>((d, e) => subscribeInvestments(uid, d, undefined, e)),
        fetchOnce<Fund[]>((d, e) => subscribeFunds(uid, d, undefined, e)),
        fetchOnce<HomeDepositEntry[]>((d, e) => subscribeHomeDeposits(uid, d, undefined, e)),
        fetchOnce<GpfEntry[]>((d, e) => subscribeGpfEntries(uid, d, undefined, e)),
        fetchOnce<Account[]>((d, e) => subscribeAccounts(uid, d, undefined, e)),
        fetchOnce<AccountBalance[]>((d, e) => subscribeAccountBalances(uid, d, undefined, e)),
      ]);
      const { buildFullReportWorkbook, downloadWorkbook } = await import('../../../lib/excelReport');
      const wb = buildFullReportWorkbook({
        today: toDhakaDate(new Date()),
        txs: allTxs,
        historical: historicalRows,
        snapshots,
        debts,
        investments,
        funds,
        homeDeposits,
        gpf,
        accounts,
        accountBalances,
      });
      downloadWorkbook(wb, `hisheb_report_${month}.xlsx`);
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-24">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <h1 className="text-lg font-semibold text-fg">Overview</h1>
        <button
          type="button"
          onClick={() => void handleExportWorkbook()}
          disabled={exportBusy}
          className="flex h-9 items-center gap-1 rounded-lg border border-muted/40 px-2.5 text-xs font-medium text-fg disabled:opacity-50"
        >
          <Download aria-hidden size={14} />
          {exportBusy ? '…' : 'Excel'}
        </button>
      </header>
      <div role="tablist" aria-label="Overview period" className="mx-4 grid grid-cols-3 gap-1 rounded-2xl border border-muted/10 bg-surface p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={`min-h-10 rounded-xl text-sm transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${view === v.key ? 'bg-canvas font-semibold text-primary shadow-sm' : 'text-muted'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {hist.state.status === 'error' && (
        <div role="alert" className="m-4 rounded-2xl border border-muted/10 bg-canvas p-4 text-center">
          <p className="text-sm text-fg">Couldn’t load yearly records.</p>
          <button type="button" onClick={hist.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">Retry</button>
        </div>
      )}
      {hist.state.status === 'loading' && <div className="mx-4 mt-4 h-24 animate-pulse rounded-2xl border border-muted/10 bg-canvas" aria-hidden />}
      {historical && view === 'monthly' && <MonthlyView uid={uid} historical={historical} />}
      {historical && view === 'yearly' && <YearlyView uid={uid} historical={historical} />}
      {historical && view === 'all' && <AllTimeView uid={uid} historical={historical} />}
    </div>
  );
}

import { lazy, Suspense, useState } from 'react';
import { Download, SlidersHorizontal } from 'lucide-react';
import { AllTimeView, MonthlyView, YearlyView } from './OverviewViews';
import { useHistoricalTotals, useSettings } from '../../../hooks/useData';
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

const OverviewLayoutScreen = lazy(() => import('../SettingsTab/OverviewLayoutScreen'));

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
  // ব্যবহারকারী ট্যাব না চাপা পর্যন্ত Customize-এর "Open Overview on" মানা হয়
  const [picked, setPicked] = useState<View | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const settings = useSettings(uid);
  const defaultTab = settings.state.status === 'ready' ? settings.state.data.overviewLayout.defaultTab : 'monthly';
  const view: View = picked ?? (defaultTab === 'alltime' ? 'all' : defaultTab);
  const setView = setPicked;
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
      {/* হেডার + ট্যাব স্টিকি; মোট উচ্চতা ৬rem (h-12 + h-12) — PeriodNav-এর top-24 এর সাথে মিলিয়ে রাখা */}
      <div className="sticky top-0 z-20 bg-page">
      <header className="flex h-12 items-center justify-between gap-2 px-4">
        <h1 className="text-xl font-semibold text-fg">Overview</h1>
        <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Customize Overview"
          onClick={() => setCustomizeOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-muted/30 bg-canvas text-fg shadow-sm"
        >
          <SlidersHorizontal aria-hidden size={15} />
        </button>
        <button
          type="button"
          onClick={() => void handleExportWorkbook()}
          disabled={exportBusy}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-muted/30 bg-canvas px-3 text-xs font-medium text-fg shadow-sm disabled:opacity-50"
        >
          <Download aria-hidden size={14} />
          {exportBusy ? '…' : 'Excel'}
        </button>
        </div>
      </header>
      <div className="h-12 px-4">
      <div role="tablist" aria-label="Overview period" className="grid h-11 grid-cols-3 gap-1 rounded-2xl border border-muted/10 bg-surface p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={`h-full rounded-xl text-sm transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${view === v.key ? 'bg-canvas font-semibold text-primary shadow-sm' : 'text-muted'}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      </div>
      </div>

      {hist.state.status === 'error' && (
        <div role="alert" className="m-4 rounded-2xl border border-muted/10 bg-canvas p-4 text-center">
          <p className="text-sm text-fg">Couldn’t load yearly records.</p>
          <button type="button" onClick={hist.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">Retry</button>
        </div>
      )}
      {hist.state.status === 'loading' && <div className="mx-4 mt-4 h-24 animate-pulse rounded-2xl border border-muted/10 bg-canvas" aria-hidden />}
      {historical && settings.state.status !== 'loading' && view === 'monthly' && <MonthlyView uid={uid} historical={historical} />}
      {historical && settings.state.status !== 'loading' && view === 'yearly' && <YearlyView uid={uid} historical={historical} />}
      {historical && settings.state.status !== 'loading' && view === 'all' && <AllTimeView uid={uid} historical={historical} />}
      {customizeOpen && (
        <Suspense fallback={null}>
          <OverviewLayoutScreen uid={uid} onClose={() => setCustomizeOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Info, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import SkeletonLoader from '../../common/SkeletonLoader';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';
import CategoryIcon from '../../common/CategoryIcon';
import AccountSheet from './AccountSheet';
import UpdateBalancesScreen from './UpdateBalancesScreen';
import CrossCheckView from './CrossCheckView';
import MonthlyHistory from './MonthlyHistory';
import PastMonthView, { MonthStepper } from './PastMonthView';
import {
  useAccountBalances,
  useAccounts,
  useDebts,
  useGpfEntries,
  useHomeDeposits,
  useInvestments,
  useNetWorthSnapshots,
  useSettings,
} from '../../../hooks/useData';
import { accountsTotalMinor, latestBalanceByAccount, liveBasisDate, totalAssetsMinor } from '../../../lib/netWorthCalc';
import { countLedgerChangesAfter, depositNetAsOfMinor, receivableAsOfMinor, runningInvestmentAsOfMinor } from '../../../lib/ledgerAsOf';
import { pickSnapshotPair } from '../../../lib/crossCheck';
import { gpfBalanceAsOfMinor } from '../../../lib/gpfCalc';
import { currentMonth, formatDisplayDate, shiftMonth, toDhakaDate } from '../../../lib/date';
import { accountsByMonth, earliestSnapshotMonth, monthDetail } from '../../../lib/historyCalc';
import { formatAmount, formatNet } from '../../../lib/format';
import type { Account } from '../../../validation/accountSchema';
import type { AccountBalance } from '../../../validation/netWorthSchema';
import type { Debt } from '../../../validation/debtSchema';
import type { Investment } from '../../../validation/investmentSchema';
import type { GpfEntry } from '../../../validation/gpfSchema';
import type { HomeDepositEntry } from '../../../validation/homeDepositSchema';

const NO_BAL: AccountBalance[] = [];
const NO_DEBTS: Debt[] = [];
const NO_INV: Investment[] = [];
const NO_GPF: GpfEntry[] = [];
const NO_DEP: HomeDepositEntry[] = [];

// P3-5: Accounts list + latest balances + Total Assets breakdown + Update Balances (§৬/§৬.১)।
// Cross-check Summary → Details (P4, CrossCheckView) — Mockup §৬/§৬.২।
// UI Polish Step ১: শীর্ষে Total Assets hero-card (Overview-এর ট্রেন্ড চার্ট থেকে আলাদা, owner-approved)।
export default function NetWorthTab({
  uid,
  updateRequest = null,
  onUpdateRequestHandled,
}: {
  uid: string;
  updateRequest?: { month: string } | null;
  onUpdateRequestHandled?: () => void;
}) {
  const acc = useAccounts(uid);
  const bal = useAccountBalances(uid);
  const debts = useDebts(uid);
  const investments = useInvestments(uid);
  const homeDeposits = useHomeDeposits(uid);
  const gpf = useGpfEntries(uid);
  const settings = useSettings(uid);
  const snaps = useNetWorthSnapshots(uid); // hero trend badge (UI Polish [1_5] ধাপ ২, item ১)
  const [sheet, setSheet] = useState<{ initial: Account | null } | null>(null);
  const [updateOpen, setUpdateOpen] = useState(updateRequest !== null);
  const [updateMonth, setUpdateMonth] = useState<string | undefined>(updateRequest?.month);
  const [crossOpen, setCrossOpen] = useState(false);
  // `‹ মাস ›` — ডিফল্ট চলতি মাস (লাইভ, অপরিবর্তিত); আগের মাস = সংরক্ষিত snapshot, read-only
  const [viewMonth, setViewMonth] = useState(() => currentMonth());

  // reminder ব্যানার থেকে আসা অনুরোধ: Update Balances খোলে (নির্দিষ্ট মাস preselect), অনুরোধ একবারই ব্যবহৃত
  useEffect(() => {
    if (updateRequest) {
      setUpdateMonth(updateRequest.month);
      setUpdateOpen(true);
      onUpdateRequestHandled?.();
    }
  }, [updateRequest, onUpdateRequestHandled]);

  const balances = bal.state.status === 'ready' ? bal.state.data : NO_BAL;
  const latestByAccount = useMemo(() => latestBalanceByAccount(balances), [balances]);
  // item ২: প্রতি account-এর history (yyyymm অনুযায়ী sorted) — "Updated [date]" subtext-এর উৎস।
  const historyByAccount = useMemo(() => {
    const map = new Map<string, AccountBalance[]>();
    for (const b of balances) {
      const arr = map.get(b.accountId);
      if (arr) arr.push(b);
      else map.set(b.accountId, [b]);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
    return map;
  }, [balances]);

  // breakdown-হীন মাসে (যেমন Aug/Sep ২০২৬) account-ভিত্তিক ভাঙা দেখানোর জন্য accountBalances থেকে derive — শুধু পড়া
  const derivedByMonth = useMemo(
    () => accountsByMonth(balances, acc.state.status === 'ready' ? acc.state.data : []),
    [balances, acc.state],
  );

  // gpf লোড না হওয়া পর্যন্ত snapshot-স্ক্রিন খোলে না — নইলে GPF ছাড়া ভুল Total Assets snapshot হয়ে যেত
  if (updateOpen && acc.state.status === 'ready' && gpf.state.status === 'ready') {
    return (
      <UpdateBalancesScreen
        uid={uid}
        accounts={acc.state.data}
        balances={balances}
        debts={debts.state.status === 'ready' ? debts.state.data : []}
        investments={investments.state.status === 'ready' ? investments.state.data : []}
        homeDeposits={homeDeposits.state.status === 'ready' ? homeDeposits.state.data : []}
        gpfEntries={gpf.state.status === 'ready' ? gpf.state.data : NO_GPF}
        initialMonth={updateMonth}
        onBack={() => {
          setUpdateOpen(false);
          setUpdateMonth(undefined);
        }}
      />
    );
  }

  const accTotal =
    acc.state.status === 'ready'
      ? accountsTotalMinor(acc.state.data.map((a) => ({ balanceMinor: latestByAccount.get(a.id) ?? 0 })))
      : 0;
  const debtList = debts.state.status === 'ready' ? debts.state.data : NO_DEBTS;
  const invList = investments.state.status === 'ready' ? investments.state.data : NO_INV;
  const depositList = homeDeposits.state.status === 'ready' ? homeDeposits.state.data : NO_DEP;
  const gpfList = gpf.state.status === 'ready' ? gpf.state.data : NO_GPF;
  // লাইভ Total Assets = Account (সর্বশেষ snapshot) + ledger উপাদান সেই snapshot-তারিখ পর্যন্ত (as-of)। মাসের মাঝে ধার দিয়ে
  // ledger আপডেট করলে (account balance আপডেটের আগে) Total Assets ভুয়া বাড়ে না — পরিবর্তন পরের "Update Balance"-এ ঢোকে।
  const basisDate = liveBasisDate(balances, toDhakaDate(new Date()));
  const receivable = receivableAsOfMinor(debtList, basisDate);
  const runningInv = runningInvestmentAsOfMinor(invList, basisDate);
  const homeDepositNet = depositNetAsOfMinor(depositList, basisDate);
  const gpfBalance = gpfBalanceAsOfMinor(gpfList, basisDate);
  const totalAssets = totalAssetsMinor({
    accountsTotalMinor: accTotal,
    receivableTotalMinor: receivable,
    runningInvestmentTotalMinor: runningInv,
    homeDepositNetMinor: homeDepositNet,
    gpfBalanceMinor: gpfBalance,
  });
  const pendingLedgerChanges =
    acc.state.status === 'ready' && acc.state.data.length > 0 && debts.state.status === 'ready' && investments.state.status === 'ready' && gpf.state.status === 'ready' && homeDeposits.state.status === 'ready'
      ? countLedgerChangesAfter(basisDate, { debts: debtList, investments: invList, deposits: depositList, gpf: gpfList })
      : 0;
  // hero-কার্ডের ভাঙা-হিসাব (Accounts / Investment / Home Deposit / Receivable+GPF) — আগের আলাদা breakdown-কার্ডের জায়গায়
  const parts = [
    { label: 'Accounts', value: accTotal, dot: 'bg-primary' },
    { label: 'Running Investment', value: runningInv, dot: 'bg-sky-400' },
    { label: 'Home Deposit (Net)', value: homeDepositNet, dot: 'bg-amber-400' },
    { label: 'Receivable + GPF', value: receivable + gpfBalance, dot: 'bg-violet-400' },
  ];
  const barTotal = parts.reduce((t, x) => t + Math.max(0, x.value), 0);
  const crossProps = { uid, liveTotalMinor: totalAssets, basisDate, debts: debtList, investments: invList, gpfEntries: gpfList, balances };

  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  // item ১: hero trend — আগের মাসের netWorthSnapshots-এর সাথে তুলনা (CrossCheckView-এর একই pickSnapshotPair reuse)।
  const prevSnapshot = snaps.state.status === 'ready' ? pickSnapshotPair(snaps.state.data, currentMonth()).previous : null;
  const heroDiff = prevSnapshot && prevSnapshot.totalAssetsMinor !== 0 ? totalAssets - prevSnapshot.totalAssetsMinor : null;
  const heroPct =
    heroDiff !== null && prevSnapshot ? Math.round((Math.abs(heroDiff) / Math.abs(prevSnapshot.totalAssetsMinor)) * 1000) / 10 : null;

  if (crossOpen) {
    return <CrossCheckView {...crossProps} mode="details" onBack={() => setCrossOpen(false)} />;
  }

  const nowMonth = currentMonth();
  const minMonth = snaps.state.status === 'ready' ? earliestSnapshotMonth(snaps.state.data) ?? nowMonth : nowMonth;
  const stepper = (
    <MonthStepper
      month={viewMonth}
      onPrev={() => setViewMonth((m) => shiftMonth(m, -1))}
      onNext={() => setViewMonth((m) => (shiftMonth(m, 1) > nowMonth ? nowMonth : shiftMonth(m, 1)))}
      prevDisabled={viewMonth <= minMonth}
      nextDisabled={viewMonth >= nowMonth}
    />
  );

  if (viewMonth < nowMonth) {
    return (
      <div className="h-full overflow-y-auto pb-24">
        <header className="px-4 pb-1 pt-3">
          <h1 className="text-lg font-semibold text-fg">Net Worth</h1>
        </header>
        {stepper}
        {snaps.state.status === 'loading' && <SkeletonLoader />}
        {snaps.state.status === 'error' && (
          <Card role="alert" className="m-4 p-4 text-center">
            <p className="text-sm text-fg">Couldn’t load snapshots.</p>
            <button type="button" onClick={snaps.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">Retry</button>
          </Card>
        )}
        {snaps.state.status === 'ready' && (
          <PastMonthView month={viewMonth} dateFormat={dateFormat} detail={monthDetail(snaps.state.data, viewMonth, acc.state.status === 'ready' ? acc.state.data.map((a) => a.name) : [], derivedByMonth.get(viewMonth) ?? [])} />
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-24">
      <header className="px-4 pb-1 pt-3">
        <h1 className="text-lg font-semibold text-fg">Net Worth</h1>
      </header>
      {stepper}

      {acc.state.status === 'loading' && <SkeletonLoader />}

      {acc.state.status === 'error' && (
        <Card role="alert" className="m-4 p-4 text-center">
          <p className="text-sm text-fg">Couldn’t load accounts.</p>
          <button type="button" onClick={acc.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
            Retry
          </button>
        </Card>
      )}

      {/* সর্বমোট Total Assets — সবার আগে, বড় করে (Design Philosophy §০: সংখ্যাই প্রধান)। ট্রেন্ড লাইন
          ইচ্ছাকৃতভাবে এখানে না — Overview → All-Time-এ (owner-approved)। */}
      {acc.state.status === 'ready' && (
        <Card className="mx-4 mb-3 p-4">
          <div className="flex items-start gap-3">
            <IconBadge icon={Wallet} tone="primary" size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Total Assets (Gross)</p>
              <p className="text-3xl font-semibold leading-tight text-fg">{formatAmount(totalAssets)}</p>
              {heroDiff !== null && heroPct !== null && (
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    heroDiff >= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
                  }`}
                >
                  {heroDiff >= 0 ? <TrendingUp aria-hidden size={12} /> : <TrendingDown aria-hidden size={12} />}
                  {formatNet(heroDiff)} ({heroPct}%) vs last month
                </span>
              )}
            </div>
          </div>
          {acc.state.data.length > 0 && (
            <div className="mt-4 border-t border-muted/10 pt-3">
              {barTotal > 0 && (
                <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full bg-muted/10" aria-hidden>
                  {parts.map((x) => (
                    <span key={x.label} className={x.dot} style={{ width: `${(Math.max(0, x.value) / barTotal) * 100}%` }} />
                  ))}
                </div>
              )}
              <dl className="flex flex-col gap-1 text-sm">
                {parts.map((x) => (
                  <div key={x.label} className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-muted">
                      <span aria-hidden className={`h-2 w-2 rounded-full ${x.dot}`} /> {x.label}
                    </dt>
                    <dd className="text-fg">{formatAmount(x.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>
      )}

      {pendingLedgerChanges > 0 && (
        <button
          type="button"
          onClick={() => setUpdateOpen(true)}
          className="mx-4 mb-3 flex min-h-11 w-[calc(100%-2rem)] items-start gap-2 rounded-2xl border border-muted/10 bg-canvas p-3 text-left text-xs text-muted shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Info aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span>
            Balances last updated {formatDisplayDate(basisDate, dateFormat)}. {pendingLedgerChanges} ledger change
            {pendingLedgerChanges === 1 ? '' : 's'} since then (loans, investments, deposits, GPF) will be counted when you update balances.
          </span>
        </button>
      )}

      {acc.state.status === 'ready' && (
        <>
          {acc.state.data.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <p className="text-fg">Add your first account/wallet.</p>
              <button
                type="button"
                onClick={() => setSheet({ initial: null })}
                className="min-h-11 rounded-lg bg-primary px-6 font-medium text-canvas"
              >
                Add account
              </button>
            </div>
          ) : (
            <>
              <Card className="mx-4 mb-3 overflow-hidden">
                <ul>
                  {acc.state.data.map((a) => {
                    const history = historyByAccount.get(a.id) ?? [];
                    const latestEntry = history[history.length - 1];
                    return (
                      <li key={a.id} className="border-t border-muted/10 first:border-t-0">
                        <button
                          type="button"
                          onClick={() => setSheet({ initial: a })}
                          className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          <CategoryIcon name={a.name} />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 break-words text-fg">{a.name}</span>
                            <span className="block text-xs text-muted">
                              {a.holder ? `${a.holder} · ` : ''}
                              {latestEntry ? `Updated ${formatDisplayDate(latestEntry.snapshotDate, dateFormat)}` : 'Not updated yet'}
                            </span>
                          </span>
                          <span className="shrink-0 font-medium text-fg">
                            {latestByAccount.has(a.id) ? (
                              formatAmount(latestByAccount.get(a.id)!)
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <div className="flex flex-col gap-2 px-4 pb-1">
                <button
                  type="button"
                  onClick={() => setSheet({ initial: null })}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-muted/40 text-sm text-muted"
                >
                  <Plus aria-hidden size={18} /> Add new account
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateOpen(true)}
                  disabled={gpf.state.status !== 'ready'}
                  className="min-h-11 w-full rounded-xl bg-primary text-sm font-medium text-canvas disabled:opacity-50"
                >
                  Update This Month’s Balance
                </button>
              </div>

              {debts.state.status === 'ready' && investments.state.status === 'ready' && gpf.state.status === 'ready' && (
                <CrossCheckView {...crossProps} mode="summary" onOpen={() => setCrossOpen(true)} />
              )}

              {snaps.state.status === 'ready' && (
                <MonthlyHistory snapshots={snaps.state.data} accountOrder={acc.state.data.map((a) => a.name)} dateFormat={dateFormat} derivedByMonth={derivedByMonth} />
              )}

            </>
          )}
        </>
      )}

      {sheet && <AccountSheet uid={uid} initial={sheet.initial} onClose={() => setSheet(null)} />}
    </div>
  );
}

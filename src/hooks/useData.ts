import { useRef, useState } from 'react';
import { subscribeTransactionsByMonth, subscribeTransactionsByRange } from '../data/transactionRepo';
import { subscribeCategories, subscribeLabels } from '../data/catalogRepo';
import { subscribeSettings } from '../data/settingsRepo';
import { subscribeAccounts } from '../data/accountRepo';
import { subscribeDebts } from '../data/debtRepo';
import { subscribeInvestments } from '../data/investmentRepo';
import { subscribeFunds, subscribeHomeDeposits } from '../data/homeDepositRepo';
import { subscribeGpfEntries } from '../data/gpfRepo';
import { subscribeCustomLedgers } from '../data/customLedgerRepo';
import { subscribeAccountBalances, subscribeNetWorthSnapshots } from '../data/netWorthRepo';
import { subscribeHistoricalTotals } from '../data/historicalRepo';
import { useLiveQuery } from './useLiveQuery';
import type { Transaction } from '../validation/transactionSchema';
import type { Category, Label } from '../validation/catalogSchemas';
import type { Settings } from '../validation/settingsSchema';
import type { Account } from '../validation/accountSchema';
import type { Debt } from '../validation/debtSchema';
import type { Investment } from '../validation/investmentSchema';
import type { Fund, HomeDepositEntry } from '../validation/homeDepositSchema';
import type { GpfEntry } from '../validation/gpfSchema';
import type { CustomLedger } from '../validation/customLedgerSchema';
import type { AccountBalance, NetWorthSnapshot } from '../validation/netWorthSchema';
import type { HistoricalYearlyTotal } from '../validation/historicalSchema';

export function useMonthTransactions(uid: string, yyyymm: string) {
  const [invalidCount, setInvalidCount] = useState(0);
  const seen = useRef(new Set<string>());
  const q = useLiveQuery<Transaction[]>(`tx:${uid}:${yyyymm}`, (onData, onError) =>
    subscribeTransactionsByMonth(
      uid,
      yyyymm,
      onData,
      (id) => {
        if (!seen.current.has(id)) {
          seen.current.add(id);
          setInvalidCount(seen.current.size);
        }
      },
      onError,
    ),
  );
  return { ...q, invalidCount };
}

export function useRangeTransactions(uid: string, start: string, end: string) {
  return useLiveQuery<Transaction[]>(`txr:${uid}:${start}:${end}`, (onData, onError) =>
    subscribeTransactionsByRange(uid, start, end, onData, undefined, onError),
  );
}

export function useCategories(uid: string) {
  return useLiveQuery<Category[]>(`cat:${uid}`, (d, e) => subscribeCategories(uid, d, e));
}
export function useLabels(uid: string) {
  return useLiveQuery<Label[]>(`lbl:${uid}`, (d, e) => subscribeLabels(uid, d, e));
}
export function useSettings(uid: string) {
  return useLiveQuery<Settings>(`settings:${uid}`, (d, e) => subscribeSettings(uid, d, e));
}
export function useAccounts(uid: string) {
  return useLiveQuery<Account[]>(`acc:${uid}`, (d, e) => subscribeAccounts(uid, d, undefined, e));
}
export function useDebts(uid: string) {
  return useLiveQuery<Debt[]>(`debts:${uid}`, (d, e) => subscribeDebts(uid, d, undefined, e));
}
export function useInvestments(uid: string) {
  return useLiveQuery<Investment[]>(`inv:${uid}`, (d, e) => subscribeInvestments(uid, d, undefined, e));
}
export function useFunds(uid: string) {
  return useLiveQuery<Fund[]>(`fund:${uid}`, (d, e) => subscribeFunds(uid, d, undefined, e));
}
export function useHomeDeposits(uid: string) {
  return useLiveQuery<HomeDepositEntry[]>(`hd:${uid}`, (d, e) => subscribeHomeDeposits(uid, d, undefined, e));
}
export function useGpfEntries(uid: string) {
  return useLiveQuery<GpfEntry[]>(`gpf:${uid}`, (d, e) => subscribeGpfEntries(uid, d, undefined, e));
}
export function useCustomLedgers(uid: string) {
  return useLiveQuery<CustomLedger[]>(`custledger:${uid}`, (d, e) => subscribeCustomLedgers(uid, d, undefined, e));
}
export function useAccountBalances(uid: string) {
  return useLiveQuery<AccountBalance[]>(`accbal:${uid}`, (d, e) => subscribeAccountBalances(uid, d, undefined, e));
}
export function useNetWorthSnapshots(uid: string) {
  return useLiveQuery<NetWorthSnapshot[]>(`nws:${uid}`, (d, e) => subscribeNetWorthSnapshots(uid, d, undefined, e));
}
export function useHistoricalTotals(uid: string) {
  return useLiveQuery<HistoricalYearlyTotal[]>(`hist:${uid}`, (d, e) => subscribeHistoricalTotals(uid, d, undefined, e));
}

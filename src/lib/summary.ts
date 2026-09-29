// মাসিক টোটাল: সবসময় লাইভ যোগফল (কোনো আলাদা store না, কোনো limit না)।
export interface TxLike {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amountMinor: number;
  occurredAt: { toDate(): Date };
}

export function summarize(txs: readonly TxLike[]) {
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const t of txs) {
    if (t.type === 'income') incomeMinor += t.amountMinor;
    else expenseMinor += t.amountMinor;
  }
  return { incomeMinor, expenseMinor, savingsMinor: incomeMinor - expenseMinor };
}

export interface DayGroup<T extends TxLike> {
  date: string;
  txs: T[];
  netMinor: number; // আয় − ব্যয়
}

/** তারিখ অনুযায়ী নতুন → পুরনো; দিনের ভেতরে occurredAt অনুযায়ী নতুন আগে */
export function groupByDate<T extends TxLike>(txs: readonly T[]): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const t of txs) {
    const arr = map.get(t.date);
    if (arr) arr.push(t);
    else map.set(t.date, [t]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => ({
      date,
      txs: [...list].sort((x, y) => y.occurredAt.toDate().getTime() - x.occurredAt.toDate().getTime()),
      netMinor: list.reduce((s, t) => s + (t.type === 'income' ? t.amountMinor : -t.amountMinor), 0),
    }));
}

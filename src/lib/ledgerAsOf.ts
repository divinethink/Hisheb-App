// Ledger-এর মাস/বছর-শেষ "as-of" হিসাব — Excel Monthly/Yearly Statement-এর মূলধন কলামের জন্য।
// pure, platform-independent (lib/ purity)। শুধু তারিখ-ফিল্টার; কোনো আলাদা aggregate store হয় না।
import type { Repayment } from './debtCalc';

export interface DebtAsOfLike {
  direction: 'owe_me' | 'i_owe';
  totalAmountMinor: number;
  date: string;
  repayments: readonly (Repayment & { date: string })[];
  receivableStatus: 'active' | 'doubtful' | 'forgiven';
  receivableStatusChangedAt: string | null;
}
export interface InvestmentAsOfLike {
  principalMinor: number;
  date: string;
  repayments: readonly Repayment[];
  investmentOutcome: 'running' | 'doubtful' | 'written_off';
  investmentOutcomeChangedAt: string | null;
}
export interface DepositAsOfLike {
  date: string;
  type: 'deposit' | 'withdrawal';
  amountMinor: number;
}

export function lastDayOfMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yyyymm}-${String(d).padStart(2, '0')}`;
}

const paidBy = (rs: readonly Repayment[], asOf: string) =>
  rs.filter((r) => r.date <= asOf).reduce((s, r) => s + r.amountMinor, 0);

/** asOf পর্যন্ত owe_me বকেয়া; asOf-এর আগেই "forgiven" হলে বাদ। */
export function receivableAsOfMinor(debts: readonly DebtAsOfLike[], asOf: string): number {
  return debts
    .filter((d) => d.direction === 'owe_me' && d.date <= asOf)
    .filter((d) => !(d.receivableStatus === 'forgiven' && (d.receivableStatusChangedAt === null || d.receivableStatusChangedAt <= asOf)))
    .reduce((s, d) => s + Math.max(0, d.totalAmountMinor - paidBy(d.repayments, asOf)), 0);
}

/** asOf পর্যন্ত Running Investment (max(0, principal − repaid)); asOf-এর আগেই "written_off" হলে বাদ। */
export function runningInvestmentAsOfMinor(investments: readonly InvestmentAsOfLike[], asOf: string): number {
  return investments
    .filter((i) => i.date <= asOf)
    .filter((i) => !(i.investmentOutcome === 'written_off' && (i.investmentOutcomeChangedAt === null || i.investmentOutcomeChangedAt <= asOf)))
    .reduce((s, i) => s + Math.max(0, i.principalMinor - paidBy(i.repayments, asOf)), 0);
}

/** asOf পর্যন্ত Total Investment / Investment Return (ফেরত মূলধন, principal-এ ক্যাপড) / Profit (closed-এর)। */
export function investmentTotalsAsOf(investments: readonly InvestmentAsOfLike[], asOf: string) {
  let principal = 0;
  let returned = 0;
  let profit = 0;
  for (const i of investments) {
    if (i.date > asOf) continue;
    const paid = paidBy(i.repayments, asOf);
    principal += i.principalMinor;
    returned += Math.min(paid, i.principalMinor);
    if (paid >= i.principalMinor) profit += paid - i.principalMinor;
  }
  return { principalMinor: principal, returnedMinor: returned, profitMinor: profit };
}

export function depositNetAsOfMinor(entries: readonly DepositAsOfLike[], asOf: string): number {
  return entries.filter((e) => e.date <= asOf).reduce((s, e) => s + (e.type === 'deposit' ? e.amountMinor : -e.amountMinor), 0);
}

/**
 * asOf-এর পরের ledger পরিবর্তনের সংখ্যা (নতুন ধার/ইনভেস্টমেন্ট, repayment, status-বদল, deposit/withdrawal, GPF entry)।
 * Net Worth ট্যাবে "এগুলো এখনো Total Assets-এ ধরা হয়নি" ব্যানারের জন্য — শুধু তারিখ-তুলনা, কোনো store না।
 */
export function countLedgerChangesAfter(
  asOf: string,
  l: {
    debts: readonly DebtAsOfLike[];
    investments: readonly InvestmentAsOfLike[];
    deposits: readonly DepositAsOfLike[];
    gpf: readonly { date: string }[];
  },
): number {
  let n = 0;
  for (const d of l.debts) {
    if (d.date > asOf) n++;
    else if (d.receivableStatusChangedAt !== null && d.receivableStatusChangedAt > asOf) n++;
    n += d.repayments.filter((r) => r.date > asOf).length;
  }
  for (const i of l.investments) {
    if (i.date > asOf) n++;
    else if (i.investmentOutcomeChangedAt !== null && i.investmentOutcomeChangedAt > asOf) n++;
    n += i.repayments.filter((r) => r.date > asOf).length;
  }
  n += l.deposits.filter((e) => e.date > asOf).length;
  n += l.gpf.filter((e) => e.date > asOf).length;
  return n;
}

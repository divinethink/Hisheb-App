// Net Worth অ্যাগ্রিগেশন — pure, platform-independent (lib/ purity, Architecture Plan §০/§২/§৪.৬)।
import { outstandingMinor, type Repayment } from './debtCalc';
import { runningMinor } from './investmentCalc';

export interface DebtLike {
  direction: 'owe_me' | 'i_owe';
  totalAmountMinor: number;
  repayments: readonly Repayment[];
  receivableStatus: 'active' | 'doubtful' | 'forgiven';
}

/** owe_me দিকের active/doubtful outstanding-এর যোগফল — forgiven বাদ (§৪.৬, §১৩)। */
export function receivableTotalMinor(debts: readonly DebtLike[]): number {
  return debts
    .filter((d) => d.direction === 'owe_me' && d.receivableStatus !== 'forgiven')
    .reduce((s, d) => s + outstandingMinor(d.totalAmountMinor, d.repayments), 0);
}

export interface InvestmentLike {
  principalMinor: number;
  repayments: readonly Repayment[];
  investmentOutcome: 'running' | 'doubtful' | 'written_off';
}

/** investmentOutcome≠"written_off" এন্ট্রির Running Investment যোগফল (C9, §৪.৬)। */
export function runningInvestmentTotalMinor(investments: readonly InvestmentLike[]): number {
  return investments
    .filter((i) => i.investmentOutcome !== 'written_off')
    .reduce((s, i) => s + runningMinor(i.principalMinor, i.repayments), 0);
}

export function accountsTotalMinor(balances: readonly { balanceMinor: number }[]): number {
  return balances.reduce((s, b) => s + b.balanceMinor, 0);
}

/** Total Assets (Gross) — i_owe কখনো বিয়োগ হয় না (C6, §৪.৬)। */
export function totalAssetsMinor(p: {
  accountsTotalMinor: number;
  receivableTotalMinor: number;
  runningInvestmentTotalMinor: number;
  homeDepositNetMinor: number;
  /** GPF ব্যালেন্স (as-of) — ledger মডিউল, transaction তৈরি করে না (Investment-এর মতো নীতি)। */
  gpfBalanceMinor: number;
}): number {
  return (
    p.accountsTotalMinor +
    p.receivableTotalMinor +
    p.runningInvestmentTotalMinor +
    p.homeDepositNetMinor +
    p.gpfBalanceMinor
  );
}

/** প্রতিটা account-এর সর্বোচ্চ yyyymm-এর balanceMinor-ই বর্তমান ব্যালেন্স (§২ accountBalances)। */
export function latestBalanceByAccount(
  balances: readonly { accountId: string; yyyymm: string; balanceMinor: number }[],
): Map<string, number> {
  const latest = new Map<string, { yyyymm: string; balanceMinor: number }>();
  for (const b of balances) {
    const cur = latest.get(b.accountId);
    if (!cur || b.yyyymm > cur.yyyymm) latest.set(b.accountId, { yyyymm: b.yyyymm, balanceMinor: b.balanceMinor });
  }
  return new Map([...latest].map(([id, v]) => [id, v.balanceMinor]));
}

/** Update Balances ফর্মের input parse — শূন্য/ঋণাত্মকও বৈধ (accountBalances.balanceMinor শুধু `is int`, §৩)। */
export function parseBalanceToMinor(input: string): number | null {
  const s = input.replace(/[,\s]/g, '');
  if (s === '' || s === '-') return null;
  const m = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const frac = (m[3] ?? '').padEnd(2, '0');
  const minor = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 100 + Number(frac || '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * লাইভ Total Assets-এর "as-of" তারিখ = প্রতিটা account-এর সর্বশেষ balance-snapshot-এর মধ্যে সবচেয়ে নতুন snapshotDate।
 * Receivable/Investment/Home Deposit/GPF এই তারিখ পর্যন্ত ধরা হয়, যাতে Account balance ও ledger একই তারিখের হয় —
 * মাসের মাঝে ধার/ইনভেস্টমেন্ট এন্ট্রি করলে (account আপডেটের আগে) Total Assets ভুয়া বাড়ে না।
 * কোনো balance না থাকলে বা তারিখ ভবিষ্যতে হলে today।
 */
export function liveBasisDate(
  balances: readonly { accountId: string; yyyymm: string; snapshotDate: string }[],
  today: string,
): string {
  const latest = new Map<string, { yyyymm: string; snapshotDate: string }>();
  for (const b of balances) {
    const cur = latest.get(b.accountId);
    if (!cur || b.yyyymm > cur.yyyymm) latest.set(b.accountId, { yyyymm: b.yyyymm, snapshotDate: b.snapshotDate });
  }
  let max = '';
  for (const v of latest.values()) if (v.snapshotDate > max) max = v.snapshotDate;
  return max === '' || max > today ? today : max;
}

// Snapshot Insight — pure, platform-independent (lib/ purity)। owner-request 2026-11-01:
// প্রতি snapshot-এ আগের snapshot-এর সাথে তুলনা — সম্পদ কোথায় বাড়ল/কমল, আয়-ব্যয়, Cross-check ফল ও সচেতনতার নোট।
// শুধু বিদ্যমান snapshot/accountBalances/transactions থেকে derive; কিছু লেখা হয় না, কোনো AI/বাইরের সেবায় ডেটা যায় না।
// ভাঙা-হিসাব (breakdown) না থাকা মাসে সংখ্যা বানানো হয় না: ৫-ভাগ → না থাকলে ২-ভাগ (Accounts / Ledger & others) → না থাকলে বাদ।
import type { CrossCheckResult } from './crossCheck';

export interface InsightSnapshot {
  yyyymm: string;
  totalAssetsMinor: number;
  snapshotDate: string;
  breakdown?: {
    accountsMinor: number;
    receivableMinor: number;
    investmentMinor: number;
    homeDepositMinor: number;
    gpfMinor: number;
    accounts?: readonly { name: string; balanceMinor: number }[];
  };
}

export interface NamedBalance {
  name: string;
  balanceMinor: number;
}

export type ComponentKey = 'accounts' | 'receivable' | 'investment' | 'homeDeposit' | 'gpf' | 'ledgerOthers';

export interface ComponentMove {
  key: ComponentKey;
  label: string;
  fromMinor: number;
  toMinor: number;
  deltaMinor: number;
}

export interface AccountMove {
  name: string;
  fromMinor: number;
  toMinor: number;
  deltaMinor: number;
}

export type NoteTone = 'warn' | 'info' | 'good';
export interface InsightNote {
  tone: NoteTone;
  text: string;
}

export interface SnapshotInsight {
  previousYyyymm: string;
  currentYyyymm: string;
  totalDeltaMinor: number;
  totalDeltaPct: number | null; // ১ দশমিক; আগের total ০ হলে null
  components: ComponentMove[]; // খালি = ভাঙা-হিসাব নেই
  accountMoves: AccountMove[]; // |delta| বড় → ছোট, শুধু delta ≠ 0
  incomeMinor: number;
  expenseMinor: number;
  savingsMinor: number;
  notes: InsightNote[];
}

export interface InsightInput {
  previous: InsightSnapshot;
  current: InsightSnapshot;
  /** সেই মাসের accountBalances থেকে derive (breakdown.accounts না থাকলে ব্যবহার) */
  previousDerivedAccounts: readonly NamedBalance[];
  currentDerivedAccounts: readonly NamedBalance[];
  /** snapshot-window-এর লেনদেন (Cross-check-এর একই window) */
  transactions: readonly { type: 'income' | 'expense'; amountMinor: number }[];
  cross: Pick<CrossCheckResult, 'status' | 'deviationMinor' | 'unexplainedMinor'>;
  /** টাকা-ফরম্যাটার (UI-র formatAmount) — নোটের টেক্সটে সংখ্যা বসাতে */
  fmt: (minor: number) => string;
  /** মাসের নাম, যেমন "Sep" — নোটের টেক্সটে */
  monthShort: (yyyymm: string) => string;
}

const COMPONENT_LABEL: Record<ComponentKey, string> = {
  accounts: 'Accounts (bank/cash)',
  receivable: 'Receivable (Ledger)',
  investment: 'Running Investment',
  homeDeposit: 'Home Deposit (Net)',
  gpf: 'GPF Balance',
  ledgerOthers: 'Ledger & others',
};

const TONE_RANK: Record<NoteTone, number> = { warn: 0, info: 1, good: 2 };
const sum = (a: readonly NamedBalance[]) => a.reduce((s, x) => s + x.balanceMinor, 0);
const pct1 = (num: number, den: number) => Math.round((Math.abs(num) / Math.abs(den)) * 1000) / 10;

/** snapshot-এর account-তালিকা: নিজের breakdown.accounts, না থাকলে derived; দুটোই না থাকলে null। */
function accountList(s: InsightSnapshot, derived: readonly NamedBalance[]): readonly NamedBalance[] | null {
  const saved = s.breakdown?.accounts;
  if (saved && saved.length > 0) return saved;
  return derived.length > 0 ? derived : null;
}

/** snapshot-এর accounts-মোট: breakdown.accountsMinor, না হলে account-তালিকার যোগফল; কিছুই না থাকলে null। */
function accountsTotal(s: InsightSnapshot, list: readonly NamedBalance[] | null): number | null {
  if (s.breakdown) return s.breakdown.accountsMinor;
  return list ? sum(list) : null;
}

export function buildSnapshotInsight(inp: InsightInput): SnapshotInsight {
  const { previous: p, current: c, fmt } = inp;
  const totalDeltaMinor = c.totalAssetsMinor - p.totalAssetsMinor;
  const totalDeltaPct = p.totalAssetsMinor !== 0 ? pct1(totalDeltaMinor, p.totalAssetsMinor) : null;

  // ---- ভাগ অনুযায়ী পরিবর্তন ----
  const pList = accountList(p, inp.previousDerivedAccounts);
  const cList = accountList(c, inp.currentDerivedAccounts);
  const pAcc = accountsTotal(p, pList);
  const cAcc = accountsTotal(c, cList);
  const components: ComponentMove[] = [];
  const mk = (key: ComponentKey, from: number, to: number) =>
    components.push({ key, label: COMPONENT_LABEL[key], fromMinor: from, toMinor: to, deltaMinor: to - from });
  if (p.breakdown && c.breakdown) {
    mk('accounts', p.breakdown.accountsMinor, c.breakdown.accountsMinor);
    mk('receivable', p.breakdown.receivableMinor, c.breakdown.receivableMinor);
    mk('investment', p.breakdown.investmentMinor, c.breakdown.investmentMinor);
    mk('homeDeposit', p.breakdown.homeDepositMinor, c.breakdown.homeDepositMinor);
    mk('gpf', p.breakdown.gpfMinor, c.breakdown.gpfMinor);
  } else if (pAcc !== null && cAcc !== null) {
    mk('accounts', pAcc, cAcc);
    mk('ledgerOthers', p.totalAssetsMinor - pAcc, c.totalAssetsMinor - cAcc);
  }

  // ---- অ্যাকাউন্ট-ভিত্তিক পরিবর্তন (নাম ধরে; এক মাসে না থাকলে ০) ----
  const accountMoves: AccountMove[] = [];
  if (pList && cList) {
    const names = new Set([...pList.map((a) => a.name), ...cList.map((a) => a.name)]);
    for (const name of names) {
      const from = pList.find((a) => a.name === name)?.balanceMinor ?? 0;
      const to = cList.find((a) => a.name === name)?.balanceMinor ?? 0;
      if (to !== from) accountMoves.push({ name, fromMinor: from, toMinor: to, deltaMinor: to - from });
    }
    accountMoves.sort((a, b) => Math.abs(b.deltaMinor) - Math.abs(a.deltaMinor));
  }

  // ---- আয়-ব্যয় ----
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const t of inp.transactions) {
    if (t.type === 'income') incomeMinor += t.amountMinor;
    else expenseMinor += t.amountMinor;
  }
  const savingsMinor = incomeMinor - expenseMinor;

  // ---- সচেতনতার নোট (নিয়ম-ভিত্তিক, deterministic) ----
  const notes: InsightNote[] = [];
  const pm = inp.monthShort(p.yyyymm);

  // (১) Cross-check ফল
  if (inp.cross.status === 'deviation' && inp.cross.unexplainedMinor !== 0) {
    notes.push({
      tone: 'warn',
      text: `Unexplained difference of ${fmt(Math.abs(inp.cross.unexplainedMinor))} in Cross-check — look for a missing/duplicate entry or a wrongly typed balance.`,
    });
  } else if (inp.cross.status === 'matched') {
    notes.push({ tone: 'good', text: 'Cross-check matched — your records and balances agree.' });
  }

  // (২) খরচ আয়ের চেয়ে বেশি
  if (savingsMinor < 0) {
    notes.push({ tone: 'warn', text: `Spent ${fmt(-savingsMinor)} more than you earned in this period.` });
  } else if (incomeMinor > 0 && expenseMinor > 0) {
    notes.push({ tone: 'good', text: `Saved ${fmt(savingsMinor)} (${Math.round((savingsMinor / incomeMinor) * 100)}% of income).` });
  }

  // (৩) account কমল, ledger-অংশ বাড়ল → টাকা সরেছে, হারায়নি
  const accMove = components.find((x) => x.key === 'accounts');
  const ledgerDelta = components.filter((x) => x.key !== 'accounts').reduce((s, x) => s + x.deltaMinor, 0);
  if (accMove && accMove.deltaMinor < 0 && ledgerDelta > 0) {
    const moved = Math.min(-accMove.deltaMinor, ledgerDelta);
    notes.push({
      tone: 'info',
      text: `About ${fmt(moved)} moved from bank/cash into ledger items (loans, investment, deposit, GPF) — not a loss, but that money is now less liquid.`,
    });
  }

  // (৪) মোট সম্পদ কমলে — সবচেয়ে বড় কারণ
  if (totalDeltaMinor < 0 && accountMoves.length > 0 && accountMoves[0].deltaMinor < 0) {
    const m = accountMoves[0];
    notes.push({ tone: 'warn', text: `Total assets fell ${fmt(-totalDeltaMinor)} vs ${pm}. Biggest drop: ${m.name} (${fmt(m.deltaMinor)}).` });
  }

  // (৫) ৫-ভাগ থাকলে: receivable/investment বাড়া = টাকা অন্যের কাছে/আটকে
  const rec = components.find((x) => x.key === 'receivable');
  if (rec && rec.deltaMinor > 0) {
    notes.push({ tone: 'info', text: `Receivable grew by ${fmt(rec.deltaMinor)} — follow up so it doesn’t drag on.` });
  }
  const invC = components.find((x) => x.key === 'investment');
  if (invC && invC.deltaMinor > 0) {
    notes.push({ tone: 'info', text: `Running investment grew by ${fmt(invC.deltaMinor)} — locked until repayment.` });
  }

  // (৬) liquidity share (bank/cash ÷ মোট) ৫ শতাংশ-পয়েন্টের বেশি বদলালে
  if (accMove && p.totalAssetsMinor > 0 && c.totalAssetsMinor > 0) {
    const before = Math.round((accMove.fromMinor / p.totalAssetsMinor) * 100);
    const now = Math.round((accMove.toMinor / c.totalAssetsMinor) * 100);
    if (Math.abs(now - before) >= 5) {
      notes.push({ tone: 'info', text: `Bank/cash is now ${now}% of total assets (was ${before}%).` });
    }
  }

  // (৭) এক অ্যাকাউন্টে ঘনীভূত (>৫০%)
  if (cList && cAcc && cAcc > 0) {
    const top = [...cList].sort((a, b) => b.balanceMinor - a.balanceMinor)[0];
    const share = Math.round((top.balanceMinor / cAcc) * 100);
    if (share > 50) notes.push({ tone: 'info', text: `${top.name} holds ${share}% of your bank/cash money — consider spreading the risk.` });
  }

  return {
    previousYyyymm: p.yyyymm,
    currentYyyymm: c.yyyymm,
    totalDeltaMinor,
    totalDeltaPct,
    components,
    accountMoves,
    incomeMinor,
    expenseMinor,
    savingsMinor,
    notes: notes.map((n, i) => ({ n, i })).sort((a, b) => TONE_RANK[a.n.tone] - TONE_RANK[b.n.tone] || a.i - b.i).map((x) => x.n).slice(0, 6),
  };
}

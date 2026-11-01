// Snapshot Insight — pure, platform-independent (lib/ purity)। owner-request 2026-11-01:
// প্রতি snapshot-এ আগের snapshot-এর সাথে তুলনা — সম্পদ কোথায় বাড়ল/কমল, আয়-ব্যয়, Cross-check ফল ও সচেতনতার নোট।
// শুধু বিদ্যমান snapshot/accountBalances/transactions থেকে derive; কিছু লেখা হয় না, কোনো AI/বাইরের সেবায় ডেটা যায় না।
// কার্ডের ভাষা বাংলা (প্রমিত); সংখ্যা/৳ অ্যাপের অন্য বাংলা কার্ডের মতোই (ইংরেজি অঙ্ক, lakh-grouping)।
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
  unchangedAccounts: string[]; // দুই মাসেই থাকা, অপরিবর্তিত account-এর নাম
  previousTotalMinor: number;
  currentTotalMinor: number;
  windowStart: string; // আয়-ব্যয়ের সময়সীমা (Cross-check-এর একই window)
  windowEnd: string;
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
  cross: Pick<CrossCheckResult, 'status' | 'deviationMinor' | 'unexplainedMinor' | 'windowStart' | 'windowEnd'>;
  /** টাকা-ফরম্যাটার (UI-র formatAmount) — নোটের টেক্সটে সংখ্যা বসাতে */
  fmt: (minor: number) => string;
  /** মাসের পূর্ণ বাংলা নাম, যেমন "সেপ্টেম্বর" — নোটের টেক্সটে */
  monthName: (yyyymm: string) => string;
}

const COMPONENT_LABEL: Record<ComponentKey, string> = {
  accounts: 'ব্যাংক/নগদ (অ্যাকাউন্ট)',
  receivable: 'পাওনা (লেজার)',
  investment: 'চলমান বিনিয়োগ',
  homeDeposit: 'হোম ডিপোজিট (নিট)',
  gpf: 'জিপিএফ ব্যালান্স',
  ledgerOthers: 'লেজার ও অন্যান্য',
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
  const unchangedAccounts: string[] = [];
  if (pList && cList) {
    const names = new Set([...pList.map((a) => a.name), ...cList.map((a) => a.name)]);
    for (const name of names) {
      const from = pList.find((a) => a.name === name)?.balanceMinor ?? 0;
      const to = cList.find((a) => a.name === name)?.balanceMinor ?? 0;
      if (to !== from) accountMoves.push({ name, fromMinor: from, toMinor: to, deltaMinor: to - from });
      else if (from !== 0) unchangedAccounts.push(name);
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
  const pm = inp.monthName(p.yyyymm);

  // (১) Cross-check ফল
  if (inp.cross.status === 'deviation' && inp.cross.unexplainedMinor !== 0) {
    notes.push({
      tone: 'warn',
      text: `ক্রসচেকে ${fmt(Math.abs(inp.cross.unexplainedMinor))} ব্যাখ্যাহীন অমিল আছে। কোনো লেনদেন বাদ পড়েছে, দুবার উঠেছে, কিংবা ব্যালেন্স ভুল লেখা হয়েছে কি না দেখে নিন।`,
    });
  } else if (inp.cross.status === 'matched') {
    notes.push({ tone: 'good', text: 'ক্রসচেক মিলে গেছে। আপনার লেনদেন আর ব্যালেন্সের হিসাব পরস্পরের সঙ্গে সংগতিপূর্ণ।' });
  }

  // (২) খরচ আয়ের চেয়ে বেশি
  if (savingsMinor < 0) {
    notes.push({ tone: 'warn', text: `এই সময়ে আয়ের চেয়ে ${fmt(-savingsMinor)} বেশি খরচ হয়েছে।` });
  } else if (incomeMinor > 0 && expenseMinor > 0) {
    notes.push({ tone: 'good', text: `এই সময়ে ${fmt(savingsMinor)} সঞ্চয় হয়েছে, যা আয়ের ${Math.round((savingsMinor / incomeMinor) * 100)} শতাংশ।` });
  }

  // (৩) account কমল, ledger-অংশ বাড়ল → টাকা সরেছে, হারায়নি
  const accMove = components.find((x) => x.key === 'accounts');
  const ledgerDelta = components.filter((x) => x.key !== 'accounts').reduce((s, x) => s + x.deltaMinor, 0);
  if (accMove && accMove.deltaMinor < 0 && ledgerDelta > 0) {
    const moved = Math.min(-accMove.deltaMinor, ledgerDelta);
    notes.push({
      tone: 'info',
      text: `প্রায় ${fmt(moved)} ব্যাংক/নগদ থেকে ধার, বিনিয়োগ, ডিপোজিট বা জিপিএফ-এ সরে গেছে। এটি ক্ষতি নয়; তবে এই টাকা এখন সহজে হাতে পাওয়া যাবে না।`,
    });
  }

  // (৪) মোট সম্পদ কমলে — সবচেয়ে বড় কারণ
  if (totalDeltaMinor < 0 && accountMoves.length > 0 && accountMoves[0].deltaMinor < 0) {
    const m = accountMoves[0];
    notes.push({ tone: 'warn', text: `মোট সম্পদ আগের মাসের (${pm}) চেয়ে ${fmt(-totalDeltaMinor)} কমেছে। সবচেয়ে বেশি কমেছে ${m.name}-এ (${fmt(-m.deltaMinor)})।` });
  }

  // (৫) ৫-ভাগ থাকলে: receivable/investment বাড়া = টাকা অন্যের কাছে/আটকে
  const rec = components.find((x) => x.key === 'receivable');
  if (rec && rec.deltaMinor > 0) {
    notes.push({ tone: 'info', text: `পাওনা ${fmt(rec.deltaMinor)} বেড়েছে। আদায়ের খোঁজ রাখুন, যেন ঝুলে না থাকে।` });
  }
  const invC = components.find((x) => x.key === 'investment');
  if (invC && invC.deltaMinor > 0) {
    notes.push({ tone: 'info', text: `চলমান বিনিয়োগ ${fmt(invC.deltaMinor)} বেড়েছে। ফেরত না আসা পর্যন্ত এই টাকা আটকে থাকবে।` });
  }

  // (৬) liquidity share (bank/cash ÷ মোট) ৫ শতাংশ-পয়েন্টের বেশি বদলালে
  if (accMove && p.totalAssetsMinor > 0 && c.totalAssetsMinor > 0) {
    const before = Math.round((accMove.fromMinor / p.totalAssetsMinor) * 100);
    const now = Math.round((accMove.toMinor / c.totalAssetsMinor) * 100);
    if (Math.abs(now - before) >= 5) {
      notes.push({ tone: 'info', text: `মোট সম্পদের ${now} শতাংশ এখন ব্যাংক/নগদে আছে (আগে ছিল ${before} শতাংশ)।` });
    }
  }

  // (৭) এক অ্যাকাউন্টে ঘনীভূত (>৫০%)
  if (cList && cAcc && cAcc > 0) {
    const top = [...cList].sort((a, b) => b.balanceMinor - a.balanceMinor)[0];
    const share = Math.round((top.balanceMinor / cAcc) * 100);
    if (share > 50) notes.push({ tone: 'info', text: `ব্যাংক/নগদের ${share} শতাংশই ${top.name}-এ। ঝুঁকি কমাতে টাকা একটু ছড়িয়ে রাখার কথা ভাবতে পারেন।` });
  }

  return {
    previousYyyymm: p.yyyymm,
    currentYyyymm: c.yyyymm,
    totalDeltaMinor,
    totalDeltaPct,
    components,
    accountMoves,
    unchangedAccounts,
    previousTotalMinor: p.totalAssetsMinor,
    currentTotalMinor: c.totalAssetsMinor,
    windowStart: inp.cross.windowStart,
    windowEnd: inp.cross.windowEnd,
    incomeMinor,
    expenseMinor,
    savingsMinor,
    notes: notes.map((n, i) => ({ n, i })).sort((a, b) => TONE_RANK[a.n.tone] - TONE_RANK[b.n.tone] || a.i - b.i).map((x) => x.n).slice(0, 6),
  };
}

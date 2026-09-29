// Cross-check / Deviation — pure, platform-independent (lib/ purity, Architecture Plan §০/§২/§৪.৬)।
// স্কোপ (C7): শুধু current-vs-previous-snapshot prospective। আগের Total Assets কখনো reconstruct হয় না (C12) —
// সংরক্ষিত `netWorthSnapshots` থেকে আসে।
//
// Sign convention (owner-confirmed 2026-09-24): deviation = current − expected
//   expected = previous.totalAssets + savings(window)
//   current  = চলতি snapshot-এর totalAssets, না থাকলে লাইভ
// ঋণাত্মক = প্রত্যাশার চেয়ে কম সম্পদ। প্রতিটা factor `effectMinor` = Total Assets-এ ওই ঘটনার প্রভাব
// (deviation-এর একই চিহ্ন)। বাকিটা unexplained।
import { outstandingMinor } from './debtCalc';
import { sumRepayments } from './investmentCalc';
import { gpfChangeInWindowMinor } from './gpfCalc';

export interface SnapshotLike {
  yyyymm: string;
  totalAssetsMinor: number;
  snapshotDate: string; // YYYY-MM-DD
  unverified?: boolean;
}

export interface TxLite {
  date: string;
  type: 'income' | 'expense';
  amountMinor: number;
}

interface RepaymentLite {
  date: string;
  amountMinor: number;
}

export interface DebtLite {
  person: string;
  direction: 'owe_me' | 'i_owe';
  totalAmountMinor: number;
  date: string;
  repayments: readonly RepaymentLite[];
  receivableStatus: 'active' | 'doubtful' | 'forgiven';
  receivableStatusChangedAt: string | null;
}

export interface InvestmentLite {
  investedTo: string;
  date: string;
  principalMinor: number;
  repayments: readonly RepaymentLite[];
  investmentOutcome: 'running' | 'doubtful' | 'written_off';
  investmentOutcomeChangedAt: string | null;
}

export interface BalanceLite {
  yyyymm: string;
  snapshotDate: string;
}

export interface GpfLite {
  date: string;
  type: 'contribution' | 'interest' | 'withdrawal';
  amountMinor: number;
}

export type FactorKey = 'investmentClosure' | 'debtForgiven' | 'debtExcessRepayment' | 'iOweChange' | 'gpfChange';

export interface Factor {
  key: FactorKey;
  effectMinor: number; // Total Assets-এ প্রভাব (difference-এর চিহ্নে)
  detail: string[]; // UI-তে দেখানোর জন্য নাম/সংখ্যা (ইংরেজি)
}

export interface CrossCheckResult {
  windowStart: string; // inclusive
  windowEnd: string; // inclusive
  previous: SnapshotLike;
  previousUnverified: boolean;
  currentIsLive: boolean;
  previousTotalMinor: number;
  savingsMinor: number;
  expectedMinor: number;
  currentMinor: number;
  deviationMinor: number; // current − expected
  status: 'matched' | 'deviation';
  factors: Factor[]; // শুধু effectMinor ≠ 0 বা detail থাকা factor
  unexplainedMinor: number; // deviation − Σfactors
  /** যে balance-snapshot তারিখগুলো মাস-শেষ থেকে ৩ দিনের বেশি দূরে (context-নোট, সংখ্যা adjust করে না)। */
  lateSnapshotDates: string[];
}

const DAY = 86_400_000;
const utc = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd);
};
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fmt(utc(d) + n * DAY);
const inWindow = (d: string, start: string, end: string) => d >= start && d <= end;
const monthEnd = (yyyymm: string) => {
  const [y, m] = yyyymm.split('-').map(Number);
  return fmt(Date.UTC(y, m, 0));
};

/**
 * window-এর ভেতরের repayment-গুলোর যে অংশ principal/total ছাড়িয়ে যায় (excess = মুনাফা/বাড়তি টাকা)।
 * Running/Outstanding ০-তে ক্ল্যাম্প হয় কিন্তু টাকা account-এ পুরোটাই ঢোকে — তাই এই excess-ই Total Assets-এ
 * ব্যাখ্যাহীন বৃদ্ধি। প্রথম closure ও পরে (post-closure) আসা দেরির repayment — দুটোই নিজ window-এ ধরা পড়ে।
 */
function excessInWindow(principal: number, repayments: readonly RepaymentLite[], start: string, end: string): number {
  const sorted = [...repayments].sort((a, b) => a.date.localeCompare(b.date));
  let paid = 0;
  let excess = 0;
  for (const r of sorted) {
    const before = Math.max(0, paid - principal);
    paid += r.amountMinor;
    if (inWindow(r.date, start, end)) excess += Math.max(0, paid - principal) - before;
  }
  return excess;
}

/** "closed" হওয়ার তারিখ = যে repayment-এ Σ প্রথম principal ছুঁয়েছে; closed না হলে null। */
function closureDate(i: InvestmentLite): string | null {
  const sorted = [...i.repayments].sort((a, b) => a.date.localeCompare(b.date));
  let acc = 0;
  for (const r of sorted) {
    acc += r.amountMinor;
    if (acc >= i.principalMinor) return r.date;
  }
  return null;
}

/**
 * কোন দুটো snapshot-এর মধ্যে Cross-check হবে (Architecture §২: "চলতি doc থাকলে তার totalAssetsMinor, না থাকলে লাইভ")।
 * `period` (yyyymm) এর doc থাকলে current=সেই doc, previous=তার আগের সর্বশেষ doc; না থাকলে current=লাইভ, previous=সর্বশেষ doc।
 */
export function pickSnapshotPair(
  snapshots: readonly SnapshotLike[],
  period: string,
): { previous: SnapshotLike | null; current: SnapshotLike | null } {
  const sorted = [...snapshots].sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
  const current = sorted.find((s) => s.yyyymm === period) ?? null;
  const before = sorted.filter((s) => s.yyyymm < period);
  return { previous: before.length ? before[before.length - 1] : null, current };
}

export interface CrossCheckInput {
  previous: SnapshotLike;
  /** চলতি snapshot doc; null হলে live ব্যবহার হয় */
  current: SnapshotLike | null;
  liveTotalAssetsMinor: number;
  today: string; // Asia/Dhaka YYYY-MM-DD
  transactions: readonly TxLite[];
  debts: readonly DebtLite[];
  investments: readonly InvestmentLite[];
  /** সব GPF entry — window-এর নেট পরিবর্তন (৬ষ্ঠ factor) */
  gpfEntries: readonly GpfLite[];
  /** চলতি period-এর accountBalances (snapshotDate context-নোটের জন্য) */
  periodBalances: readonly BalanceLite[];
  period: string; // yyyymm
}

export function computeCrossCheck(inp: CrossCheckInput): CrossCheckResult {
  const windowStart = addDays(inp.previous.snapshotDate, 1);
  const windowEnd = inp.current ? inp.current.snapshotDate : inp.today;
  const currentMinor = inp.current ? inp.current.totalAssetsMinor : inp.liveTotalAssetsMinor;

  let savingsMinor = 0;
  for (const t of inp.transactions) {
    if (!inWindow(t.date, windowStart, windowEnd)) continue;
    savingsMinor += t.type === 'income' ? t.amountMinor : -t.amountMinor;
  }

  const expectedMinor = inp.previous.totalAssetsMinor + savingsMinor;
  const deviationMinor = currentMinor - expectedMinor;
  const factors: Factor[] = [];

  // (১) window-এ closed হওয়া investment-এর মোট profit/loss (C8) + written_off হওয়া investment-এর হারানো Remaining Principal
  {
    let effect = 0;
    const detail: string[] = [];
    for (const i of inp.investments) {
      if (i.investmentOutcome === 'written_off') {
        if (i.investmentOutcomeChangedAt && inWindow(i.investmentOutcomeChangedAt, windowStart, windowEnd)) {
          const lost = Math.max(0, i.principalMinor - sumRepayments(i.repayments));
          if (lost > 0) {
            effect -= lost;
            detail.push(`${i.investedTo} (written off)`);
          }
        }
        continue;
      }
      // closure হোক বা পরে আসা বাড়তি repayment — window-এর excess-ই মুনাফা
      const excess = excessInWindow(i.principalMinor, i.repayments, windowStart, windowEnd);
      const cd = closureDate(i);
      if (cd && inWindow(cd, windowStart, windowEnd)) {
        effect += excess;
        detail.push(`${i.investedTo} (closed)`);
      } else if (excess > 0) {
        effect += excess;
        detail.push(`${i.investedTo} (extra repayment)`);
      }
    }
    if (detail.length) factors.push({ key: 'investmentClosure', effectMinor: effect, detail });
  }

  // (২) window-এ forgiven করা owe_me debt-এর outstanding — Total Assets থেকে হঠাৎ বাদ
  {
    let effect = 0;
    const detail: string[] = [];
    for (const d of inp.debts) {
      if (d.direction !== 'owe_me' || d.receivableStatus !== 'forgiven') continue;
      if (!d.receivableStatusChangedAt || !inWindow(d.receivableStatusChangedAt, windowStart, windowEnd)) continue;
      const out = outstandingMinor(d.totalAmountMinor, d.repayments);
      if (out > 0) {
        effect -= out;
        detail.push(d.person);
      }
    }
    if (detail.length) factors.push({ key: 'debtForgiven', effectMinor: effect, detail });
  }

  // (৩) owe_me debt-এ পাওনার চেয়ে বেশি ফেরত (সুদ/বাড়তি টাকা) — Outstanding ০-তে ক্ল্যাম্প, টাকা account-এ পুরো ঢোকে।
  // মূলধনের transfer (ধার/ইনভেস্টমেন্ট/Home Deposit) এখানে factor না: as-of মডেলে Account balance ও ledger একই
  // snapshot-তারিখের, তাই transfer নিজেই কাটাকাটি — factor দিলে উল্টো ভুয়া "Unexplained" তৈরি হতো।
  {
    let effect = 0;
    const detail: string[] = [];
    for (const d of inp.debts) {
      if (d.direction !== 'owe_me' || d.receivableStatus === 'forgiven') continue;
      const excess = excessInWindow(d.totalAmountMinor, d.repayments, windowStart, windowEnd);
      if (excess > 0) {
        effect += excess;
        detail.push(d.person);
      }
    }
    if (detail.length) factors.push({ key: 'debtExcessRepayment', effectMinor: effect, detail });
  }

  // (৫, DF3) i_owe পরিবর্তন — ধার নিলে টাকা account-এ ঢোকে কিন্তু transaction তৈরি হয় না, শোধে বেরোয়; liability Total Assets-এ নেই (C6)
  {
    let effect = 0;
    const detail: string[] = [];
    for (const d of inp.debts) {
      if (d.direction !== 'i_owe') continue;
      let e = 0;
      if (inWindow(d.date, windowStart, windowEnd)) e += d.totalAmountMinor;
      for (const r of d.repayments) if (inWindow(r.date, windowStart, windowEnd)) e -= r.amountMinor;
      if (e !== 0) {
        effect += e;
        detail.push(d.person);
      }
    }
    if (detail.length) factors.push({ key: 'iOweChange', effectMinor: effect, detail });
  }

  // (৬) GPF change — contribution বেতন থেকে কাটা (Spendee-তে শুধু নিট বেতন), interest ক্রেডিট হয়: transaction তৈরি হয় না,
  // কিন্তু GPF ব্যালেন্স Total Assets-এ যোগ হয় (as-of snapshot-তারিখ)। window-এর নেট পরিবর্তনই এখানে ধরা হয়।
  {
    const effect = gpfChangeInWindowMinor(inp.gpfEntries, windowStart, windowEnd);
    const kinds = new Set<string>();
    for (const g of inp.gpfEntries) if (inWindow(g.date, windowStart, windowEnd)) kinds.add(g.type);
    if (kinds.size) factors.push({ key: 'gpfChange', effectMinor: effect, detail: [...kinds] });
  }

  const explained = factors.reduce((s, f) => s + f.effectMinor, 0);

  // (৪) snapshot-তারিখ context-নোট — সংখ্যা adjust করে না
  const end = monthEnd(inp.period);
  const late = new Set<string>();
  for (const b of inp.periodBalances) {
    if (b.yyyymm !== inp.period) continue;
    if (Math.abs(utc(end) - utc(b.snapshotDate)) > 3 * DAY) late.add(b.snapshotDate);
  }

  return {
    windowStart,
    windowEnd,
    previous: inp.previous,
    previousUnverified: inp.previous.unverified === true,
    currentIsLive: inp.current === null,
    previousTotalMinor: inp.previous.totalAssetsMinor,
    savingsMinor,
    expectedMinor,
    currentMinor,
    deviationMinor,
    status: deviationMinor === 0 ? 'matched' : 'deviation',
    factors,
    unexplainedMinor: deviationMinor - explained,
    lateSnapshotDates: [...late].sort(),
  };
}

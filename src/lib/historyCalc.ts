// Net Worth → Monthly History-র pure derive-ফাংশন (owner-approved 2026-10)। কোনো query/store নেই —
// শুধু বিদ্যমান netWorthSnapshots (ও তার ঐচ্ছিক `breakdown`) থেকে বছর-ভিত্তিক গ্রুপ, আগের snapshot-এর সাথে পার্থক্য ও
// Table-view-র কলাম। breakdown না থাকা মাসে ভাঙা সংখ্যা বানানো হয় না (hasSplit=false)।
import type { NetWorthSnapshot, SnapshotBreakdown } from '../validation/netWorthSchema';

export interface HistoryMonth {
  yyyymm: string;
  snapshot: NetWorthSnapshot;
  hasSplit: boolean;
  prevYyyymm: string | null;
  deltaMinor: number | null;
}
export interface HistoryYear {
  year: string;
  months: HistoryMonth[]; // নতুন → পুরনো
}

export function groupHistoryByYear(snaps: readonly NetWorthSnapshot[]): HistoryYear[] {
  const asc = [...snaps].sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
  const byYear = new Map<string, HistoryMonth[]>();
  asc.forEach((s, i) => {
    const prev = i > 0 ? asc[i - 1] : null;
    const m: HistoryMonth = {
      yyyymm: s.yyyymm,
      snapshot: s,
      hasSplit: s.breakdown !== undefined,
      prevYyyymm: prev ? prev.yyyymm : null,
      deltaMinor: prev ? s.totalAssetsMinor - prev.totalAssetsMinor : null,
    };
    const year = s.yyyymm.slice(0, 4);
    const arr = byYear.get(year);
    if (arr) arr.push(m);
    else byYear.set(year, [m]);
  });
  return [...byYear.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, months]) => ({ year, months: months.sort((a, b) => b.yyyymm.localeCompare(a.yyyymm)) }));
}

/** Table-view-র account-কলাম: বর্তমান account-ক্রম আগে, তারপর শুধু ইতিহাসে থাকা বাড়তি নাম (archived/পুরনো)। */
export function accountColumns(months: readonly HistoryMonth[], currentOrder: readonly string[]): string[] {
  const seen = new Set<string>();
  const used = new Set<string>();
  for (const m of months) for (const a of m.snapshot.breakdown?.accounts ?? []) used.add(a.name);
  const out: string[] = [];
  for (const n of [...currentOrder, ...used]) {
    if (!used.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function accountBalanceOf(m: HistoryMonth, name: string): number | null {
  const a = m.snapshot.breakdown?.accounts?.find((x) => x.name === name);
  return a ? a.balanceMinor : null;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthName(yyyymm: string, short = false): string {
  const n = MONTH_NAMES[Number(yyyymm.slice(5, 7)) - 1] ?? yyyymm;
  return short ? n.slice(0, 3) : n;
}

// ---- Net Worth ট্যাবের মাস-নেভিগেশন (`‹ মাস ›`) — পুরনো মাস read-only, বিদ্যমান snapshot থেকে ----
export interface MonthDetail {
  yyyymm: string;
  totalMinor: number;
  snapshotDate: string;
  unverified: boolean;
  prevYyyymm: string | null;
  deltaMinor: number | null;
  deltaPct: number | null; // ১ দশমিক; আগের total ০ হলে null
  breakdown: SnapshotBreakdown | null; // না থাকলে "Total only" — ভাঙা সংখ্যা বানানো হয় না
  accounts: { name: string; balanceMinor: number }[]; // বর্তমান account-ক্রম আগে, বাকি পরে
  accountsDerived: boolean; // true = snapshot-এ নয়, সেই মাসের accountBalances থেকে
  otherMinor: number | null; // derived হলে: total − accounts (ledger ও অন্যান্য, ভাঙা-হিসাব সেভ নেই)
}

/** নির্দিষ্ট মাসের snapshot-বিবরণ; snapshot না থাকলে null ("No snapshot")। */
export function monthDetail(
  snaps: readonly NetWorthSnapshot[],
  yyyymm: string,
  accountOrder: readonly string[] = [],
  derivedAccounts: readonly { name: string; balanceMinor: number }[] = [],
): MonthDetail | null {
  const m = groupHistoryByYear(snaps).flatMap((y) => y.months).find((x) => x.yyyymm === yyyymm);
  if (!m) return null;
  const prev = m.prevYyyymm ? snaps.find((s) => s.yyyymm === m.prevYyyymm) : undefined;
  const deltaPct =
    m.deltaMinor !== null && prev && prev.totalAssetsMinor !== 0 ? Math.round((Math.abs(m.deltaMinor) / Math.abs(prev.totalAssetsMinor)) * 1000) / 10 : null;
  const idx = (n: string) => {
    const i = accountOrder.indexOf(n);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  // breakdown-এ account না থাকলে সেই মাসের accountBalances থেকে (শুধু দেখানোর জন্য, কিছু লেখা হয় না)
  const saved = m.snapshot.breakdown?.accounts ?? [];
  const useDerived = saved.length === 0 && derivedAccounts.length > 0;
  const accounts = [...(useDerived ? derivedAccounts : saved)].sort((a, b) => idx(a.name) - idx(b.name));
  return {
    yyyymm,
    totalMinor: m.snapshot.totalAssetsMinor,
    snapshotDate: m.snapshot.snapshotDate,
    unverified: m.snapshot.unverified === true,
    prevYyyymm: m.prevYyyymm,
    deltaMinor: m.deltaMinor,
    deltaPct,
    breakdown: m.snapshot.breakdown ?? null,
    accounts,
    accountsDerived: useDerived,
    otherMinor: useDerived ? m.snapshot.totalAssetsMinor - accounts.reduce((t, a) => t + a.balanceMinor, 0) : null,
  };
}

/** accountBalances → মাস অনুযায়ী { name, balanceMinor } তালিকা (account-ক্রমে)। archived/মুছে-যাওয়া account বাদ। */
export function accountsByMonth(
  balances: readonly { accountId: string; yyyymm: string; balanceMinor: number }[],
  accounts: readonly { id: string; name: string }[],
): Map<string, { name: string; balanceMinor: number }[]> {
  const nameOf = new Map(accounts.map((a) => [a.id, a.name]));
  const out = new Map<string, { name: string; balanceMinor: number }[]>();
  for (const b of balances) {
    const name = nameOf.get(b.accountId);
    if (name === undefined) continue;
    const arr = out.get(b.yyyymm);
    if (arr) arr.push({ name, balanceMinor: b.balanceMinor });
    else out.set(b.yyyymm, [{ name, balanceMinor: b.balanceMinor }]);
  }
  const rank = new Map(accounts.map((a, i) => [a.name, i]));
  for (const arr of out.values()) arr.sort((x, y) => (rank.get(x.name) ?? 0) - (rank.get(y.name) ?? 0));
  return out;
}

/** সবচেয়ে পুরনো snapshot-মাস ("‹" কতদূর যাবে); snapshot না থাকলে null। */
export function earliestSnapshotMonth(snaps: readonly { yyyymm: string }[]): string | null {
  if (snaps.length === 0) return null;
  return snaps.reduce((a, b) => (b.yyyymm < a ? b.yyyymm : a), snaps[0].yyyymm);
}

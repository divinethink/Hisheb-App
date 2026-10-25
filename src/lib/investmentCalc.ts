// ইনভেস্টমেন্ট ক্যালকুলেশন — pure, platform-independent (lib/ purity, Architecture Plan §০/§১৩.১)।
export interface Repayment {
  date: string;
  amountMinor: number;
}

export function sumRepayments(repayments: readonly Repayment[]): number {
  return repayments.reduce((s, r) => s + r.amountMinor, 0);
}

/** Running Investment = max(0, principal − Σrepayments) — ০-তে ক্ল্যাম্প বাধ্যতামূলক। */
export function runningMinor(principalMinor: number, repayments: readonly Repayment[]): number {
  return Math.max(0, principalMinor - sumRepayments(repayments));
}

export type InvestmentStatus = 'running' | 'closed';

/** অটো-ক্যালকুলেট, কখনো Firestore-এ store হয় না (Auto vs Manual precedence, C3)। Σrepayments ≥ principal হলে "closed"। */
export function investmentStatus(principalMinor: number, repayments: readonly Repayment[]): InvestmentStatus {
  return sumRepayments(repayments) >= principalMinor ? 'closed' : 'running';
}

export const INVESTMENT_STATUS_LABEL: Record<InvestmentStatus, string> = {
  running: 'Running',
  closed: 'Closed',
};

/** Profit = Σrepayments − principal, শুধু status="closed" হলে অর্থবহ (C8: per-month attribution না)। */
export function profitMinor(principalMinor: number, repayments: readonly Repayment[]): number {
  return sumRepayments(repayments) - principalMinor;
}

/**
 * তালিকা দুই দলে: `open` (Running — ওপরে) ও `closed` (Σrepayments ≥ principal — নিচে)।
 * প্রতিটা দলে সর্বশেষ ইনভেস্টমেন্টের তারিখ অনুযায়ী নতুন আগে (ওপর→নিচ) — repayment-এর ভিত্তিতে নয়
 * (owner-request, ২০২৬-১০-২৫); একই তারিখে মূল ক্রম বজায়।
 */
export function partitionInvestmentsForList<T extends { date: string; principalMinor: number; repayments: readonly Repayment[] }>(
  list: readonly T[],
): { open: T[]; closed: T[] } {
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date)); // Array.sort stable
  return {
    open: sorted.filter((i) => investmentStatus(i.principalMinor, i.repayments) !== 'closed'),
    closed: sorted.filter((i) => investmentStatus(i.principalMinor, i.repayments) === 'closed'),
  };
}

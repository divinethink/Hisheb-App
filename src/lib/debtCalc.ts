// দেনা-পাওনা ক্যালকুলেশন — pure, platform-independent (lib/ purity, Architecture Plan §০/§১৩)।
export interface Repayment {
  date: string;
  amountMinor: number;
}

export function sumRepayments(repayments: readonly Repayment[]): number {
  return repayments.reduce((s, r) => s + r.amountMinor, 0);
}

/** ০-তে ক্ল্যাম্প — over-repayment হলেও Outstanding কখনো ঋণাত্মক দেখাবে না (E5: warning অন্য জায়গায়)। */
export function outstandingMinor(totalAmountMinor: number, repayments: readonly Repayment[]): number {
  return Math.max(0, totalAmountMinor - sumRepayments(repayments));
}

export type RepaymentStatus = 'outstanding' | 'partial' | 'paid';

/** অটো-ক্যালকুলেট, কখনো Firestore-এ store হয় না (Architecture Plan §১৩ Auto vs Manual precedence, C3)। */
export function repaymentStatus(totalAmountMinor: number, repayments: readonly Repayment[]): RepaymentStatus {
  const paid = sumRepayments(repayments);
  if (paid <= 0) return 'outstanding';
  if (paid >= totalAmountMinor) return 'paid';
  return 'partial';
}

export const REPAYMENT_STATUS_LABEL: Record<RepaymentStatus, string> = {
  outstanding: 'Outstanding',
  partial: 'Partially Paid',
  paid: 'Fully Paid',
};

// ───────── লাইন-ভিত্তিক (per-borrowing) হিসাব — owner-approved 2026-10-13 ─────────
// পুরনো ডেটার জন্য zero-migration: borrowings/id/status না থাকলে একটাই synthetic লাইন + debt-level receivableStatus fallback।

export type LineStatus = 'active' | 'doubtful' | 'written_off';

export interface BorrowingLine {
  id?: string;
  date: string;
  amountMinor: number;
  status?: LineStatus;
  statusChangedAt?: string | null;
}
export interface LinkedRepayment extends Repayment {
  borrowingId?: string | null;
}
/** Debt-এর যে অংশ লাইন-হিসাবে লাগে — পুরনো/ছোট shape-ও (borrowings ছাড়া) গ্রহণযোগ্য। */
export interface DebtLinesInput {
  totalAmountMinor: number;
  date?: string;
  borrowings?: readonly BorrowingLine[];
  repayments: readonly LinkedRepayment[];
  receivableStatus?: 'active' | 'doubtful' | 'forgiven';
  receivableStatusChangedAt?: string | null;
}

export function linesOf(d: DebtLinesInput): readonly BorrowingLine[] {
  if (d.borrowings && d.borrowings.length > 0) return d.borrowings;
  return [{ date: d.date ?? '', amountMinor: d.totalAmountMinor }];
}

/**
 * প্রতি লাইনে কত শোধ হয়েছে। লিংকড শোধ (borrowingId মেলে) সরাসরি ওই লাইনে;
 * বাকি (unlinked / লাইন মুছে গেছে) পুল FIFO — পুরনো তারিখের লাইন আগে, written-off ছাড়া লাইন আগে, বাকি থাকলে written-off লাইনে (recovery)।
 */
export function allocateToLines(
  lines: readonly BorrowingLine[],
  repayments: readonly LinkedRepayment[],
  isWrittenOff: (i: number) => boolean = () => false,
): number[] {
  const paid = lines.map(() => 0);
  const idx = new Map<string, number>();
  lines.forEach((l, i) => {
    if (l.id) idx.set(l.id, i);
  });
  let pool = 0;
  for (const r of repayments) {
    const i = r.borrowingId ? idx.get(r.borrowingId) : undefined;
    if (i === undefined) pool += r.amountMinor;
    else paid[i] += r.amountMinor;
  }
  const order = lines
    .map((_, i) => i)
    .sort((a, b) => {
      const w = Number(isWrittenOff(a)) - Number(isWrittenOff(b));
      if (w !== 0) return w;
      return lines[a].date.localeCompare(lines[b].date) || a - b;
    });
  for (const i of order) {
    if (pool <= 0) break;
    const take = Math.min(pool, Math.max(0, lines[i].amountMinor - paid[i]));
    paid[i] += take;
    pool -= take;
  }
  return paid;
}

/** লাইনের কার্যকর manual status — নিজস্ব status থাকলে সেটা, নইলে পুরনো debt-level receivableStatus inherit। */
export function effectiveLineStatus(
  d: Pick<DebtLinesInput, 'receivableStatus' | 'receivableStatusChangedAt'>,
  line: BorrowingLine,
): { status: LineStatus; changedAt: string | null } {
  if (line.status) return { status: line.status, changedAt: line.statusChangedAt ?? null };
  const legacy = d.receivableStatus ?? 'active';
  const status: LineStatus = legacy === 'forgiven' ? 'written_off' : legacy;
  return { status, changedAt: d.receivableStatusChangedAt ?? null };
}

export interface LineView {
  index: number;
  line: BorrowingLine;
  paidMinor: number;
  outstandingMinor: number;
  payStatus: RepaymentStatus;
  status: LineStatus;
  statusChangedAt: string | null;
  /** asOf-তে (বা asOf না দিলে এখন) written-off হিসেবে বাদ পড়ছে কি */
  excluded: boolean;
}

/** asOf দিলে: শুধু date ≤ asOf শোধ ধরা হয় এবং written-off শুধু changedAt ≤ asOf (changedAt null = সবসময় কার্যকর, পুরনো forgiven-এর নিয়ম)। */
export function lineViews(d: DebtLinesInput, asOf?: string): LineView[] {
  const lines = linesOf(d);
  const reps = asOf ? d.repayments.filter((r) => r.date <= asOf) : d.repayments;
  const eff = lines.map((l) => effectiveLineStatus(d, l));
  const excluded = eff.map((e) => e.status === 'written_off' && (!asOf || e.changedAt === null || e.changedAt <= asOf));
  const paid = allocateToLines(lines, reps, (i) => excluded[i]);
  return lines.map((line, i): LineView => {
    const out = Math.max(0, line.amountMinor - paid[i]);
    return {
      index: i,
      line,
      paidMinor: paid[i],
      outstandingMinor: out,
      payStatus: paid[i] <= 0 ? 'outstanding' : paid[i] >= line.amountMinor ? 'paid' : 'partial',
      status: eff[i].status,
      statusChangedAt: eff[i].changedAt,
      excluded: excluded[i],
    };
  });
}

/** owe_me Receivable (Net Worth-এ যা ধরা হয়): written-off লাইন বাদে বাকি লাইনগুলোর outstanding-এর যোগফল। */
export function receivableOutstandingMinor(d: DebtLinesInput, asOf?: string): number {
  return lineViews(d, asOf)
    .filter((v) => !v.excluded)
    .reduce((s, v) => s + v.outstandingMinor, 0);
}

/** Written-off হিসেবে বাদ পড়া অশোধিত অংশ। */
export function writtenOffOutstandingMinor(d: DebtLinesInput, asOf?: string): number {
  return lineViews(d, asOf)
    .filter((v) => v.excluded)
    .reduce((s, v) => s + v.outstandingMinor, 0);
}

// যাকাত-বছর (cycle) ও বাকি হিসাব — pure, platform-independent।
// বছরের শুরু = বার্ষিক তারিখের (মাস-দিন) সর্বশেষ আসল তারিখ যা পেমেন্টের তারিখের আগে বা সেদিন। বার্ষিক তারিখ না থাকলে ১ জানুয়ারি।
// "দেয়" অঙ্ক zakatCycles-এ লক থাকলে সেটা; না থাকলে (শুধু চলতি বছরে) বর্তমান হিসাব; পুরনো বছরে লক না থাকলে অজানা (null)।

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad = (n: number): string => String(n).padStart(2, '0');

/** `anniversary`-র মাস-দিন ধরে y বছরের তারিখ; ২৯ ফেব্রুয়ারি অ-লিপ বছরে ১ মার্চ (zakatDate.ts-এর মতো) */
function anniversaryIn(year: number, anniversary: string | null): string {
  if (anniversary == null) return `${year}-01-01`;
  const [, m, d] = anniversary.split('-').map(Number);
  if (m === 2 && d === 29 && !isLeap(year)) return `${year}-03-01`;
  return `${year}-${pad(m)}-${pad(d)}`;
}

/** `date`-এ যে যাকাত-বছর চলছিল তার শুরুর তারিখ */
export function cycleStartOf(date: string, anniversary: string | null): string {
  const y = Number(date.slice(0, 4));
  const thisYear = anniversaryIn(y, anniversary);
  return thisYear <= date ? thisYear : anniversaryIn(y - 1, anniversary);
}

export interface CyclePaymentInput {
  id: string;
  date: string;
  amountMinor: number;
  cycleStart?: string | null;
}
export interface CycleLockInput {
  id: string;
  dueMinor: number;
}

export interface CycleSummary<P extends CyclePaymentInput> {
  start: string;
  isCurrent: boolean;
  /** null = এই বছরের "দেয়" অঙ্ক জানা নেই (লক নেই ও বছরটা চলতি নয়, বা চলতি বছরে এখনো যাকাত ফরজ নয়) */
  dueMinor: number | null;
  paidMinor: number;
  /** due জানা থাকলে max(0, due − paid); নইলে null */
  remainingMinor: number | null;
  /** due জানা থাকলে প্রয়োজনের চেয়ে বেশি দেওয়া অংশ (অগ্রিম) */
  overMinor: number;
  payments: P[];
}

export const paymentCycleStart = (p: CyclePaymentInput, anniversary: string | null): string => p.cycleStart ?? cycleStartOf(p.date, anniversary);

/**
 * সব বছরের সারাংশ, নতুন আগে। চলতি বছর পেমেন্ট না থাকলেও তালিকায় থাকে (হিরো কার্ডের জন্য)।
 * liveDueMinor = আজকের হিসাবে যাকাত (ফরজ না হলে 0)।
 */
export function summarizeCycles<P extends CyclePaymentInput>(
  payments: readonly P[],
  locks: readonly CycleLockInput[],
  anniversary: string | null,
  today: string,
  liveDueMinor: number,
): CycleSummary<P>[] {
  const currentStart = cycleStartOf(today, anniversary);
  const byStart = new Map<string, P[]>();
  for (const p of payments) {
    const k = paymentCycleStart(p, anniversary);
    byStart.set(k, [...(byStart.get(k) ?? []), p]);
  }
  for (const l of locks) if (!byStart.has(l.id)) byStart.set(l.id, []);
  if (!byStart.has(currentStart)) byStart.set(currentStart, []);
  const lockOf = new Map(locks.map((l) => [l.id, l.dueMinor]));
  return [...byStart.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((start) => {
      const list = [...(byStart.get(start) ?? [])].sort((a, b) => b.date.localeCompare(a.date));
      const paidMinor = list.reduce((s, p) => s + p.amountMinor, 0);
      const isCurrent = start === currentStart;
      const dueMinor = lockOf.get(start) ?? (isCurrent && liveDueMinor > 0 ? liveDueMinor : null);
      return {
        start,
        isCurrent,
        dueMinor,
        paidMinor,
        remainingMinor: dueMinor == null ? null : Math.max(0, dueMinor - paidMinor),
        overMinor: dueMinor == null ? 0 : Math.max(0, paidMinor - dueMinor),
        payments: list,
      };
    });
}

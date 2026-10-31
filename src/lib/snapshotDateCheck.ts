// Update Balances-এর Snapshot date যাচাই — pure। Cross-check window = (আগের snapshot-তারিখ + ১) … এই snapshot-তারিখ;
// তারিখ আগের snapshot-এর সমান/আগে হলে window খালি হয়ে Savings ০ ও ভুয়া Deviation আসে (owner-reported ২০২৬-১০-৩১)।

export type SnapshotDateVerdict =
  | { kind: 'ok' }
  | { kind: 'differs'; expected: string; daysOff: number } // daysOff > 0 = expected-এর পরে, < 0 = আগে
  | { kind: 'invalid'; previousDate: string };

const DAY = 86_400_000;
const utc = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd);
};

function lastDayOfMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** আগের (month-এর চেয়ে ছোট yyyymm) সব account-balance snapshot-এর মধ্যে সবচেয়ে নতুন তারিখ; না থাকলে null। */
export function previousSnapshotDate(balances: readonly { yyyymm: string; snapshotDate: string }[], month: string): string | null {
  let max: string | null = null;
  for (const b of balances) if (b.yyyymm < month && (max === null || b.snapshotDate > max)) max = b.snapshotDate;
  return max;
}

/** প্রত্যাশিত তারিখ: চলতি মাস হলে আজ, নাহলে মাসের শেষ দিন। */
export function expectedSnapshotDate(month: string, today: string): string {
  return month === today.slice(0, 7) ? today : lastDayOfMonth(month);
}

export function checkSnapshotDate(
  snapshotDate: string,
  month: string,
  today: string,
  balances: readonly { yyyymm: string; snapshotDate: string }[],
): SnapshotDateVerdict {
  const prev = previousSnapshotDate(balances, month);
  if (prev !== null && snapshotDate <= prev) return { kind: 'invalid', previousDate: prev };
  const expected = expectedSnapshotDate(month, today);
  if (snapshotDate !== expected) return { kind: 'differs', expected, daysOff: Math.round((utc(snapshotDate) - utc(expected)) / DAY) };
  return { kind: 'ok' };
}

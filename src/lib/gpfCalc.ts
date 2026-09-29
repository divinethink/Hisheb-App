// GPF ক্যালকুলেশন — pure, platform-independent (lib/ purity, Architecture Plan §০)।
export interface GpfEntryLike {
  amountMinor: number;
  type: 'contribution' | 'interest' | 'withdrawal';
}

/** Σcontribution + Σinterest − Σwithdrawal */
export function gpfTotalsMinor(entries: readonly GpfEntryLike[]) {
  let contributions = 0;
  let interest = 0;
  let withdrawals = 0;
  for (const e of entries) {
    if (e.type === 'contribution') contributions += e.amountMinor;
    else if (e.type === 'interest') interest += e.amountMinor;
    else withdrawals += e.amountMinor;
  }
  return { contributions, interest, withdrawals, balance: contributions + interest - withdrawals };
}

export function gpfBalanceMinor(entries: readonly GpfEntryLike[]): number {
  return gpfTotalsMinor(entries).balance;
}

/** বাংলাদেশ অর্থবছর (জুলাই–জুন): "2026-06-30" → "2025-26", "2026-07-01" → "2026-27" */
export function fiscalYearOf(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const start = m >= 7 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export interface GpfDatedLike extends GpfEntryLike {
  date: string; // YYYY-MM-DD
}

/** নির্দিষ্ট তারিখ পর্যন্ত (inclusive) GPF ব্যালেন্স — Net Worth snapshot/লাইভ Total Assets-এর জন্য (as-of)। */
export function gpfBalanceAsOfMinor(entries: readonly GpfDatedLike[], asOf: string): number {
  return gpfBalanceMinor(entries.filter((e) => e.date <= asOf));
}

/** window-এর (start..end, দুই প্রান্তই inclusive) GPF-এর নেট পরিবর্তন — Cross-check known-factor। */
export function gpfChangeInWindowMinor(entries: readonly GpfDatedLike[], start: string, end: string): number {
  return gpfBalanceMinor(entries.filter((e) => e.date >= start && e.date <= end));
}

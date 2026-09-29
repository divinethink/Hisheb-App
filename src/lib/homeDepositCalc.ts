// বাসায় ডিপোজিট ক্যালকুলেশন — pure, platform-independent (lib/ purity, Architecture Plan §০)।
export interface HomeDepositEntryLike {
  amountMinor: number;
  type: 'deposit' | 'withdrawal';
}

/** নেট ব্যালেন্স (per fund বা সব ফান্ড মিলিয়ে) = Σ(deposit) − Σ(withdrawal) — এটাই Net Worth-এ সিংক হয় (§৪.৫)। */
export function netBalanceMinor(entries: readonly HomeDepositEntryLike[]): number {
  return entries.reduce((s, e) => s + (e.type === 'deposit' ? e.amountMinor : -e.amountMinor), 0);
}

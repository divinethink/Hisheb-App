// বাজার দরের pure হিসাব (React/Firebase ছাড়া)।
import type { PriceEntry } from '../validation/marketSchema';
import { MARKET_HISTORY_MAX } from '../validation/marketSchema';

/** নতুন দাম যোগ: একই তারিখে আগে থাকলে সেটা বদলে যায় (ভুল শুধরানো), নতুন-আগে সাজিয়ে সর্বোচ্চ ৫টা রাখে। */
export function pushPrice(history: readonly PriceEntry[], entry: PriceEntry, max: number = MARKET_HISTORY_MAX): PriceEntry[] {
  return [entry, ...history.filter((h) => h.date !== entry.date)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, max);
}

/** ১ এককের দাম: পরিমাণ থাকলে দাম ÷ পরিমাণ (৫০০ গ্রাম ২৫০৳ → ১ গ্রাম নয়, ঐ এককেই ১ ইউনিট), নইলে দাম যেমন আছে। */
export function perUnitMinor(e: PriceEntry): number {
  return e.qty && e.qty > 0 ? Math.round(e.priceMinor / e.qty) : e.priceMinor;
}

/** একক (কেজি/গ্রাম…) এক না হলে দুই দাম সরাসরি তুলনাযোগ্য নয় — ভুল তুলনা দেখানোর চেয়ে দেখানো হয় না। */
export function comparable(a: PriceEntry, b: PriceEntry): boolean {
  return (a.unit ?? '') === (b.unit ?? '');
}

export interface PriceTrend {
  diffMinor: number; // বর্তমান − আগের
  pct: number; // শতাংশ (১ দশমিক পর্যন্ত)
}

/** বর্তমান বনাম ঠিক আগের দাম; তুলনার মতো দুটো দাম না থাকলে null। */
export function priceTrend(history: readonly PriceEntry[]): PriceTrend | null {
  const cur = history[0];
  const prev = history[1];
  if (!cur || !prev || !comparable(cur, prev)) return null;
  const a = perUnitMinor(cur);
  const b = perUnitMinor(prev);
  return { diffMinor: a - b, pct: Math.round(((a - b) / b) * 1000) / 10 };
}

/** ইতিহাসের সর্বনিম্ন/সর্বোচ্চ (১ এককের দামে, শুধু বর্তমানের সাথে একই এককের এন্ট্রি); দুইয়ের কম হলে null। */
export function priceRange(history: readonly PriceEntry[]): { lowMinor: number; highMinor: number } | null {
  const cur = history[0];
  if (!cur) return null;
  const same = history.filter((h) => comparable(cur, h));
  if (same.length < 2) return null;
  const prices = same.map(perUnitMinor);
  return { lowMinor: Math.min(...prices), highMinor: Math.max(...prices) };
}

/** ক্রম বদল (up/down): পাশের এন্ট্রির সাথে order অদলবদল। সীমায় থাকলে null। */
export function swapTarget<T extends { id: string; order: number; name: string }>(
  sorted: readonly T[],
  id: string,
  dir: -1 | 1,
): [T, T] | null {
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return null;
  return [sorted[i], sorted[j]];
}

export function sortByOrder<T extends { order: number; name: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** নতুন এন্ট্রির order: শেষে বসে (gap-based, Architecture Plan §২.২ order-নোট)। */
export function nextOrder(list: readonly { order: number }[]): number {
  return list.reduce((m, x) => Math.max(m, x.order), 0) + 100;
}

/** সার্চ: নাম বা মন্তব্যে মেলে (ছোট-বড় হাতের পার্থক্য নেই)। */
export function matchesQuery(name: string, note: string, q: string): boolean {
  const s = q.trim().toLowerCase();
  return s === '' || name.toLowerCase().includes(s) || note.toLowerCase().includes(s);
}

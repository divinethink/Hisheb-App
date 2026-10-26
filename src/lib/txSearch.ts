// Home সার্চের pure ফিল্টার (UI/DB-মুক্ত): ক্যাটাগরি, নোট, লেবেল ও অঙ্ক — সব মাসের লেনদেনে।
import type { TxLike } from './summary';

export interface SearchableTx extends TxLike {
  categoryName: string;
  note: string;
  labelNames: readonly string[];
}

/** minor (পয়সা) → "315" বা "315.5" (গ্রুপিং/কমা ছাড়া) — অঙ্ক-সার্চের জন্য */
function takaString(minor: number): string {
  const taka = Math.trunc(minor / 100);
  const paisa = minor % 100;
  return paisa ? `${taka}.${String(paisa).padStart(2, '0').replace(/0$/, '')}` : String(taka);
}

/**
 * query খালি → []। টেক্সট: category/note/label-এ case-insensitive substring।
 * অঙ্ক: query (কমা ও "BDT"/"৳" বাদে) সংখ্যা হলে taka-অঙ্কের substring মিললে ম্যাচ ("315" → 315, 3150)।
 * ফল: তারিখে নতুন → পুরনো, একই দিনে occurredAt-এ নতুন আগে।
 */
export function searchTransactions<T extends SearchableTx>(txs: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const num = q.replace(/bdt|৳|,|\s/g, '');
  const numeric = /^\d+(\.\d{1,2})?$/.test(num) ? num : null;
  const hits = txs.filter((t) => {
    if (t.categoryName.toLowerCase().includes(q)) return true;
    if (t.note.toLowerCase().includes(q)) return true;
    if (t.labelNames.some((l) => l.toLowerCase().includes(q))) return true;
    return numeric !== null && takaString(t.amountMinor).includes(numeric);
  });
  return hits.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.occurredAt.toDate().getTime() - a.occurredAt.toDate().getTime(),
  );
}

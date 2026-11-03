// খাতের নাম মেলানো — pure। Excel-এর পুরনো নাম (Father, Grocery, Hotel/Launch…) → অ্যাপের খাত (বাবা, Groceries, হোটেলে খাওয়া…)।
// বানান/স্পেস/বড়-ছোট হাত/ইংরেজি↔বাংলা ভিন্ন হলেও সঠিক খাতে বসায়; নিশ্চিত না হলে sure=false (owner যাচাই করবে)।

/** শুধু অক্ষর+সংখ্যা+মাত্রা-চিহ্ন রেখে, ছোট হাতের (NFKC) কী — স্পেস/যতিচিহ্ন/কেস পার্থক্য উপেক্ষা। */
export function normKey(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, '');
}

const tokens = (s: string): string[] => s.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);

// শব্দ → ধারণা (concept); একই ধারণার ইংরেজি/বাংলা রূপ এক হয়ে যায়
const CONCEPTS: Record<string, readonly string[]> = {
  housing: ['house', 'rent', 'elec', 'electricity', 'gas', 'internet', 'বাসা', 'বিদ্যুৎ', 'গ্যাস', 'ইন্টারনেট', 'ময়লা', 'বাসাভাড়া'],
  grocery: ['grocery', 'groceries', 'মুদি', 'বাজার'],
  father: ['father', 'বাবা', 'বাবার', 'আব্বা', 'দাদা', 'দাদার'],
  mother: ['mother', 'মা', 'মায়ের', 'আম্মা', 'নানা', 'নানার'],
  wife: ['wife', 'স্ত্রী', 'স্ত্রীর'],
  side: ['side', 'পক্ষ'],
  hotel: ['hotel', 'হোটেল', 'হোটেলে', 'restaurant', 'রেস্টুরেন্ট'],
  meal: ['launch', 'lunch', 'খাওয়া', 'খাবার', 'meal'],
  tea: ['tea', 'চা', 'নাস্তা', 'snacks', 'snack'],
  other: ['others', 'other', 'অন্যান্য', 'misc'],
  gift: ['gift', 'উপহার'],
  donate: ['donate', 'donation', 'দান'],
  visit: ['রোগী', 'বেড়াতে', 'দেখতে', 'visit'],
  shopping: ['shopping', 'কেনাকাটা', 'কেনাকাটার'],
  essentials: ['odds', 'ends', 'প্রয়োজনীয়', 'জিনিসপত্র', 'essentials'],
  family: ['family', 'পরিবার', 'পরিবারের'],
  travel: ['tour', 'travel', 'ভ্রমণ'],
  transport: ['transportation', 'transport', 'যাতায়াত'],
  hasan: ['hasan', 'হাসান'],
  loan: ['ধার', 'শোধ', 'loan', 'repay'],
};
const STOP = new Set(['cost', 'ব্যয়', 'খরচ', 'বিভিন্ন', 'খাতে', 'খাত', 'বাড়ি', 'and', 'the', 'of', 'fruits', 'sweets', 'tuhin', 'তুহিন', 'online', 'অনলাইন', 'order', 'অর্ডার']);
const WORD2CONCEPT = new Map<string, string>();
for (const [c, ws] of Object.entries(CONCEPTS)) for (const w of ws) WORD2CONCEPT.set(w.normalize('NFKC').toLowerCase(), c);

function conceptSet(s: string): Set<string> {
  const out = new Set<string>();
  for (const t of tokens(s)) {
    if (STOP.has(t)) continue;
    out.add(WORD2CONCEPT.get(t) ?? t);
  }
  return out;
}

function conceptScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  if (inter === 0) return 0;
  const jac = inter / (a.size + b.size - inter);
  const subset = inter === a.size || inter === b.size; // একটা অন্যটার অংশ (Hasan ⊂ Hasan Tuhin)
  return subset ? 0.5 + 0.5 * jac : jac;
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}
/** বানান-ভুল ধরার জন্য: bigram Dice (0..1) */
function dice(a: string, b: string): number {
  if (a === b) return a.length ? 1 : 0;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  const pool = new Map<string, number>();
  for (const g of bb) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of ba) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      hit++;
      pool.set(g, n - 1);
    }
  }
  return (2 * hit) / (ba.length + bb.length);
}

const SURE_MIN = 0.6; // এর নিচে মিল ধরা হয় না
const SURE_MARGIN = 0.2; // সেরা বনাম দ্বিতীয় — এর কম ফারাকে "অনিশ্চিত"

export interface CategoryMatch {
  /** সেরা মিলের অ্যাপ-খাত; ≥ SURE_MIN না হলে null */
  suggestion: string | null;
  /** true = একক স্পষ্ট বিজয়ী (auto-pick নিরাপদ); false = টাই/কাছাকাছি/কম — owner যাচাই করবে */
  sure: boolean;
  score: number;
}

export function matchCategory(name: string, candidates: readonly string[]): CategoryMatch {
  const key = normKey(name);
  const cs = conceptSet(name);
  const scored = candidates
    .map((c, i) => {
      const ck = normKey(c);
      if (ck === key) return { c, i, score: 1, exact: true, d: 1 };
      const d = dice(key, ck);
      return { c, i, score: Math.max(conceptScore(cs, conceptSet(c)), d), exact: false, d };
    })
    .sort((x, y) => y.score - x.score || y.d - x.d || x.i - y.i); // টাইয়ে বানানে কাছেরটা আগে
  const best = scored[0];
  if (!best || best.score < SURE_MIN) return { suggestion: null, sure: false, score: best?.score ?? 0 };
  if (best.exact) return { suggestion: best.c, sure: true, score: 1 };
  const second = scored[1];
  const sure = !second || best.score - second.score >= SURE_MARGIN;
  return { suggestion: best.c, sure, score: best.score };
}

export interface NamedAmount {
  name: string;
  amountMinor: number;
}

/** একই (normKey) নামের সারি যোগ করে এক করে — একই খাত দুই লাইনে আসা বন্ধ। প্রথম নামটাই দেখানো নাম। */
export function mergeByKey(items: readonly NamedAmount[]): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const it of items) {
    const k = normKey(it.name);
    const e = map.get(k);
    if (e) e.amountMinor += it.amountMinor;
    else map.set(k, { name: it.name, amountMinor: it.amountMinor });
  }
  return [...map.values()];
}

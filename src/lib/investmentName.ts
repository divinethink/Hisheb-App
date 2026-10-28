// ইনভেস্টমেন্ট নাম/Round/Medium-সাজেশনের pure হিসাব — UI ও SDK-মুক্ত (Architecture Plan §০ purity)।
// Round [n] = Medium-এর (যেমন biniyog.io) দেওয়া ক্রম; Owner শুধু সংখ্যা লেখেন, ব্র্যাকেট অ্যাপ বসায়।

/** "Apon Bazaar" + 9 → "Apon Bazaar [9]"; round না থাকলে শুধু নাম। */
export function composeInvestmentName(base: string, round: number | null): string {
  const b = base.trim();
  return round === null ? b : `${b} [${round}]`;
}

/** সংরক্ষিত investedTo থেকে বেস-নাম: শেষে হুবহু " [round]" থাকলেই কেবল কাটে, নইলে অপরিবর্তিত। */
export function baseInvestmentName(investedTo: string, round: number | null | undefined): string {
  if (round === null || round === undefined) return investedTo;
  const suffix = ` [${round}]`;
  return investedTo.endsWith(suffix) ? investedTo.slice(0, -suffix.length) : investedTo;
}

/** শুধু রঙ/অক্ষর ঠিক করতে: নামের শেষের " [n]" বাদ — একই কোম্পানির সব রাউন্ডে একই ব্যাজ-রং। নাম নিজে বদলায় না (পুরনো [9] অক্ষত)। */
export function stripRoundTag(name: string): string {
  return name.replace(/\s*\[\s*\d+\s*\]\s*$/, '').trim() || name;
}

/** নামের শেষে নিজে লেখা "[সংখ্যা]" আছে কিনা — Round-ফিল্ড ভরা থাকলে দ্বিগুণ ব্র্যাকেট এড়াতে। */
export function hasTrailingRoundTag(name: string): boolean {
  return /\[\s*\d+\s*\]\s*$/.test(name);
}

/** Round-ফিল্ডের ইনপুট: ফাঁকা → null (ঠিক); ১–৯৯৯ পূর্ণসংখ্যা → সংখ্যা; অন্যথায় 'invalid'। */
export function parseRoundInput(raw: string): number | null | 'invalid' {
  const t = raw.trim();
  if (t === '') return null;
  if (!/^\d{1,3}$/.test(t)) return 'invalid';
  const n = Number(t);
  return n > 0 ? n : 'invalid';
}

interface RoundLike {
  companyId?: string | null;
  round?: number | null;
  date: string;
}

/** হিন্ট "Last: n" — ওই কোম্পানির Round-সহ সর্বশেষ (তারিখ, তারপর বড় Round) এন্ট্রির Round; নেই হলে null। নিজে বসায় না। */
export function lastRoundForCompany(
  investments: readonly RoundLike[],
  companyId: string,
  excludeSelf?: RoundLike | null,
): number | null {
  let best: RoundLike | null = null;
  for (const i of investments) {
    if (i === excludeSelf || i.companyId !== companyId || !i.round) continue;
    if (!best || i.date > best.date || (i.date === best.date && i.round > (best.round ?? 0))) best = i;
  }
  return best?.round ?? null;
}

/**
 * Medium সাজেশন: কোম্পানির নিজের Medium সবার আগে, তারপর পুরনো এন্ট্রিতে ব্যবহৃত Medium (ব্যবহারের সংখ্যায় বেশি আগে)।
 * কখনো ঘরে নিজে বসে না — শুধু তালিকা। typed টেক্সট দিয়ে ছাঁকা; হুবহু মিলে গেলে সেটি বাদ।
 */
export function mediumSuggestions(
  usedMediums: readonly string[],
  companyMedium: string,
  typed: string,
  limit = 6,
): string[] {
  const counts = new Map<string, number>();
  for (const m of usedMediums) {
    const t = m.trim();
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m);
  const cm = companyMedium.trim();
  const list = cm ? [cm, ...ordered.filter((m) => m !== cm)] : ordered;
  const q = typed.trim().toLowerCase();
  return list.filter((m) => m.toLowerCase() !== q && (!q || m.toLowerCase().includes(q))).slice(0, limit);
}

/** কোম্পানির নাম আগে থেকে আছে কিনা (বড়-ছোট হাত অগ্রাহ্য) — selfId নিজেকে বাদ দেয়। */
export function companyNameTaken(
  companies: readonly { id: string; name: string }[],
  name: string,
  selfId?: string,
): boolean {
  const n = name.trim().toLowerCase();
  return companies.some((c) => c.id !== selfId && c.name.trim().toLowerCase() === n);
}

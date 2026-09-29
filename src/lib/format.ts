// DF9 (owner-approved): lakh-style grouping — 162417 → "1,62,417"। UI-ভাষা ইংরেজি, "BDT" প্রিফিক্স।
function lakhGroup(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${s.slice(-3)}`;
}

/** minor (পয়সা) → "BDT 1,62,417" (পয়সা থাকলে ২ দশমিক) */
export function formatAmount(minor: number): string {
  const abs = Math.abs(minor);
  const taka = Math.trunc(abs / 100);
  const paisa = abs % 100;
  const body = lakhGroup(taka) + (paisa ? `.${String(paisa).padStart(2, '0')}` : '');
  return `BDT ${body}`;
}

/** ব্যয়ে "−", আয়ে "+" — রঙের পাশাপাশি চিহ্নও (accessibility) */
export function formatSigned(minor: number, type: 'income' | 'expense'): string {
  return `${type === 'expense' ? '−' : '+'}${formatAmount(minor)}`;
}

/** সঞ্চয়/ঘাটতি: ধনাত্মক হলে "+", ঋণাত্মক হলে "−" */
export function formatNet(minor: number): string {
  if (minor === 0) return formatAmount(0);
  return `${minor > 0 ? '+' : '−'}${formatAmount(minor)}`;
}

/** ক্যাটাগরি/মডিউল-নাম থেকে deterministic color-index (0..mod-1) — UI Polish: Home আইকন-বৃত্ত ও
 *  Overview donut/bar একই নামের জন্য সবসময় একই রঙ পায় (কেন্দ্রীভূত single hash, চার্ট-প্যালেট tokens.css-এ)। */
export function categoryColorIndex(name: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % mod;
}

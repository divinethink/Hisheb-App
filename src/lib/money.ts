// টাকা ↔ পয়সা (integer minor unit)। Float ব্যবহার নেই: "1.005"-জাতীয় মানে Math.round(parseFloat*100)
// ভুল দিতে পারে, তাই স্ট্রিং ভেঙে integer গণনা (ফলাফল একই, কিন্তু নির্ভুল)।
const AMOUNT_RE = /^(\d{1,12})(?:\.(\d{1,2}))?$/;

/** "1,250.5" → 125050। অবৈধ, শূন্য বা ঋণাত্মক হলে null (R1: শুধু ধনাত্মক)। */
export function parseAmountToMinor(input: string): number | null {
  const s = input.replace(/[,\s]/g, '');
  const m = AMOUNT_RE.exec(s);
  if (!m) return null;
  const frac = (m[2] ?? '').padEnd(2, '0');
  const minor = Number(m[1]) * 100 + Number(frac || '0');
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** 125050 → "1250.5" (edit-ফর্মে দেখানোর জন্য, গ্রুপিং ছাড়া) */
export function minorToInput(minor: number): string {
  const taka = Math.trunc(minor / 100);
  const paisa = minor % 100;
  if (paisa === 0) return String(taka);
  return `${taka}.${String(paisa).padStart(2, '0').replace(/0$/, '')}`;
}

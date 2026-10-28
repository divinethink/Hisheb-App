// PDF চুক্তিপত্র (ধাপ ৩) — pure যাচাই, UI/SDK-মুক্ত। ফাইল শুধু PDF, সর্বোচ্চ ১০MB।
export const MAX_CONTRACT_BYTES = 10 * 1024 * 1024;
export const CONTRACT_NAME_MAX = 120; // firestore.rules-এর সীমার সাথে মিল রাখতে হবে

export type ContractFileProblem = 'empty' | 'not_pdf' | 'too_big';

/** নাম/টাইপ/সাইজ দেখে প্রাথমিক যাচাই। কিছু ফোনে type ফাঁকা আসে, তাই .pdf নামও গ্রহণযোগ্য; আসল যাচাই hasPdfMagic-এ। */
export function checkContractMeta(f: { name: string; type: string; size: number }): ContractFileProblem | null {
  if (f.size <= 0) return 'empty';
  const looksPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name.trim());
  if (!looksPdf) return 'not_pdf';
  if (f.size > MAX_CONTRACT_BYTES) return 'too_big';
  return null;
}

/** ফাইলের শুরুর বাইট "%PDF-" কিনা (নাম বদলে অন্য ফাইল ঢোকানো আটকায়)। */
export function hasPdfMagic(head: Uint8Array): boolean {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return head.length >= sig.length && sig.every((b, i) => head[i] === b);
}

export function contractProblemMessage(p: ContractFileProblem): string {
  if (p === 'too_big') return 'PDF is larger than 10 MB.';
  if (p === 'empty') return 'This file is empty.';
  return 'Only PDF files are allowed.';
}

/** Drive/Firestore-এ রাখার নাম: trim, নিয়ন্ত্রণ-অক্ষর বাদ, সর্বোচ্চ ১২০ (".pdf" শেষে থাকে)। */
export function safeContractName(name: string): string {
  // নিয়ন্ত্রণ-অক্ষর (<0x20, 0x7f) ও / \ কে স্পেস করা হয়; regex নয় (ESLint no-control-regex এড়াতে)
  const stripped = Array.from(name, (ch) => {
    const c = ch.codePointAt(0) ?? 0;
    return c < 0x20 || c === 0x7f || ch === '/' || ch === '\\' ? ' ' : ch;
  }).join('');
  const cleaned = stripped.replace(/\s+/g, ' ').trim() || 'contract.pdf';
  if (cleaned.length <= CONTRACT_NAME_MAX) return cleaned;
  const hasExt = /\.pdf$/i.test(cleaned);
  const keep = CONTRACT_NAME_MAX - (hasExt ? 4 : 0);
  return cleaned.slice(0, keep).trimEnd() + (hasExt ? '.pdf' : '');
}

// gpf_import.csv পার্স — pure (PapaParse ছাড়া কোনো SDK/UI নির্ভরতা নেই)।
// কলাম: date,type,amount,fiscalYear,salaryMonth,accountingMonth[,importKey]
// `amount` = পূর্ণ টাকা (দশমিক ছাড়া, যেমন 1213) → amountMinor = amount × 100। পুরনো `amountMinor` কলামের ফাইল
// গ্রহণ হয় না (সব row invalid-amount) — ১০০ গুণ কম ধরা পড়ার ঝুঁকি এড়াতে।
import Papa from 'papaparse';
import { fiscalYearOf } from './gpfCalc';

export interface GpfImportRow {
  date: string;
  type: 'contribution' | 'interest' | 'withdrawal';
  amountMinor: number;
  fiscalYear: string;
  salaryMonth: string;
  accountingMonth: string;
  importKey: string;
}
export interface GpfSkipped {
  line: number;
  reason: 'invalid-date' | 'invalid-type' | 'invalid-amount';
}

const TYPES = ['contribution', 'interest', 'withdrawal'] as const;

export function parseGpfCsv(text: string): { rows: GpfImportRow[]; skipped: GpfSkipped[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const rows: GpfImportRow[] = [];
  const skipped: GpfSkipped[] = [];
  const seen = new Set<string>();
  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const date = (r.date ?? '').trim();
    const type = (r.type ?? '').trim();
    const amountRaw = (r.amount ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped.push({ line, reason: 'invalid-date' });
      return;
    }
    if (!(TYPES as readonly string[]).includes(type)) {
      skipped.push({ line, reason: 'invalid-type' });
      return;
    }
    if (!/^\d{1,12}$/.test(amountRaw) || Number(amountRaw) <= 0) {
      skipped.push({ line, reason: 'invalid-amount' });
      return;
    }
    const amountMinor = Number(amountRaw) * 100;
    const importKey = (r.importKey ?? '').trim() || `gpf|${date}|${type}|${amountMinor}`;
    if (seen.has(importKey)) return; // ফাইলের ভেতরের হুবহু ডুপ্লিকেট এড়াতে
    seen.add(importKey);
    rows.push({
      date,
      type: type as GpfImportRow['type'],
      amountMinor,
      fiscalYear: (r.fiscalYear ?? '').trim() || fiscalYearOf(date),
      salaryMonth: (r.salaryMonth ?? '').trim(),
      accountingMonth: (r.accountingMonth ?? '').trim(),
      importKey,
    });
  });
  return { rows, skipped };
}

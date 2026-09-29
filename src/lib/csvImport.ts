// Spendee CSV পার্স + dedup — Firestore-নিরপেক্ষ (SDK import নেই, unit-test করা যায়)।
// কলাম: Date, Wallet, Type, Category name, Amount, Currency, Note, Labels, Author (Roadmap §২)।
import Papa from 'papaparse';
import { toDhakaDate } from './date';

export type TxType = 'income' | 'expense';

export interface ParsedRow {
  occurredAt: Date; // CSV-র মূল UTC instant
  date: string; // Asia/Dhaka YYYY-MM-DD (E3: timezone-conversion বাধ্যতামূলক)
  type: TxType;
  categoryName: string; // trim()-করা, "/" delimiter না — naming-convention (Roadmap §২)
  labelName: string | null; // trim()-করা, একটাই (multi-value delimiter এই ফরম্যাটে নেই)
  amountMinor: number; // সবসময় ধনাত্মক int (R1)
  note: string;
  importKey: string;
}

export interface SkippedRow {
  rowIndex: number;
  reason: 'sign-mismatch' | 'invalid-type' | 'invalid-date' | 'invalid-amount' | 'missing-category';
  raw: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedRow[];
  skipped: SkippedRow[];
}

/** FNV-1a — deterministic, dependency-free, sync (importKey-এর জন্য যথেষ্ট, cryptographic দরকার নেই)। */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** hash(occurredAt UTC ISO + type + amountMinor + trim-করা categoryName) — Final Review R1 */
export function importKeyFor(row: Pick<ParsedRow, 'occurredAt' | 'type' | 'amountMinor' | 'categoryName'>): string {
  return fnv1a(`${row.occurredAt.toISOString()}|${row.type}|${row.amountMinor}|${row.categoryName}`);
}

function toMinor(amountAbs: number): number | null {
  if (!Number.isFinite(amountAbs) || amountAbs <= 0) return null;
  const minor = Math.round(amountAbs * 100);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** একটা CSV ফাইলের টেক্সট পার্স করে ParsedRow[] + skip-হওয়া row-এর কারণ ফেরত দেয়। */
export function parseSpendeeCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  const rows: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];

  parsed.data.forEach((raw, i) => {
    const typeRaw = (raw['Type'] ?? '').trim();
    if (typeRaw !== 'Expense' && typeRaw !== 'Income') {
      skipped.push({ rowIndex: i, reason: 'invalid-type', raw });
      return;
    }
    const type: TxType = typeRaw === 'Expense' ? 'expense' : 'income';

    const dateRaw = (raw['Date'] ?? '').trim();
    const occurredAt = new Date(dateRaw);
    if (Number.isNaN(occurredAt.getTime())) {
      skipped.push({ rowIndex: i, reason: 'invalid-date', raw });
      return;
    }

    const categoryName = (raw['Category name'] ?? '').trim();
    if (!categoryName) {
      skipped.push({ rowIndex: i, reason: 'missing-category', raw });
      return;
    }

    const amountRaw = Number.parseFloat((raw['Amount'] ?? '').trim());
    if (Number.isNaN(amountRaw)) {
      skipped.push({ rowIndex: i, reason: 'invalid-amount', raw });
      return;
    }
    // sign-validation (E-audit 2026-09-17): Expense→negative, Income→positive
    if ((type === 'expense' && amountRaw >= 0) || (type === 'income' && amountRaw <= 0)) {
      skipped.push({ rowIndex: i, reason: 'sign-mismatch', raw });
      return;
    }
    const amountMinor = toMinor(Math.abs(amountRaw));
    if (amountMinor === null) {
      skipped.push({ rowIndex: i, reason: 'invalid-amount', raw });
      return;
    }

    const labelName = (raw['Labels'] ?? '').trim() || null;
    const note = (raw['Note'] ?? '').trim();
    const date = toDhakaDate(occurredAt);

    rows.push({
      occurredAt,
      date,
      type,
      categoryName,
      labelName,
      amountMinor,
      note,
      importKey: importKeyFor({ occurredAt, type, amountMinor, categoryName }),
    });
  });

  return { rows, skipped };
}

/** একাধিক ফাইলের ParseResult union করে (Roadmap §২: importer একাধিক CSV একসাথে নেয়)। */
export function mergeParseResults(results: ParseResult[]): ParseResult {
  return {
    rows: results.flatMap((r) => r.rows),
    skipped: results.flatMap((r) => r.skipped),
  };
}

export interface AutoMergedGroup {
  key: string;
  kept: ParsedRow;
  duplicates: ParsedRow[]; // kept বাদে বাকিগুলো
}

export interface DedupResult {
  kept: ParsedRow[]; // same-importKey auto-collapse-এর পর (১টা প্রতি key)
  autoMerged: AutoMergedGroup[]; // কখনো silent না (B3) — owner-কে দেখানোর জন্য
  reviewGroups: ParsedRow[][]; // amount+category+date মিললে (সেকেন্ড ভিন্ন) — manual review
}

/** দুই-স্তর dedup (Roadmap §২): (ক) same-second+amount+category auto-collapse, (খ) amount+category+date → review। */
export function dedupeRows(rows: ParsedRow[]): DedupResult {
  const byKey = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    const list = byKey.get(r.importKey) ?? [];
    list.push(r);
    byKey.set(r.importKey, list);
  }
  const kept: ParsedRow[] = [];
  const autoMerged: AutoMergedGroup[] = [];
  for (const [key, list] of byKey) {
    kept.push(list[0]);
    if (list.length > 1) autoMerged.push({ key, kept: list[0], duplicates: list.slice(1) });
  }

  const byDateAmountCat = new Map<string, ParsedRow[]>();
  for (const r of kept) {
    const k = `${r.date}|${r.amountMinor}|${r.categoryName}`;
    const list = byDateAmountCat.get(k) ?? [];
    list.push(r);
    byDateAmountCat.set(k, list);
  }
  const reviewGroups = [...byDateAmountCat.values()].filter((g) => g.length > 1);

  return { kept, autoMerged, reviewGroups };
}

/** min/max date বের করে (dedup-query bounded রাখতে, Improvement 2026-09-17)। খালি হলে null। */
export function dateRangeOf(rows: ParsedRow[]): { min: string; max: string } | null {
  if (rows.length === 0) return null;
  let min = rows[0].date;
  let max = rows[0].date;
  for (const r of rows) {
    if (r.date < min) min = r.date;
    if (r.date > max) max = r.date;
  }
  return { min, max };
}

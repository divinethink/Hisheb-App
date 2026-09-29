import { describe, it, expect } from 'vitest';
import { parseSpendeeCsv, mergeParseResults, dedupeRows, dateRangeOf, importKeyFor } from './csvImport';

const HEADER = 'Date,Wallet,Type,"Category name",Amount,Currency,Note,Labels,Author';

function csv(rows: string[]): string {
  return [HEADER, ...rows].join('\n');
}

describe('parseSpendeeCsv', () => {
  it('parses a valid expense row (UTC→Asia/Dhaka date conversion)', () => {
    // 23:xx UTC → পরদিন Dhaka (UTC+6)
    const { rows, skipped } = parseSpendeeCsv(
      csv(['2025-09-19T23:30:00+00:00,Wallet,Expense,Groceries,-135.00000000,BDT,note,,Author']),
    );
    expect(skipped).toHaveLength(0);
    expect(rows[0]).toMatchObject({ type: 'expense', date: '2025-09-20', amountMinor: 13500, categoryName: 'Groceries' });
  });

  it('parses a valid income row', () => {
    const { rows } = parseSpendeeCsv(csv(['2026-01-01T13:43:03+00:00,Wallet,Income,Salary,41269.00000000,BDT,,,Author']));
    expect(rows[0]).toMatchObject({ type: 'income', amountMinor: 4126900 });
  });

  it('skips sign-mismatch rows (E-audit 2026-09-17)', () => {
    const { rows, skipped } = parseSpendeeCsv(csv(['2026-01-01T00:00:00+00:00,Wallet,Expense,Groceries,135.00000000,BDT,,,Author']));
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toBe('sign-mismatch');
  });

  it('skips Transfer / unknown type rows', () => {
    const { rows, skipped } = parseSpendeeCsv(csv(['2026-01-01T00:00:00+00:00,Wallet,Transfer,X,10.00,BDT,,,Author']));
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toBe('invalid-type');
  });

  it('treats "/" in category/label as part of the name, not a delimiter (E4)', () => {
    const { rows } = parseSpendeeCsv(csv(['2025-09-20T07:46:47+00:00,Wallet,Expense,"Groceries/Fruits/Sweets",-400.00000000,BDT,Milk,"Fruits/Sweet/Dry Foods",Author']));
    expect(rows[0].categoryName).toBe('Groceries/Fruits/Sweets');
    expect(rows[0].labelName).toBe('Fruits/Sweet/Dry Foods');
  });

  it('trims trailing spaces on category/label (Roadmap §২)', () => {
    const { rows } = parseSpendeeCsv(csv(['2025-09-19T07:47:45+00:00,Wallet,Expense,"প্রয়োজনীয় জিনিসপত্র ",-160.00000000,BDT,,,Author']));
    expect(rows[0].categoryName).toBe('প্রয়োজনীয় জিনিসপত্র');
  });
});

describe('importKeyFor', () => {
  it('is deterministic and differs on any input field', () => {
    const base = { occurredAt: new Date('2026-01-01T00:00:00Z'), type: 'expense' as const, amountMinor: 100, categoryName: 'A' };
    expect(importKeyFor(base)).toBe(importKeyFor({ ...base }));
    expect(importKeyFor(base)).not.toBe(importKeyFor({ ...base, amountMinor: 200 }));
    expect(importKeyFor(base)).not.toBe(importKeyFor({ ...base, type: 'income' }));
  });
});

describe('dedupeRows', () => {
  it('auto-collapses same-second + amount + category duplicates (never silent)', () => {
    // বাস্তব reference-ফাইলের triplicate "Moyla bill" প্যাটার্ন (একই সেকেন্ডে ৩টা)
    const { rows } = parseSpendeeCsv(
      csv([
        '2025-11-06T05:28:34+00:00,Wallet,Expense,Utilities,-120.00000000,BDT,Moyla,,Author',
        '2025-11-06T05:28:34+00:00,Wallet,Expense,Utilities,-120.00000000,BDT,Moyla,,Author',
        '2025-11-06T05:28:34+00:00,Wallet,Expense,Utilities,-120.00000000,BDT,Moyla,,Author',
      ]),
    );
    const { kept, autoMerged, reviewGroups } = dedupeRows(rows);
    expect(kept).toHaveLength(1);
    expect(autoMerged).toHaveLength(1);
    expect(autoMerged[0].duplicates).toHaveLength(2);
    expect(reviewGroups).toHaveLength(0);
  });

  it('flags same amount+category+date but different second as review candidates', () => {
    const { rows } = parseSpendeeCsv(
      csv([
        '2026-09-03T02:14:01+00:00,Wallet,Expense,Groceries,-300.00000000,BDT,,,Author',
        '2026-09-03T02:14:26+00:00,Wallet,Expense,Groceries,-300.00000000,BDT,,,Author',
      ]),
    );
    const { kept, autoMerged, reviewGroups } = dedupeRows(rows);
    expect(kept).toHaveLength(2);
    expect(autoMerged).toHaveLength(0);
    expect(reviewGroups).toHaveLength(1);
    expect(reviewGroups[0]).toHaveLength(2);
  });

  it('does not flag distinct amount/category/date rows', () => {
    const { rows } = parseSpendeeCsv(
      csv([
        '2026-01-01T00:00:00+00:00,Wallet,Expense,Groceries,-100.00000000,BDT,,,Author',
        '2026-01-02T00:00:00+00:00,Wallet,Expense,Groceries,-100.00000000,BDT,,,Author',
      ]),
    );
    const { kept, autoMerged, reviewGroups } = dedupeRows(rows);
    expect(kept).toHaveLength(2);
    expect(autoMerged).toHaveLength(0);
    expect(reviewGroups).toHaveLength(0);
  });
});

describe('mergeParseResults', () => {
  it('unions rows/skipped across multiple files', () => {
    const a = parseSpendeeCsv(csv(['2026-01-01T00:00:00+00:00,Wallet,Expense,X,-10.00,BDT,,,Author']));
    const b = parseSpendeeCsv(csv(['2026-01-02T00:00:00+00:00,Wallet,Income,Y,10.00,BDT,,,Author']));
    const merged = mergeParseResults([a, b]);
    expect(merged.rows).toHaveLength(2);
  });
});

describe('dateRangeOf', () => {
  it('returns min/max date, null when empty', () => {
    expect(dateRangeOf([])).toBeNull();
    const { rows } = parseSpendeeCsv(
      csv([
        '2026-01-05T00:00:00+00:00,Wallet,Expense,X,-10.00,BDT,,,Author',
        '2026-01-01T00:00:00+00:00,Wallet,Expense,X,-10.00,BDT,,,Author',
      ]),
    );
    expect(dateRangeOf(rows)).toEqual({ min: '2026-01-01', max: '2026-01-05' });
  });
});

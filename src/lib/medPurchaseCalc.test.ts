import { describe, expect, it } from 'vitest';
import { buildMemoHtml, doseQty, memoLine, buildMemoText, filterPurchases, groupByKind, sortPurchases, suggestNames, totalMinor, yearsOf } from './medPurchaseCalc';
import type { MedPurchase } from '../validation/medPurchaseSchema';

const mk = (o: Partial<MedPurchase>): MedPurchase => ({
  id: 'x', kind: 'medicine', name: 'Napa', dose: '500mg', quantity: null, amountMinor: 5000, date: '2026-03-01', patient: 'আমি', note: '', createdAt: null, updatedAt: null, ...o,
});
const L = [
  mk({ id: 'a', date: '2026-03-01' }),
  mk({ id: 'b', kind: 'lab', name: 'CBC', dose: '', quantity: null, amountMinor: 80000, date: '2026-05-10', patient: 'স্ত্রী' }),
  mk({ id: 'c', name: 'Seclo', amountMinor: 12000, date: '2025-12-30' }),
];

describe('medPurchaseCalc', () => {
  it('totalMinor sums integers exactly', () => expect(totalMinor(L)).toBe(97000));
  it('filters by year range, kind, patient and text', () => {
    expect(filterPurchases(L, { from: '2026-01-01', to: '2026-12-31' }).map((p) => p.id)).toEqual(['a', 'b']);
    expect(filterPurchases(L, { kind: 'lab' }).map((p) => p.id)).toEqual(['b']);
    expect(filterPurchases(L, { patient: 'স্ত্রী' }).map((p) => p.id)).toEqual(['b']);
    expect(filterPurchases(L, { query: 'secl' }).map((p) => p.id)).toEqual(['c']);
    expect(filterPurchases(L, { kind: 'all', query: '' })).toHaveLength(3);
  });
  it('sorts newest first and lists years', () => {
    expect(sortPurchases(L).map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(yearsOf(L)).toEqual(['2026', '2025']);
  });
  it('groups by kind with subtotals', () => {
    const g = groupByKind(L);
    expect(g.map((x) => x.kind)).toEqual(['medicine', 'lab']);
    expect(g[0].subtotalMinor).toBe(17000);
    expect(g[1].subtotalMinor).toBe(80000);
  });
  it('suggests own history first, prefix first, no exact echo', () => {
    expect(suggestNames('na', 'medicine', ['Napa Rapid'])[0]).toBe('Napa Rapid');
    expect(suggestNames('seclo', 'medicine', [])).toEqual([]);
    expect(suggestNames('cb', 'lab', [])).toContain('CBC');
    expect(suggestNames('', 'medicine', [])).toEqual([]);
    expect(suggestNames('na', 'operation', [])).toEqual([]);
  });
  it('builds memo text with grand total', () => {
    const t = buildMemoText(L, { title: 'T', period: 'P', patient: '', fmtDate: (d) => d });
    expect(t).toContain('ঔষধ (');
    expect(t).toContain('1. Seclo 500mg - 120 Taka | 2025-12-30');
    expect(t).toContain('সর্বমোট:');
  });
  it('memo html escapes user text', () => {
    const h = buildMemoHtml([mk({ name: '<script>alert(1)</script>', note: '' })], { title: 'T', period: 'P', patient: '', fmtDate: (d) => d });
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
    expect(h).toContain('সর্বমোট');
  });
});

describe('doseQty', () => {
  it('ডোজ + সংখ্যা', () => {
    expect(doseQty({ dose: '500mg', quantity: 10 })).toBe('500mg × 10');
    expect(doseQty({ dose: '', quantity: 3 })).toBe('× 3');
    expect(doseQty({ dose: '5ml', quantity: null })).toBe('5ml');
    expect(doseQty({ dose: '', quantity: null })).toBe('');
  });
});

describe('memoLine', () => {
  it('ফর্দের লাইন: সংখ্যা, নাম, ডোজ', () => {
    expect(memoLine({ name: 'Napa', dose: '500 mg', quantity: 10 })).toBe('10 Napa 500 mg');
    expect(memoLine({ name: 'Napa', dose: '', quantity: null })).toBe('Napa');
    expect(memoLine({ name: 'CBC', dose: '', quantity: 1 })).toBe('1 CBC');
  });
  it('ফর্দের টেক্সটে "10 Napa 500mg - 50 Taka"', () => {
    const t = buildMemoText([mk({ quantity: 10 })], { title: 'T', period: 'P', patient: '', fmtDate: (d) => d });
    expect(t).toContain('1. 10 Napa 500mg - 50 Taka | 2026-03-01');
    expect(t).toContain('সর্বমোট: 50 Taka');
  });
});

import { describe, expect, it } from 'vitest';
import { buildMemoText, filterPurchases, groupByKind, sortPurchases, suggestNames, totalMinor, yearsOf } from './medPurchaseCalc';
import type { MedPurchase } from '../validation/medPurchaseSchema';

const mk = (o: Partial<MedPurchase>): MedPurchase => ({
  id: 'x', kind: 'medicine', name: 'Napa', dose: '500mg', amountMinor: 5000, date: '2026-03-01', patient: 'আমি', note: '', createdAt: null, updatedAt: null, ...o,
});
const L = [
  mk({ id: 'a', date: '2026-03-01' }),
  mk({ id: 'b', kind: 'lab', name: 'CBC', dose: '', amountMinor: 80000, date: '2026-05-10', patient: 'স্ত্রী' }),
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
    expect(t).toContain('1. 2025-12-30 | Seclo 500mg');
    expect(t).toContain('সর্বমোট:');
  });
});

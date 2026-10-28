import { describe, expect, it } from 'vitest';
import { companyTotals, entriesOfCompany, linkSuggestions } from './companyStats';

const inv = (id: string, date: string, investedTo: string, p: number, reps: number[], companyId: string | null = null) => ({
  id,
  date,
  investedTo,
  companyId,
  principalMinor: p,
  repayments: reps.map((a, k) => ({ date: `2026-0${k + 1}-01`, amountMinor: a })),
});

describe('companyTotals', () => {
  it('sums invested/repaid; profit only from closed', () => {
    const list = [inv('a', '2025-08-01', 'X', 2000000, [2114000]), inv('b', '2026-01-01', 'X', 3000000, [500000]), inv('c', '2026-03-12', 'X [7]', 3000000, [])];
    const t = companyTotals(list);
    expect(t).toEqual({ rounds: 3, investedMinor: 8000000, repaidMinor: 2614000, profitClosedMinor: 114000 });
  });
  it('closed with loss gives negative profit; empty gives zeros', () => {
    expect(companyTotals([inv('a', '2026-01-01', 'X', 100, [90])]).profitClosedMinor).toBe(0); // running
    expect(companyTotals([]).rounds).toBe(0);
  });
});

describe('entriesOfCompany', () => {
  it('filters by companyId, newest first', () => {
    const list = [inv('a', '2025-01-01', 'X', 1, [], 'c1'), inv('b', '2026-01-01', 'X', 1, [], 'c1'), inv('c', '2026-02-01', 'Y', 1, [], 'c2')];
    expect(entriesOfCompany(list, 'c1').map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('linkSuggestions', () => {
  it('suggests only unlinked entries whose base name starts with company name', () => {
    const list = [
      inv('a', '2025-08-01', 'Apon Bazaar', 1, []),
      inv('b', '2026-03-12', 'apon bazaar [7]', 1, []),
      inv('c', '2026-01-01', 'Apon Bazaar [9]', 1, [], 'c1'), // already linked
      inv('d', '2026-01-01', 'Best Electronics', 1, []),
    ];
    expect(linkSuggestions(list, 'Apon Bazaar').map((i) => i.id)).toEqual(['b', 'a']);
    expect(linkSuggestions(list, '  ')).toEqual([]);
  });
});

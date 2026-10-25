import { describe, expect, it } from 'vitest';
import { accountBalanceOf, accountColumns, groupHistoryByYear, monthName } from './historyCalc';
import type { NetWorthSnapshot } from '../validation/netWorthSchema';

const snap = (yyyymm: string, total: number, breakdown?: NetWorthSnapshot['breakdown']): NetWorthSnapshot => ({
  yyyymm, totalAssetsMinor: total, snapshotDate: `${yyyymm}-28`, createdAt: null, updatedAt: null, breakdown,
});
const bd = (names: [string, number][]) => ({
  accountsMinor: 0, receivableMinor: 0, investmentMinor: 0, homeDepositMinor: 0, gpfMinor: 0,
  accounts: names.map(([name, balanceMinor]) => ({ name, balanceMinor })),
});

describe('groupHistoryByYear', () => {
  it('groups years newest first, months newest first, delta vs previous snapshot', () => {
    const g = groupHistoryByYear([snap('2025-12', 100), snap('2026-01', 130), snap('2026-02', 120, bd([]))]);
    expect(g.map((y) => y.year)).toEqual(['2026', '2025']);
    expect(g[0].months.map((m) => m.yyyymm)).toEqual(['2026-02', '2026-01']);
    expect(g[0].months[0].deltaMinor).toBe(-10);
    expect(g[0].months[1].deltaMinor).toBe(30);
    expect(g[0].months[1].prevYyyymm).toBe('2025-12');
    expect(g[1].months[0].deltaMinor).toBeNull();
  });
  it('hasSplit only when breakdown present', () => {
    const g = groupHistoryByYear([snap('2026-01', 1), snap('2026-02', 2, bd([]))]);
    expect(g[0].months.map((m) => m.hasSplit)).toEqual([true, false]);
  });
  it('empty input', () => expect(groupHistoryByYear([])).toEqual([]));
});

describe('accountColumns', () => {
  it('current order first, then extra historical names', () => {
    const g = groupHistoryByYear([snap('2026-01', 1, bd([['Old', 1], ['DBBL', 2]])), snap('2026-02', 2, bd([['SIBL', 3]]))]);
    expect(accountColumns(g[0].months, ['SIBL', 'DBBL', 'Unused'])).toEqual(['SIBL', 'DBBL', 'Old']);
  });
  it('accountBalanceOf returns null when missing', () => {
    const g = groupHistoryByYear([snap('2026-01', 1, bd([['DBBL', 5]]))]);
    expect(accountBalanceOf(g[0].months[0], 'DBBL')).toBe(5);
    expect(accountBalanceOf(g[0].months[0], 'SIBL')).toBeNull();
  });
});

describe('monthName', () => {
  it('names', () => {
    expect(monthName('2026-09')).toBe('September');
    expect(monthName('2026-09', true)).toBe('Sep');
  });
});

import { describe, expect, it } from 'vitest';
import { accountBalanceOf, accountColumns, earliestSnapshotMonth, groupHistoryByYear, monthDetail, monthName } from './historyCalc';
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


describe('monthDetail / earliestSnapshotMonth', () => {
  const mk = (yyyymm: string, total: number, extra: Record<string, unknown> = {}) =>
    ({ yyyymm, totalAssetsMinor: total, snapshotDate: `${yyyymm}-28`, ...extra }) as never;
  const split = { accountsMinor: 300, receivableMinor: 10, investmentMinor: 20, homeDepositMinor: 30, gpfMinor: 0, accounts: [{ name: 'B', balanceMinor: 100 }, { name: 'A', balanceMinor: 200 }] };
  const snaps = [mk('2026-04', 1000), mk('2026-05', 1500, { breakdown: split }), mk('2026-06', 1200, { unverified: true })];
  it('আগের মাসের সাথে পার্থক্য ও %; account-ক্রম মানা হয়', () => {
    const d = monthDetail(snaps, '2026-05', ['A', 'B'])!;
    expect(d).toMatchObject({ totalMinor: 1500, prevYyyymm: '2026-04', deltaMinor: 500, deltaPct: 50, snapshotDate: '2026-05-28' });
    expect(d.accounts.map((a) => a.name)).toEqual(['A', 'B']);
    expect(d.breakdown?.receivableMinor).toBe(10);
  });
  it('ভাঙা-হিসাব না থাকলে breakdown null (বানানো হয় না); ঋণাত্মক পার্থক্য; unverified', () => {
    const d = monthDetail(snaps, '2026-06')!;
    expect(d.breakdown).toBeNull();
    expect(d.accounts).toEqual([]);
    expect(d).toMatchObject({ deltaMinor: -300, deltaPct: 20, unverified: true });
  });
  it('প্রথম snapshot-এ পার্থক্য নেই; snapshot না থাকা মাসে null', () => {
    expect(monthDetail(snaps, '2026-04')).toMatchObject({ prevYyyymm: null, deltaMinor: null, deltaPct: null });
    expect(monthDetail(snaps, '2026-09')).toBeNull();
  });
  it('earliestSnapshotMonth', () => {
    expect(earliestSnapshotMonth(snaps)).toBe('2026-04');
    expect(earliestSnapshotMonth([])).toBeNull();
  });
});

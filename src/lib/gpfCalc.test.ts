import { describe, it, expect } from 'vitest';
import { gpfBalanceMinor, gpfTotalsMinor, fiscalYearOf, gpfBalanceAsOfMinor, gpfChangeInWindowMinor } from './gpfCalc';

describe('gpfCalc', () => {
  it('balance = contributions + interest − withdrawals', () => {
    const e = [
      { type: 'contribution', amountMinor: 121300 },
      { type: 'interest', amountMinor: 3942 },
      { type: 'withdrawal', amountMinor: 1000 },
    ] as const;
    expect(gpfBalanceMinor(e)).toBe(124242);
    expect(gpfTotalsMinor(e)).toEqual({ contributions: 121300, interest: 3942, withdrawals: 1000, balance: 124242 });
  });
  it('empty → 0', () => {
    expect(gpfBalanceMinor([])).toBe(0);
  });
  it('fiscalYearOf: জুলাই–জুন', () => {
    expect(fiscalYearOf('2026-06-30')).toBe('2025-26');
    expect(fiscalYearOf('2026-07-01')).toBe('2026-27');
    expect(fiscalYearOf('2026-05-01')).toBe('2025-26');
    expect(fiscalYearOf('2026-12-31')).toBe('2026-27');
    expect(fiscalYearOf('2099-08-01')).toBe('2099-00');
  });

  const owner = [
    { date: '2026-05-01', type: 'contribution', amountMinor: 121_300 },
    { date: '2026-06-01', type: 'contribution', amountMinor: 121_300 },
    { date: '2026-06-30', type: 'interest', amountMinor: 3_900 },
    { date: '2026-07-01', type: 'contribution', amountMinor: 121_300 },
    { date: '2026-08-01', type: 'contribution', amountMinor: 127_400 },
    { date: '2026-09-01', type: 'contribution', amountMinor: 127_400 },
  ] as const;
  it('gpfBalanceAsOfMinor: Aug 31 = 4,952; Sep 1 = 6,226 (inclusive); এন্ট্রির আগে = 0', () => {
    expect(gpfBalanceAsOfMinor(owner, '2026-08-31')).toBe(495_200);
    expect(gpfBalanceAsOfMinor(owner, '2026-09-01')).toBe(622_600);
    expect(gpfBalanceAsOfMinor(owner, '2026-04-30')).toBe(0);
    expect(gpfBalanceAsOfMinor(owner, '')).toBe(0);
  });
  it('gpfChangeInWindowMinor: window দুই প্রান্তসহ; Sep window = 1,274', () => {
    expect(gpfChangeInWindowMinor(owner, '2026-09-01', '2026-09-24')).toBe(127_400);
    expect(gpfChangeInWindowMinor(owner, '2026-06-01', '2026-06-30')).toBe(125_200);
    expect(gpfChangeInWindowMinor(owner, '2026-09-02', '2026-09-30')).toBe(0);
  });
});

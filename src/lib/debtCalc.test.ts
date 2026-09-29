import { describe, it, expect } from 'vitest';
import { outstandingMinor, repaymentStatus, sumRepayments } from './debtCalc';

describe('debtCalc', () => {
  it('sumRepayments adds all amounts', () => {
    expect(sumRepayments([{ date: '2026-01-01', amountMinor: 1000 }, { date: '2026-02-01', amountMinor: 2000 }])).toBe(3000);
    expect(sumRepayments([])).toBe(0);
  });

  it('outstandingMinor clamps at 0 even on over-repayment', () => {
    expect(outstandingMinor(10000, [{ date: '2026-01-01', amountMinor: 4000 }])).toBe(6000);
    expect(outstandingMinor(10000, [{ date: '2026-01-01', amountMinor: 15000 }])).toBe(0);
  });

  it('repaymentStatus: outstanding → partial → paid', () => {
    expect(repaymentStatus(10000, [])).toBe('outstanding');
    expect(repaymentStatus(10000, [{ date: '2026-01-01', amountMinor: 4000 }])).toBe('partial');
    expect(repaymentStatus(10000, [{ date: '2026-01-01', amountMinor: 10000 }])).toBe('paid');
    expect(repaymentStatus(10000, [{ date: '2026-01-01', amountMinor: 12000 }])).toBe('paid');
  });
});

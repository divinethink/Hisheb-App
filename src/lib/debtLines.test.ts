import { describe, it, expect } from 'vitest';
import { lineViews, receivableOutstandingMinor, writtenOffOutstandingMinor, type DebtLinesInput } from './debtCalc';
import { receivableTotalMinor } from './netWorthCalc';
import { receivableAsOfMinor } from './ledgerAsOf';

const base = (over: Partial<DebtLinesInput> = {}): DebtLinesInput => ({
  totalAmountMinor: 150000,
  date: '2026-09-22',
  borrowings: [
    { id: 'a', date: '2026-09-22', amountMinor: 100000 },
    { id: 'b', date: '2026-10-01', amountMinor: 50000 },
  ],
  repayments: [{ date: '2026-10-05', amountMinor: 100000, borrowingId: 'a' }],
  receivableStatus: 'active',
  receivableStatusChangedAt: null,
  ...over,
});

describe('per-borrowing lines', () => {
  it('linked repayment settles only its own line', () => {
    const v = lineViews(base());
    expect(v[0].payStatus).toBe('paid');
    expect(v[0].outstandingMinor).toBe(0);
    expect(v[1].payStatus).toBe('outstanding');
    expect(v[1].outstandingMinor).toBe(50000);
    expect(receivableOutstandingMinor(base())).toBe(50000);
  });

  it('unlinked repayments go oldest-first (FIFO)', () => {
    const d = base({ repayments: [{ date: '2026-10-05', amountMinor: 120000 }] });
    const v = lineViews(d);
    expect(v[0].outstandingMinor).toBe(0);
    expect(v[1].outstandingMinor).toBe(30000);
  });

  it('written-off line is excluded from receivable; paid history stays', () => {
    const d = base({
      borrowings: [
        { id: 'a', date: '2026-09-22', amountMinor: 100000 },
        { id: 'b', date: '2026-10-01', amountMinor: 50000, status: 'written_off', statusChangedAt: '2026-10-10' },
      ],
    });
    expect(receivableOutstandingMinor(d)).toBe(0);
    expect(writtenOffOutstandingMinor(d)).toBe(50000);
    expect(lineViews(d)[0].paidMinor).toBe(100000);
  });

  it('unlinked payments skip written-off lines first', () => {
    const d = base({
      borrowings: [
        { id: 'a', date: '2026-09-22', amountMinor: 100000, status: 'written_off', statusChangedAt: '2026-10-01' },
        { id: 'b', date: '2026-10-01', amountMinor: 50000 },
      ],
      repayments: [{ date: '2026-10-05', amountMinor: 50000 }],
    });
    expect(receivableOutstandingMinor(d)).toBe(0);
    expect(lineViews(d)[0].outstandingMinor).toBe(100000);
  });

  it('doubtful stays in receivable', () => {
    const d = base({ repayments: [], borrowings: [{ id: 'a', date: '2026-09-22', amountMinor: 1000, status: 'doubtful', statusChangedAt: '2026-10-01' }] });
    expect(receivableOutstandingMinor(d)).toBe(1000);
  });

  it('dangling borrowingId (line deleted) falls back to FIFO', () => {
    const d = base({ repayments: [{ date: '2026-10-05', amountMinor: 30000, borrowingId: 'gone' }] });
    expect(lineViews(d)[0].outstandingMinor).toBe(70000);
  });

  it('legacy doc (no borrowings, debt-level forgiven) behaves as before', () => {
    const d: DebtLinesInput = { totalAmountMinor: 1000, date: '2026-01-01', repayments: [{ date: '2026-02-01', amountMinor: 400 }], receivableStatus: 'forgiven', receivableStatusChangedAt: '2026-05-01' };
    expect(receivableOutstandingMinor(d)).toBe(0);
    expect(receivableOutstandingMinor(d, '2026-04-01')).toBe(600); // forgive-এর আগে
    expect(receivableOutstandingMinor(d, '2026-05-01')).toBe(0);
  });

  it('netWorth + as-of totals use line statuses', () => {
    const d = base({
      borrowings: [
        { id: 'a', date: '2026-09-22', amountMinor: 100000 },
        { id: 'b', date: '2026-10-01', amountMinor: 50000, status: 'written_off', statusChangedAt: '2026-10-10' },
      ],
    });
    expect(receivableTotalMinor([{ direction: 'owe_me', ...d } as never])).toBe(0);
    const asOfDebt = { direction: 'owe_me' as const, ...d, date: '2026-09-22', receivableStatus: 'active' as const, receivableStatusChangedAt: null };
    expect(receivableAsOfMinor([asOfDebt as never], '2026-10-04')).toBe(150000); // শোধ ও write-off এখনো হয়নি
    expect(receivableAsOfMinor([asOfDebt as never], '2026-10-06')).toBe(50000); // a শোধ হয়েছে, b এখনো write-off হয়নি
    expect(receivableAsOfMinor([asOfDebt as never], '2026-10-10')).toBe(0);
  });
});

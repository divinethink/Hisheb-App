import { describe, it, expect } from 'vitest';
import { isSettledByRepayment, latestBorrowingDate, partitionDebtsForList, type DebtLinesInput } from './debtCalc';
import { partitionInvestmentsForList } from './investmentCalc';
import { resolveAmountMinor } from './money';

const debt = (
  id: string,
  borrowings: { id: string; date: string; amountMinor: number; status?: 'active' | 'doubtful' | 'written_off' }[],
  repayments: { date: string; amountMinor: number; borrowingId?: string }[] = [],
) => ({
  id,
  totalAmountMinor: borrowings.reduce((s, b) => s + b.amountMinor, 0),
  borrowings,
  repayments,
}) satisfies DebtLinesInput & { id: string };

describe('debt list order (owner-request 2026-10-25)', () => {
  it('latestBorrowingDate picks the newest line', () => {
    const d = debt('a', [
      { id: 'L0', date: '2023-02-22', amountMinor: 100 },
      { id: 'L1', date: '2026-09-24', amountMinor: 100 },
      { id: 'L2', date: '2026-09-21', amountMinor: 100 },
    ]);
    expect(latestBorrowingDate(d)).toBe('2026-09-24');
  });

  it('fully repaid (outstanding 0 by repayment) is settled; written-off zero is NOT', () => {
    const paid = debt('p', [{ id: 'L0', date: '2026-01-01', amountMinor: 5000 }], [{ date: '2026-02-01', amountMinor: 5000 }]);
    const writtenOff = debt('w', [{ id: 'L0', date: '2026-01-01', amountMinor: 5000, status: 'written_off' }]);
    const recovered = debt(
      'r',
      [{ id: 'L0', date: '2026-01-01', amountMinor: 5000, status: 'written_off' }],
      [{ date: '2026-03-01', amountMinor: 5000, borrowingId: 'L0' }],
    );
    expect(isSettledByRepayment(paid)).toBe(true);
    expect(isSettledByRepayment(writtenOff)).toBe(false);
    expect(isSettledByRepayment(recovered)).toBe(true);
  });

  it('mixed lines (one paid, one open) stay on top', () => {
    const mixed = debt(
      'm',
      [
        { id: 'L0', date: '2026-01-01', amountMinor: 1000 },
        { id: 'L1', date: '2026-02-01', amountMinor: 1000 },
      ],
      [{ date: '2026-03-01', amountMinor: 1000, borrowingId: 'L0' }],
    );
    expect(isSettledByRepayment(mixed)).toBe(false);
  });

  it('partition: settled go to the bottom; each group newest-latest-borrowing first', () => {
    const list = [
      debt('old-open', [{ id: 'L0', date: '2025-01-01', amountMinor: 100 }]),
      debt('paid-new', [{ id: 'L0', date: '2026-10-01', amountMinor: 100 }], [{ date: '2026-10-02', amountMinor: 100 }]),
      debt('new-open', [{ id: 'L0', date: '2026-09-01', amountMinor: 100 }]),
      debt('wo-mid', [{ id: 'L0', date: '2026-01-01', amountMinor: 100, status: 'written_off' }]),
      debt('paid-old', [{ id: 'L0', date: '2024-01-01', amountMinor: 100 }], [{ date: '2024-02-01', amountMinor: 100 }]),
    ];
    const { open, settled } = partitionDebtsForList(list);
    expect(open.map((d) => d.id)).toEqual(['new-open', 'wo-mid', 'old-open']);
    expect(settled.map((d) => d.id)).toEqual(['paid-new', 'paid-old']);
  });
});

describe('investment list order (owner-request 2026-10-25)', () => {
  it('closed go to the bottom; both groups newest investment date first (not by repayment)', () => {
    const inv = (id: string, date: string, principalMinor: number, repaid: number) => ({
      id,
      date,
      principalMinor,
      repayments: repaid > 0 ? [{ date: '2026-10-01', amountMinor: repaid }] : [],
    });
    const { open, closed } = partitionInvestmentsForList([
      inv('a-old-running', '2025-01-01', 1000, 0),
      inv('b-new-closed', '2026-09-01', 1000, 1200),
      inv('c-new-running-repaid', '2026-08-01', 1000, 400),
      inv('d-mid-running', '2026-02-01', 1000, 0),
      inv('e-old-closed', '2024-05-01', 1000, 1000),
    ]);
    expect(open.map((i) => i.id)).toEqual(['c-new-running-repaid', 'd-mid-running', 'a-old-running']);
    expect(closed.map((i) => i.id)).toEqual(['b-new-closed', 'e-old-closed']);
  });
});

describe('resolveAmountMinor (shared by all amount forms)', () => {
  it('plain amount and "+" expression', () => {
    expect(resolveAmountMinor('1250.5')).toBe(125050);
    expect(resolveAmountMinor('500+200+300')).toBe(100000);
  });
  it('dangling operator / zero / empty → null', () => {
    expect(resolveAmountMinor('500+')).toBeNull();
    expect(resolveAmountMinor('')).toBeNull();
    expect(resolveAmountMinor('0')).toBeNull();
  });
});

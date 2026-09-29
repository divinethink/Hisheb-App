import { describe, it, expect } from 'vitest';
import {
  accountsTotalMinor,
  latestBalanceByAccount,
  liveBasisDate,
  parseBalanceToMinor,
  receivableTotalMinor,
  runningInvestmentTotalMinor,
  totalAssetsMinor,
  type DebtLike,
  type InvestmentLike,
} from './netWorthCalc';

describe('receivableTotalMinor', () => {
  const debts: DebtLike[] = [
    { direction: 'owe_me', totalAmountMinor: 100000, repayments: [], receivableStatus: 'active' },
    { direction: 'owe_me', totalAmountMinor: 50000, repayments: [{ date: '2026-01-01', amountMinor: 20000 }], receivableStatus: 'doubtful' },
    { direction: 'owe_me', totalAmountMinor: 30000, repayments: [], receivableStatus: 'forgiven' },
    { direction: 'i_owe', totalAmountMinor: 999999, repayments: [], receivableStatus: 'active' },
  ];
  it('sums owe_me active+doubtful outstanding, excludes forgiven and i_owe', () => {
    expect(receivableTotalMinor(debts)).toBe(100000 + 30000);
  });
});

describe('runningInvestmentTotalMinor', () => {
  const investments: InvestmentLike[] = [
    { principalMinor: 500000, repayments: [{ date: '2026-01-01', amountMinor: 160000 }], investmentOutcome: 'running' },
    { principalMinor: 200000, repayments: [], investmentOutcome: 'doubtful' },
    { principalMinor: 300000, repayments: [], investmentOutcome: 'written_off' },
  ];
  it('sums running Investment excluding written_off', () => {
    expect(runningInvestmentTotalMinor(investments)).toBe(340000 + 200000);
  });
});

describe('accountsTotalMinor / totalAssetsMinor', () => {
  it('accountsTotalMinor sums balances', () => {
    expect(accountsTotalMinor([{ balanceMinor: 100 }, { balanceMinor: -20 }])).toBe(80);
  });
  it('totalAssetsMinor adds all five components (incl. GPF), i_owe never subtracted (C6)', () => {
    expect(
      totalAssetsMinor({
        accountsTotalMinor: 100000,
        receivableTotalMinor: 20000,
        runningInvestmentTotalMinor: 50000,
        homeDepositNetMinor: 15000,
        gpfBalanceMinor: 495200,
      }),
    ).toBe(680200);
  });
});

describe('latestBalanceByAccount', () => {
  it('picks the highest yyyymm per accountId', () => {
    const m = latestBalanceByAccount([
      { accountId: 'a', yyyymm: '2026-07', balanceMinor: 100 },
      { accountId: 'a', yyyymm: '2026-08', balanceMinor: 150 },
      { accountId: 'b', yyyymm: '2026-06', balanceMinor: 50 },
    ]);
    expect(m.get('a')).toBe(150);
    expect(m.get('b')).toBe(50);
  });
});

describe('parseBalanceToMinor (int, শূন্য/ঋণাত্মকও বৈধ)', () => {
  it.each([
    ['1250', 125000],
    ['0', 0],
    ['-500', -50000],
    ['1,250.5', 125050],
    ['', null],
    ['-', null],
    ['abc', null],
  ])('%s → %s', (s, out) => expect(parseBalanceToMinor(s)).toBe(out));
});

describe('liveBasisDate', () => {
  const b = (accountId: string, yyyymm: string, snapshotDate: string) => ({ accountId, yyyymm, snapshotDate });
  it('প্রতিটা account-এর সর্বশেষ মাসের snapshotDate-গুলোর সর্বোচ্চ', () => {
    expect(liveBasisDate([b('a', '2026-07', '2026-07-31'), b('a', '2026-08', '2026-08-31'), b('b', '2026-08', '2026-08-29')], '2026-09-20')).toBe('2026-08-31');
  });
  it('পুরনো মাসের বেশি-তারিখ ব্যবহার হয় না (সর্বশেষ yyyymm-ই ধরা হয়)', () => {
    expect(liveBasisDate([b('a', '2026-07', '2026-09-30'), b('a', '2026-08', '2026-08-31')], '2026-10-01')).toBe('2026-08-31');
  });
  it('balance না থাকলে বা তারিখ ভবিষ্যতে হলে today', () => {
    expect(liveBasisDate([], '2026-09-20')).toBe('2026-09-20');
    expect(liveBasisDate([b('a', '2026-09', '2026-09-30')], '2026-09-20')).toBe('2026-09-20');
  });
});

import { describe, it, expect } from 'vitest';
import { lastDayOfMonth, receivableAsOfMinor, runningInvestmentAsOfMinor, investmentTotalsAsOf, depositNetAsOfMinor, countLedgerChangesAfter } from './ledgerAsOf';

describe('ledgerAsOf', () => {
  it('lastDayOfMonth', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29');
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31');
  });
  it('receivable: repayments after asOf ignored; forgiven only after changedAt', () => {
    const d = { direction: 'owe_me' as const, totalAmountMinor: 1000, date: '2026-01-10', repayments: [{ date: '2026-03-01', amountMinor: 400 }], receivableStatus: 'forgiven' as const, receivableStatusChangedAt: '2026-05-01' };
    expect(receivableAsOfMinor([d], '2026-02-28')).toBe(1000);
    expect(receivableAsOfMinor([d], '2026-03-31')).toBe(600);
    expect(receivableAsOfMinor([d], '2026-05-31')).toBe(0);
    expect(receivableAsOfMinor([d], '2025-12-31')).toBe(0);
  });
  it('running investment & totals', () => {
    const i = { principalMinor: 5000, date: '2026-01-01', repayments: [{ date: '2026-03-01', amountMinor: 5500 }], investmentOutcome: 'running' as const, investmentOutcomeChangedAt: null };
    expect(runningInvestmentAsOfMinor([i], '2026-02-28')).toBe(5000);
    expect(runningInvestmentAsOfMinor([i], '2026-03-31')).toBe(0);
    expect(investmentTotalsAsOf([i], '2026-03-31')).toEqual({ principalMinor: 5000, returnedMinor: 5000, profitMinor: 500 });
  });
  it('deposit net', () => {
    expect(depositNetAsOfMinor([{ date: '2026-01-01', type: 'deposit', amountMinor: 100 }, { date: '2026-02-01', type: 'withdrawal', amountMinor: 30 }], '2026-01-31')).toBe(100);
    expect(depositNetAsOfMinor([{ date: '2026-01-01', type: 'deposit', amountMinor: 100 }, { date: '2026-02-01', type: 'withdrawal', amountMinor: 30 }], '2026-02-28')).toBe(70);
  });
});

describe('countLedgerChangesAfter', () => {
  it('asOf-এর পরের নতুন এন্ট্রি, repayment, status-বদল, deposit ও GPF গোনে; আগের/সমান তারিখ বাদ', () => {
    const n = countLedgerChangesAfter('2026-08-31', {
      debts: [
        { direction: 'owe_me', totalAmountMinor: 1, date: '2026-09-03', repayments: [], receivableStatus: 'active', receivableStatusChangedAt: null }, // নতুন ধার ১
        { direction: 'owe_me', totalAmountMinor: 1, date: '2026-01-01', repayments: [{ date: '2026-08-31', amountMinor: 1 }, { date: '2026-09-10', amountMinor: 1 }], receivableStatus: 'forgiven', receivableStatusChangedAt: '2026-09-12' }, // repayment ১ + status ১
      ],
      investments: [{ principalMinor: 1, date: '2026-01-01', repayments: [{ date: '2026-09-20', amountMinor: 1 }], investmentOutcome: 'running', investmentOutcomeChangedAt: null }], // ১
      deposits: [{ date: '2026-08-31', type: 'deposit', amountMinor: 1 }, { date: '2026-09-01', type: 'deposit', amountMinor: 1 }], // ১
      gpf: [{ date: '2026-09-01' }, { date: '2026-08-01' }], // ১
    });
    expect(n).toBe(6);
  });
  it('কিছু না বদলালে ০', () => {
    expect(countLedgerChangesAfter('2026-08-31', { debts: [], investments: [], deposits: [], gpf: [] })).toBe(0);
  });
});

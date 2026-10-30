import { describe, it, expect } from 'vitest';
import { assertBackupValid, findBackupProblems } from './backupValidate';

const COLS = ['transactions', 'debts', 'investments', 'investmentCompanies', 'gpfEntries', 'accountBalances', 'accounts'] as const;
const okTx = { amountMinor: 500, type: 'expense', date: '2026-10-30' };

describe('findBackupProblems (restore preflight)', () => {
  it('সঠিক ব্যাকআপে সমস্যা নেই; অচেনা/অনুপস্থিত collection এড়ানো', () => {
    expect(findBackupProblems({ transactions: { a: okTx }, accounts: { x: { anything: 1 } } }, COLS, { theme: 'dark' })).toEqual([]);
    expect(findBackupProblems({}, COLS, null)).toEqual([]);
    expect(findBackupProblems({ unknownCol: { a: 1 } }, COLS)).toEqual([]);
  });
  it('transactions: amount ≤ 0, দশমিক, ভুল type/date ধরে', () => {
    for (const bad of [
      { ...okTx, amountMinor: 0 },
      { ...okTx, amountMinor: -5 },
      { ...okTx, amountMinor: 1.5 },
      { ...okTx, amountMinor: '500' },
      { ...okTx, type: 'transfer' },
      { ...okTx, date: '30-10-2026' },
    ]) {
      expect(findBackupProblems({ transactions: { a: bad } }, COLS)).toHaveLength(1);
    }
  });
  it('investments: ঐচ্ছিক ফিল্ড null/অনুপস্থিত ঠিক; অবৈধ হলে ভুল', () => {
    const base = { principalMinor: 1000 };
    expect(findBackupProblems({ investments: { a: base, b: { ...base, round: null, companyId: null } } }, COLS)).toEqual([]);
    expect(findBackupProblems({ investments: { a: { ...base, round: 0 } } }, COLS)).toHaveLength(1);
    expect(findBackupProblems({ investments: { a: { ...base, platformNo: 'x'.repeat(31) } } }, COLS)).toHaveLength(1);
  });
  it('investmentCompanies: নাম সীমা ও logo', () => {
    const logo = 'data:image/png;base64,AAAA';
    expect(findBackupProblems({ investmentCompanies: { a: { name: 'X', logo } } }, COLS)).toEqual([]);
    expect(findBackupProblems({ investmentCompanies: { a: { name: 'X', logo: 'data:image/svg+xml;base64,AAAA' } } }, COLS)).toHaveLength(1);
    expect(findBackupProblems({ investmentCompanies: { a: { name: 'x'.repeat(61) } } }, COLS)).toHaveLength(1);
    expect(findBackupProblems({ investmentCompanies: { a: { name: '' } } }, COLS)).toHaveLength(1);
  });
  it('gpfEntries / accountBalances / debts', () => {
    expect(findBackupProblems({ gpfEntries: { a: { amountMinor: 5, type: 'bonus' } } }, COLS)).toHaveLength(1);
    expect(findBackupProblems({ accountBalances: { a: { balanceMinor: -50 } } }, COLS)).toEqual([]); // ঋণাত্মক ব্যালেন্স বৈধ
    expect(findBackupProblems({ accountBalances: { a: {} } }, COLS)).toHaveLength(1);
    expect(findBackupProblems({ debts: { a: { totalAmountMinor: 0 } } }, COLS)).toHaveLength(1);
  });
  it('অবৈধ doc id, non-object doc/collection/settings', () => {
    expect(findBackupProblems({ accounts: { 'a/b': {} } }, COLS)).toHaveLength(1);
    expect(findBackupProblems({ accounts: { '': {} } }, COLS)).toHaveLength(1);
    expect(findBackupProblems({ accounts: { a: 5 } }, COLS)).toHaveLength(1);
    expect(findBackupProblems({ accounts: [] }, COLS)).toHaveLength(1);
    expect(findBackupProblems({}, COLS, 'oops')).toHaveLength(1);
  });
});

describe('assertBackupValid', () => {
  it('সঠিক হলে ছোঁড়ে না', () => {
    expect(() => assertBackupValid({ transactions: { a: okTx } }, COLS)).not.toThrow();
  });
  it('অবৈধ হলে "nothing was changed" বার্তাসহ ছোঁড়ে, প্রথম ৩টি দেখায়', () => {
    const bad = { amountMinor: 0, type: 'expense', date: '2026-10-30' };
    const txs = Object.fromEntries(['a', 'b', 'c', 'd'].map((k) => [k, bad]));
    expect(() => assertBackupValid({ transactions: txs }, COLS)).toThrow(/4 invalid item\(s\) — nothing was changed.*\(\+1 more\)/);
  });
});

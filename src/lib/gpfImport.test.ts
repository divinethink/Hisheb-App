import { describe, it, expect } from 'vitest';
import { parseGpfCsv } from './gpfImport';
import { gpfBalanceMinor, fiscalYearOf } from './gpfCalc';

const HEADER = 'date,type,amount,fiscalYear,salaryMonth,accountingMonth,importKey';

describe('parseGpfCsv', () => {
  it('parses a valid row as-is', () => {
    const { rows, skipped } = parseGpfCsv(
      [HEADER, '2026-05-01,contribution,1213,2025-26,Apr 2026,May 2026 (salary of Apr 2026),gpf|2026-05-01|contribution|121300'].join('\r\n'),
    );
    expect(skipped).toHaveLength(0);
    expect(rows[0]).toMatchObject({ date: '2026-05-01', type: 'contribution', amountMinor: 121300, fiscalYear: '2025-26', importKey: 'gpf|2026-05-01|contribution|121300' });
  });
  it('allows blank salaryMonth (interest row) and derives fiscalYear/importKey when missing', () => {
    const { rows } = parseGpfCsv([HEADER, '2026-06-30,interest,39,,,FY 2025-26 profit credited,'].join('\n'));
    expect(rows[0]).toMatchObject({ salaryMonth: '', fiscalYear: fiscalYearOf('2026-06-30'), importKey: 'gpf|2026-06-30|interest|3900' });
  });
  it('skips invalid date/type/amount (zero, negative, decimal)', () => {
    const { rows, skipped } = parseGpfCsv(
      [HEADER, 'x,contribution,100,,,,', '2026-01-01,bonus,100,,,,', '2026-01-01,contribution,0,,,,', '2026-01-01,contribution,-5,,,,', '2026-01-01,contribution,1.5,,,,', '2026-01-01,contribution,39.42,,,,'].join('\n'),
    );
    expect(rows).toHaveLength(0);
    expect(skipped.map((s) => s.reason)).toEqual(['invalid-date', 'invalid-type', 'invalid-amount', 'invalid-amount', 'invalid-amount', 'invalid-amount']);
  });
  it('collapses identical importKey rows within one file', () => {
    const row = '2026-05-01,contribution,1213,,,,';
    expect(parseGpfCsv([HEADER, row, row].join('\n')).rows).toHaveLength(1);
  });
  it('rejects the old amountMinor-column format (no silent ÷100 error)', () => {
    const { rows, skipped } = parseGpfCsv(
      ['date,type,amountMinor,fiscalYear,salaryMonth,accountingMonth,importKey', '2026-05-01,contribution,121300,2025-26,,,'].join('\n'),
    );
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toBe('invalid-amount');
  });
  it('owner CSV (6 rows, whole taka) → balance BDT 6,226 = 622600 minor', () => {
    const csv = [
      'date,type,amount,fiscalYear,salaryMonth,accountingMonth',
      '2026-05-01,contribution,1213,2025-26,Apr 2026,May 2026 (salary of Apr 2026)',
      '2026-06-01,contribution,1213,2025-26,May 2026,Jun (Pre) 2026 (salary of May 2026)',
      '2026-06-30,interest,39,2025-26,,FY 2025-26 profit credited',
      '2026-07-01,contribution,1213,2026-27,Jun (Pre) 2026,Jul 2026',
      '2026-08-01,contribution,1274,2026-27,Jul 2026,Aug 2026',
      '2026-09-01,contribution,1274,2026-27,Aug 2026,Sep 2026',
    ].join('\r\n');
    const { rows } = parseGpfCsv(csv);
    expect(rows).toHaveLength(6);
    expect(gpfBalanceMinor(rows)).toBe(622600);
  });
});

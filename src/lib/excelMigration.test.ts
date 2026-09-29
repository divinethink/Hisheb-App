import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseInvestmentSheet,
  parseExcelDate,
  parseTakaToMinor,
  parseMonthlyAccountBalances,
  parseHistoricalYearly,
  parseMonthlyNetWorthSnapshots,
} from './excelMigration';

function workbookFromRows(rows: unknown[][], sheetName = 'Investment'): XLSX.WorkBook {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return wb;
}

const HEADER = [
  'SL',
  'Investment  Date',
  'Investe to',
  'Medium',
  'All  Investment',
  'Duratiom',
  'Repayment  Date',
  'Repayment',
  'ফেরত  মূলধন',
  'Profit/(-)',
];

describe('parseExcelDate', () => {
  it('parses DD.MM.YYYY', () => expect(parseExcelDate('23.05.2024')).toBe('2024-05-23'));
  it('null for empty', () => expect(parseExcelDate('')).toBeNull());
  it('null for garbage', () => expect(parseExcelDate('abc')).toBeNull());
});

describe('parseTakaToMinor', () => {
  it('20000 → 2000000', () => expect(parseTakaToMinor(20000)).toBe(2000000));
  it('rejects zero/negative', () => {
    expect(parseTakaToMinor(0)).toBeNull();
    expect(parseTakaToMinor(-100)).toBeNull();
  });
  it('handles comma string', () => expect(parseTakaToMinor('20,000')).toBe(2000000));
});

describe('parseInvestmentSheet', () => {
  it('parses a closed investment row with a single repayment entry (Roadmap §২/§৪.৪)', () => {
    const wb = workbookFromRows([
      ['বিনিয়োগ ও জমার হিসাব'],
      HEADER,
      [1, '23.05.2024', 'Believers Sign', 'Halal Investment', 20000, '8 month', '11.02.2025', 22160, 20000, 2160],
    ]);
    const { rows, skipped } = parseInvestmentSheet(wb);
    expect(skipped).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].input).toMatchObject({
      date: '2024-05-23',
      investedTo: 'Believers Sign',
      medium: 'Halal Investment',
      principalMinor: 2000000,
      repayments: [{ date: '2025-02-11', amountMinor: 2216000 }],
      investmentOutcome: 'running',
    });
  });

  it('running investment (no repayment yet) → empty repayments array', () => {
    const wb = workbookFromRows([
      HEADER,
      [16, '07.04.26', 'Synod Electric [2]', 'biniyog.io', 30000, '12 months', null, null, null, null],
    ]);
    const { rows } = parseInvestmentSheet(wb);
    expect(rows[0].input.repayments).toEqual([]);
    expect(rows[0].input.principalMinor).toBe(3000000);
  });

  it('stops before the second (2026 empty template) table', () => {
    const wb = workbookFromRows([
      HEADER,
      [1, '23.05.2024', 'A', 'X', 20000, '', '', '', '', ''],
      ['২০২৬ সালে বিনিয়োগ ও জমার হিসাব'],
      HEADER,
      [1, '01.01.2026', 'B', 'Y', 5000, '', '', '', '', ''],
    ]);
    const { rows } = parseInvestmentSheet(wb);
    expect(rows).toHaveLength(1);
    expect(rows[0].input.investedTo).toBe('A');
  });

  it('skips rows missing required fields, keeps parsing subsequent valid rows', () => {
    const wb = workbookFromRows([
      HEADER,
      [1, null, 'No Date', 'X', 20000, '', '', '', '', ''],
      [2, '01.01.2026', 'Valid Row', 'X', 15000, '', '', '', '', ''],
    ]);
    const { rows, skipped } = parseInvestmentSheet(wb);
    expect(skipped).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].input.investedTo).toBe('Valid Row');
  });

  it('missing sheet → single skipped entry, no throw', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    const { rows, skipped } = parseInvestmentSheet(wb);
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toContain('Investment');
  });
});

describe('parseMonthlyAccountBalances', () => {
  const HEADER_2026 = [
    'মাস', 'Salary', 'Bonus/ Honorium', 'TA/DA/ PF', 'পাওনা/মা/ বাবা/ হীরা/', 'মোট আয়', 'মোট  ব্যয়', 'সঞ্চয়/(-)',
    'মোট পাওনা', 'বাসায়  মোট জমা', 'Running Investment', 'Mbank+Cash +others', 'DBBL', 'SIBL', 'IBBL', 'IBBL Hira',
    'Total Deposit', 'Cross check', 'Deviation',
  ];

  it('reads the August row from the first (2026) section', () => {
    const wb = workbookFromRows(
      [
        HEADER_2026,
        ['July', 42008, 0, 0, 0, 42008, 38267, 3741, 2500, 20000, 141018, 11191, 164264, 210872, 980, 2695, 553520, 603386, -49866],
        ['August', 42008, 0, 2400, 0, 44408, 32527, 11881, 2500, 20000, 121126, 14712, 212503, 221372, 980, 21201, 614394, 565401, 48993],
        ['2025 Income, Expenditure & Deposit'],
        HEADER_2026,
        ['August', 41269, 0, 0, 0, 41269, 44154, -2885, 11000, 14500, 160000, 5595, 135549, 96885, 197093, 0, 620622, 622009, -1387],
      ],
      'Monthly Statement',
    );
    const result = parseMonthlyAccountBalances(wb, 'August');
    expect(result).not.toBeNull();
    expect(result!.totalDepositMinor).toBe(61439400);
    expect(result!.accounts).toEqual([
      { label: 'Mbank+Cash+others', balanceMinor: 1471200 },
      { label: 'DBBL', balanceMinor: 21250300 },
      { label: 'SIBL', balanceMinor: 22137200 },
      { label: 'IBBL', balanceMinor: 98000 },
      { label: 'IBBL Hira', balanceMinor: 2120100 },
    ]);
  });

  it('missing sheet or month → null', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    expect(parseMonthlyAccountBalances(wb, 'August')).toBeNull();

    const wb2 = workbookFromRows([HEADER_2026, ['July', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]], 'Monthly Statement');
    expect(parseMonthlyAccountBalances(wb2, 'August')).toBeNull();
  });
});

describe('parseHistoricalYearly', () => {
  it('excludes "বিনিয়োগ হতে", uses Dec deposit when Monthly section exists', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Yearly Expenditure'],
        ['SL', 'Title', '2023  (July to Dec)', 2024, 2025],
        [null, 'Total Cost (y)', 10, 20, 616865],
        [null, 'Total Income', 30, 40, 958095],
        [null, 'Job Income', 1, 1, 1],
        [null, 'Total Deposit', 44567, 174676, 522222],
      ]),
      'Yearly Statement',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['2025 Income, Expenditure & Deposit'],
        ['মাস', 'Salary', 'বিনিয়োগ  হতে ', 'Total Deposit'],
        ['December', 1, 0, 550294],
        ['Total', 1, 2325, null],
      ]),
      'Monthly Statement',
    );
    const r = parseHistoricalYearly(wb);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.year)).toEqual([2023, 2024, 2025]);
    const y25 = r.rows[2];
    expect(y25.totalIncomeMinor).toBe((958095 - 2325) * 100);
    expect(y25.totalDepositMinor).toBe(550294 * 100);
    expect(y25.depositSource).toBe('monthly-december');
    expect(r.rows[0].totalDepositMinor).toBe(44567 * 100);
    expect(parseHistoricalYearly(wb, [2025]).rows).toHaveLength(2);
  });
});

describe('parseMonthlyNetWorthSnapshots', () => {
  const HEADER = [
    'মাস', 'Salary', 'Bonus/ Honorium', 'TA/DA/ PF', 'পাওনা/মা/ বাবা/ হীরা/', 'মোট আয়', 'মোট  ব্যয়', 'সঞ্চয়/(-)',
    'মোট পাওনা', 'বাসায়  মোট জমা', 'Running Investment', 'Mbank+Cash +others', 'DBBL', 'SIBL', 'IBBL', 'IBBL Hira',
    'Total Deposit', 'Cross check', 'Deviation',
  ];
  const row = (month: string, totalDeposit: number | null) => [
    month, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, totalDeposit, 0, 0,
  ];

  function wb2026And2025() {
    return workbookFromRows(
      [
        ['2026 Income, Expenditure & Deposit'],
        HEADER,
        row('July', 553520),
        row('August', 614394),
        row('September', 0), // এখনো হয়নি — skip
        ['2025 Income, Expenditure & Deposit'],
        HEADER,
        row('January', null), // ফাঁকা — skip
        row('December', 550294),
      ],
      'Monthly Statement',
    );
  }

  it('extracts Total Deposit per month within [min, exclusiveMax) range, sorted ascending', () => {
    const res = parseMonthlyNetWorthSnapshots(wb2026And2025(), { minYyyymm: '2025-01', exclusiveMaxYyyymm: '2026-08' });
    expect(res.errors).toEqual([]);
    expect(res.rows.map((r) => r.yyyymm)).toEqual(['2025-12', '2026-07']);
    expect(res.rows[0]).toMatchObject({ totalDepositMinor: 55029400, snapshotDate: '2025-12-31', unverified: false });
    expect(res.rows[1]).toMatchObject({ totalDepositMinor: 55352000, snapshotDate: '2026-07-31', unverified: false });
    // '2026-09' রেঞ্জের বাইরে (exclusiveMax='2026-08') বলে চুপচাপ বাদ, blank-reason skipped-এ না
    expect(res.skipped.map((s) => s.yyyymm)).toEqual(['2025-01']);
  });

  it('reports blank/zero Total Deposit months in `skipped` when they fall inside the range', () => {
    const res = parseMonthlyNetWorthSnapshots(wb2026And2025(), { minYyyymm: '2025-01', exclusiveMaxYyyymm: '2027-01' });
    expect(res.skipped.map((s) => s.yyyymm)).toEqual(expect.arrayContaining(['2025-01', '2026-09']));
    expect(res.rows.map((r) => r.yyyymm)).toEqual(['2025-12', '2026-07', '2026-08']);
  });

  it('never returns a month at/after exclusiveMaxYyyymm (existing-doc protection, e.g. Aug 2026 baseline)', () => {
    const res = parseMonthlyNetWorthSnapshots(wb2026And2025(), { minYyyymm: '2025-01', exclusiveMaxYyyymm: '2026-08' });
    expect(res.rows.some((r) => r.yyyymm >= '2026-08')).toBe(false);
  });

  it('flags unverifiedYyyymm months (DF11)', () => {
    const res = parseMonthlyNetWorthSnapshots(wb2026And2025(), {
      minYyyymm: '2025-01',
      exclusiveMaxYyyymm: '2026-08',
      unverifiedYyyymm: ['2026-07'],
    });
    expect(res.rows.find((r) => r.yyyymm === '2026-07')?.unverified).toBe(true);
    expect(res.rows.find((r) => r.yyyymm === '2025-12')?.unverified).toBe(false);
  });

  it('missing sheet → error, no throw', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    const res = parseMonthlyNetWorthSnapshots(wb, { minYyyymm: '2025-01', exclusiveMaxYyyymm: '2026-08' });
    expect(res.rows).toHaveLength(0);
    expect(res.errors[0]).toContain('Monthly Statement');
  });
});

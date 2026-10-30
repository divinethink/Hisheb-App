/* eslint-disable @typescript-eslint/no-explicit-any -- test fixture: schema-এর সব ফিল্ড ছাড়া partial object */
import { it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildFullReportWorkbook } from './excelReport';

const tx = (id: string, date: string, type: 'income'|'expense', amt: number, cat: string) =>
  ({ id, date, type, amountMinor: amt, currency: 'BDT', categoryId: cat, categoryName: cat, labelIds: [], labelNames: [], note: '', deleted: false } as any);
it('workbook follows original Excel structure, no daily entries', () => {
  const txs = [
    tx('1','2026-07-02','income',4200800,'Salary'), tx('2','2026-07-10','expense',3826700,'বাসা'),
    tx('3','2026-08-02','income',4200800,'Salary'), tx('4','2026-08-12','income',240000,'TA/DA/Honorarium'), tx('5','2026-08-20','expense',3252700,'বাসা'), tx('6','2026-08-21','expense',100000,'Groceries'),
    tx('7','2025-10-05','income',4126900,'Salary'), tx('8','2025-10-06','expense',5616700,'বাসা'),
  ];
  const wb = buildFullReportWorkbook({
    today: '2026-09-27', txs,
    historical: [{ year: 2025, totalIncomeMinor: 95809500, totalExpenseMinor: 61686500, totalDepositMinor: 52222200 } as any, { year: 2024, totalIncomeMinor: 87043900, totalExpenseMinor: 72679000, totalDepositMinor: 17467600 } as any],
    snapshots: [{ yyyymm: '2026-07', totalAssetsMinor: 55807600, snapshotDate: '2026-07-31' } as any],
    debts: [{ id: 'd1', person: 'Sumon', direction: 'owe_me', totalAmountMinor: 400000, date: '2026-01-01', repayments: [{ date: '2026-08-01', amountMinor: 100000, note: '' }], receivableStatus: 'active', receivableStatusChangedAt: null } as any],
    investments: [
      { id: 'i1', date: '2025-05-20', investedTo: 'Best Electronics', medium: 'biniyog.io', principalMinor: 5000000, duration: '1 month', repayments: [{ date: '2025-06-26', amountMinor: 5062500, note: '' }], investmentOutcome: 'running', investmentOutcomeChangedAt: null } as any,
      { id: 'i2', date: '2026-04-07', investedTo: 'Synod', medium: 'biniyog.io', principalMinor: 3000000, duration: '12 months', repayments: [], investmentOutcome: 'running', investmentOutcomeChangedAt: null } as any,
    ],
    funds: [{ id: 'f1', name: 'Tuhin' } as any, { id: 'f2', name: 'Hira' } as any],
    homeDeposits: [
      { id: 'h1', fundId: 'f1', date: '2025-01-10', type: 'deposit', amountMinor: 50000, note: '' } as any,
      { id: 'h2', fundId: 'f1', date: '2026-01-10', type: 'deposit', amountMinor: 100000, note: '' } as any,
      { id: 'h3', fundId: 'f2', date: '2026-03-10', type: 'deposit', amountMinor: 50000, note: '' } as any,
    ],
    gpf: [{ id: 'g1', date: '2026-07-01', type: 'contribution', amountMinor: 127400, fiscalYear: '2026-27', note: '' } as any],
    accounts: [{ id: 'a1', name: 'DBBL', holder: null } as any, { id: 'a2', name: 'IBBL', holder: null } as any],
    accountBalances: [
      { accountId: 'a1', yyyymm: '2026-07', balanceMinor: 16426400 }, { accountId: 'a2', yyyymm: '2026-07', balanceMinor: 98000 },
      { accountId: 'a1', yyyymm: '2026-08', balanceMinor: 21250300 }, { accountId: 'a2', yyyymm: '2026-08', balanceMinor: 98000 },
    ] as any,
  });
  expect(wb.SheetNames).toEqual(['Investment', 'Home Deposit', 'Debt', 'GPF', 'Net Worth', 'Monthly Statement', 'Yearly Statement']);
  const ms = XLSX.utils.sheet_to_json(wb.Sheets['Monthly Statement'], { header: 1 }) as unknown[][];
  expect(ms.some((r) => r[0] === 'August' && r.includes(44408) && r.includes(10881))).toBe(true);
  expect(wb.Sheets['Monthly Statement']['F11'].f).toBe('D11-E11');
  const inv = wb.Sheets['Investment'];
  // Ledger-ক্রম: Running (Synod) row 4 ওপরে, Closed (Best Electronics) row 5 নিচে; Closed = সবুজ, Running = রঙহীন
  expect(inv['C4'].v).toBe('Synod');
  expect(inv['C5'].v).toBe('Best Electronics');
  expect(inv['J5'].f).toBe('H5-E5');
  expect(inv['G7'].f).toBe('E7-I7');
  expect((inv['A5'] as any).s.fill.fgColor.rgb).toBe('C6EFCE');
  expect((inv['A4'] as any).s?.fill).toBeUndefined();
  expect((inv['A5'] as any).s.border.top.style).toBe('thin');
  expect(wb.Sheets['Net Worth']['E9'].f).toMatch(/^Debt!/);
  expect(wb.Sheets['Net Worth']['E11'].f).toBe("'Home Deposit'!" + wb.Sheets['Net Worth']['E11'].f!.split('!')[1]);
  // দৈনিক entry (Date/Type/Note কলাম) কোথাও নেই
  for (const n of wb.SheetNames) expect(JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }))).not.toContain('"Transactions"');
});

it('Debt sheet: active → doubtful → fully repaid → written-off (নিচে); Net Worth সব অঙ্ক E কলামে, SL সহ', () => {
  const d = (id: string, date: string, st: string, paid = 0) =>
    ({ id, person: id, direction: 'owe_me', totalAmountMinor: 100000, date, repayments: paid ? [{ date, amountMinor: paid, note: '' }] : [], receivableStatus: st, receivableStatusChangedAt: null } as any);
  const wb = buildFullReportWorkbook({
    today: '2026-09-27', txs: [], historical: [], snapshots: [],
    debts: [d('wo', '2026-05-01', 'written_off'), d('paid', '2026-04-01', 'active', 100000), d('dbt', '2026-03-01', 'doubtful'), d('act', '2026-01-01', 'active')],
    investments: [], funds: [], homeDeposits: [], gpf: [],
    accounts: [{ id: 'a1', name: 'DBBL', holder: null } as any], accountBalances: [{ accountId: 'a1', yyyymm: '2026-08', balanceMinor: 1000 }] as any,
  });
  const ids = [4, 5, 6, 7].map((r) => wb.Sheets['Debt']['A' + r].v);
  expect(ids).toEqual(['act', 'dbt', 'paid', 'wo']);
  const nw = wb.Sheets['Net Worth'];
  expect(nw['A5'].v).toBe(1);
  expect(nw['E7'].f).toBe('SUM(E5:E5)');
  expect(nw['E13'].f).toBe('E7+E8+E9+E10+E11');
});

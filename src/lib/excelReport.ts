// Excel Report — একটাই Workbook, আসল `হিসাব-নিকাশ.xlsx`-এর কাঠামো অনুসরণ (P5, Roadmap §৪.৮, Architecture Plan §৫.১)।
// Sheet: Investment / Monthly Statement / Yearly Statement / Calculation / Debts / HomeDeposit / GPF / Net Worth।
// দৈনিক লেনদেনের তালিকা নেই (শুধু মাস/বছরের যোগফল)। formula-cell + cached value দুটোই বাধ্যতামূলক (§৫.১)।
// ভারী dependency (xlsx) বলে caller থেকে সবসময় dynamic import()।
import * as XLSX from 'xlsx';
import type { Transaction } from '../validation/transactionSchema';
import type { Debt } from '../validation/debtSchema';
import type { Investment } from '../validation/investmentSchema';
import type { Fund, HomeDepositEntry } from '../validation/homeDepositSchema';
import type { GpfEntry } from '../validation/gpfSchema';
import type { Account } from '../validation/accountSchema';
import type { AccountBalance, NetWorthSnapshot } from '../validation/netWorthSchema';
import type { HistoricalYearlyTotal } from '../validation/historicalSchema';
import { outstandingMinor, sumRepayments as sumDebtRepayments } from './debtCalc';
import { sumRepayments as sumInvRepayments } from './investmentCalc';
import { netBalanceMinor } from './homeDepositCalc';
import { gpfTotalsMinor } from './gpfCalc';
import { receivableTotalMinor, runningInvestmentTotalMinor, accountsTotalMinor, latestBalanceByAccount } from './netWorthCalc';
import { lastDayOfMonth, receivableAsOfMinor, runningInvestmentAsOfMinor, depositNetAsOfMinor } from './ledgerAsOf';

const MONEY_FMT = '#,##0.00';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function toTaka(minor: number): number {
  return Math.round(minor) / 100;
}

function cellRef(row: number, col: number): string {
  return XLSX.utils.encode_cell({ r: row, c: col });
}

/** নির্দিষ্ট column-index-গুলোর সব numeric cell-এ money format বসায় (header/text cell স্বয়ংক্রিয়ভাবে বাদ যায়)। */
function applyMoneyFormat(ws: XLSX.WorkSheet, cols: readonly number[]): void {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (const c of cols) {
      const cell = ws[cellRef(r, c)];
      if (cell && typeof cell.v === 'number') cell.z = MONEY_FMT;
    }
  }
}

const isSalary = (t: Transaction) => t.categoryName.trim().toLowerCase() === 'salary';

/** "Investment" sheet — আসল Excel-এর কলাম: SL, Date, Invested To, Medium, All Investment(E), Duration, Repayment Date,
 *  Repayment(H), ফেরত মূলধন(I)=MIN(H,E), Profit(J)=H−E (শুধু closed/written_off, Audit C8)। Header row 3, data row 4+,
 *  এক ফাঁকা row, তারপর totals: E=Total Investment, G=Running(E−I), I=Total ফেরত মূলধন। নিচে Net Worth-এর জন্য written-off বাদে Running। */
function buildInvestmentSheet(investments: readonly Investment[]): { ws: XLSX.WorkSheet; runningCellRef: string; runningTotalMinor: number } {
  const sorted = [...investments].sort((a, b) => a.date.localeCompare(b.date));
  const aoa: (string | number)[][] = [['বিনিয়োগ ও জমার হিসাব'], []];
  aoa.push(['SL', 'Investment Date', 'Invested To', 'Medium', 'All Investment', 'Duration', 'Repayment Date', 'Repayment', 'ফেরত মূলধন', 'Profit/(-)', 'Outcome', 'Running']);
  const first = aoa.length; // 0-indexed (Excel row 4)
  let principal = 0;
  let returned = 0;
  sorted.forEach((inv, i) => {
    const paid = sumInvRepayments(inv.repayments);
    const back = Math.min(paid, inv.principalMinor);
    const showProfit = paid >= inv.principalMinor || inv.investmentOutcome === 'written_off';
    const lastDate = inv.repayments.reduce((m, r) => (r.date > m ? r.date : m), '');
    principal += inv.principalMinor;
    returned += back;
    aoa.push([i + 1, inv.date, inv.investedTo, inv.medium, toTaka(inv.principalMinor), inv.duration, lastDate, toTaka(paid), toTaka(back), showProfit ? toTaka(paid - inv.principalMinor) : '', inv.investmentOutcome, toTaka(inv.principalMinor - back)]);
  });
  const last = aoa.length - 1;
  aoa.push([]);
  const totalRow = aoa.length;
  aoa.push(['', '', '', 'Total Investment', toTaka(principal), 'Running Inv.', toTaka(principal - returned), 'Total', toTaka(returned)]);
  const netRow = aoa.length;
  const runningTotalMinor = runningInvestmentTotalMinor(investments);
  aoa.push(['', '', '', 'Running (Net Worth, excl. written-off)', toTaka(runningTotalMinor)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const n = sorted.length;
  for (let i = first; i <= last; i++) {
    const r = i + 1;
    ws[cellRef(i, 8)].f = `MIN(H${r},E${r})`;
    if (ws[cellRef(i, 9)].v !== '') ws[cellRef(i, 9)].f = `H${r}-E${r}`;
    ws[cellRef(i, 11)].f = `E${r}-I${r}`;
  }
  if (n > 0) {
    ws[cellRef(totalRow, 4)].f = `SUM(E${first + 1}:E${last + 1})`;
    ws[cellRef(totalRow, 8)].f = `SUM(I${first + 1}:I${last + 1})`;
    ws[cellRef(netRow, 4)].f = `SUMIFS(L${first + 1}:L${last + 1},K${first + 1}:K${last + 1},"<>written_off")`;
  }
  ws[cellRef(totalRow, 6)].f = `E${totalRow + 1}-I${totalRow + 1}`;

  applyMoneyFormat(ws, [4, 7, 8, 9, 11]);
  ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  return { ws, runningCellRef: cellRef(netRow, 4), runningTotalMinor };
}

/** "Monthly Statement" — আসল Excel-এর মতো দুই block (চলতি বছর, তারপর আগের বছর); প্রতি block: header row 3, Jan=row 4..Dec=row 15।
 *  B Salary, C Other Income, D মোট আয়=SUM(B:C), E মোট ব্যয়, F সঞ্চয়=D−E, G–J মূলধন (as-of মাস-শেষ), K Total Deposit=SUM(G:J),
 *  L Cross check=আগের মাসের K+এই মাসের F, M Deviation=L−K। Cross-check শুধু ঠিক আগের মাস থেকে (Audit C7); ব্যালেন্স-snapshot না থাকা মাসে খালি। */
function buildMonthlySheet(year: number, currentYm: string, i: FullReportInput): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [];
  const formulas: { row: number; col: number; f: string }[] = [];
  const header = ['মাস', 'Salary', 'Other Income', 'মোট আয়', 'মোট ব্যয়', 'সঞ্চয়/(-)', 'মোট পাওনা', 'বাসায় মোট জমা', 'Running Investment', 'Accounts (Bank+MB+Cash)', 'Total Deposit', 'Cross check', 'Deviation'];
  [year, year - 1].forEach((y) => {
    aoa.push([`${y} Income, Expenditure & Deposit`]);
    aoa.push(['', 'আয়', '', '', '', '', 'মূলধন']);
    aoa.push(header);
    let prevK = false;
    MONTHS.forEach((name, mi) => {
      const ym = `${y}-${String(mi + 1).padStart(2, '0')}`;
      const rowIdx = aoa.length;
      const r = rowIdx + 1;
      if (ym > currentYm) { aoa.push([name]); prevK = false; return; }
      const mt = i.txs.filter((t) => t.date.startsWith(ym));
      const sal = mt.filter((t) => t.type === 'income' && isSalary(t)).reduce((s, t) => s + t.amountMinor, 0);
      const oth = mt.filter((t) => t.type === 'income' && !isSalary(t)).reduce((s, t) => s + t.amountMinor, 0);
      const exp = mt.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinor, 0);
      const row: (string | number)[] = [name, toTaka(sal), toTaka(oth), toTaka(sal + oth), toTaka(exp), toTaka(sal + oth - exp)];
      formulas.push({ row: rowIdx, col: 3, f: `SUM(B${r}:C${r})` }, { row: rowIdx, col: 5, f: `D${r}-E${r}` });
      const bals = i.accountBalances.filter((b) => b.yyyymm === ym);
      if (bals.length > 0) {
        const asOf = lastDayOfMonth(ym);
        const g = receivableAsOfMinor(i.debts, asOf);
        const h = depositNetAsOfMinor(i.homeDeposits, asOf);
        const inv = runningInvestmentAsOfMinor(i.investments, asOf);
        const acc = accountsTotalMinor(bals);
        const k = g + h + inv + acc;
        row.push(toTaka(g), toTaka(h), toTaka(inv), toTaka(acc), toTaka(k));
        formulas.push({ row: rowIdx, col: 10, f: `SUM(G${r}:J${r})` });
        if (prevK) {
          const prev = aoa[rowIdx - 1];
          const cross = toTaka(Math.round((prev[10] as number) * 100) + sal + oth - exp);
          row.push(cross, toTaka(Math.round(cross * 100) - k));
          formulas.push({ row: rowIdx, col: 11, f: `K${r - 1}+F${r}` }, { row: rowIdx, col: 12, f: `L${r}-K${r}` });
        }
        prevK = true;
      } else prevK = false;
      aoa.push(row);
    });
    aoa.push([], []);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (const x of formulas) ws[cellRef(x.row, x.col)].f = x.f;
  applyMoneyFormat(ws, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  ws['!cols'] = [{ wch: 12 }, ...Array.from({ length: 12 }, () => ({ wch: 14 }))];
  return ws;
}

/** "Yearly Statement" — কলাম প্রতি বছর। C17 precedence: historical doc থাকলে সেই বছরের টোটাল শুধু doc থেকে (live যোগ হয় না, category-row খালি);
 *  doc না থাকলে লাইভ transactions থেকে category-ওয়াইজ + SUM formula। Total Deposit: historical doc বা ওই বছরের শেষ snapshot। */
function buildYearlySheet(i: FullReportInput): XLSX.WorkSheet {
  const hist = new Map(i.historical.map((h) => [h.year, h]));
  const years = [...new Set([...hist.keys(), ...i.txs.map((t) => Number(t.date.slice(0, 4)))])].sort((a, b) => a - b);
  const liveYears = years.filter((y) => !hist.has(y));
  const catTotal = new Map<string, number>();
  for (const t of i.txs) if (t.type === 'expense' && liveYears.includes(Number(t.date.slice(0, 4)))) catTotal.set(t.categoryName, (catTotal.get(t.categoryName) ?? 0) + t.amountMinor);
  const cats = [...catTotal.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);

  const aoa: (string | number)[][] = [['Yearly Expenditure'], ['SL', 'Title', ...years.map(String)]];
  const first = aoa.length;
  cats.forEach((c, ci) => aoa.push([ci + 1, c, ...years.map((y) => {
    if (hist.has(y)) return '';
    const v = i.txs.filter((t) => t.type === 'expense' && t.categoryName === c && t.date.startsWith(String(y))).reduce((s, t) => s + t.amountMinor, 0);
    return v ? toTaka(v) : '';
  })]));
  const last = aoa.length - 1;
  const liveSum = (y: number, type: 'income' | 'expense') => i.txs.filter((t) => t.type === type && t.date.startsWith(String(y))).reduce((s, t) => s + t.amountMinor, 0);
  const costRow = aoa.length;
  aoa.push(['', 'Total Cost (y)', ...years.map((y) => toTaka(hist.get(y)?.totalExpenseMinor ?? liveSum(y, 'expense')))]);
  const incRow = aoa.length;
  aoa.push(['', 'Total Income', ...years.map((y) => toTaka(hist.get(y)?.totalIncomeMinor ?? liveSum(y, 'income')))]);
  const savRow = aoa.length;
  aoa.push(['', 'Total Savings(+/-)', ...years.map((y) => toTaka((hist.get(y)?.totalIncomeMinor ?? liveSum(y, 'income')) - (hist.get(y)?.totalExpenseMinor ?? liveSum(y, 'expense'))))]);
  aoa.push(['', 'Total Deposit', ...years.map((y) => {
    const h = hist.get(y);
    if (h) return toTaka(h.totalDepositMinor);
    const snaps = i.snapshots.filter((s) => s.yyyymm.startsWith(String(y))).sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
    return snaps.length > 0 ? toTaka(snaps[snaps.length - 1].totalAssetsMinor) : '';
  })]);
  aoa.push([], ['', 'Pre-app record: historical year-এর টোটাল শুধু আগে-থেকে-রাখা রেকর্ড থেকে (read-only)।']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  years.forEach((y, yi) => {
    const col = yi + 2;
    const L = XLSX.utils.encode_col(col);
    if (!hist.has(y) && cats.length > 0) ws[cellRef(costRow, col)].f = `SUM(${L}${first + 1}:${L}${last + 1})`;
    ws[cellRef(savRow, col)].f = `${L}${incRow + 1}-${L}${costRow + 1}`;
  });
  applyMoneyFormat(ws, years.map((_, yi) => yi + 2));
  ws['!cols'] = [{ wch: 5 }, { wch: 30 }, ...years.map(() => ({ wch: 14 }))];
  return ws;
}

/** "Calculation" — Mbank+Cash+Others: প্রতিটা account-এর সর্বশেষ ব্যালেন্স + SUM (আসল Excel-এর Calculation sheet-এর মতো)। */
function buildCalculationSheet(accounts: readonly Account[], balances: readonly AccountBalance[]): XLSX.WorkSheet {
  const latest = latestBalanceByAccount(balances);
  const aoa: (string | number)[][] = [['Mbank+Cash+Others']];
  for (const a of accounts) aoa.push([a.name, toTaka(latest.get(a.id) ?? 0)]);
  const totalIdx = aoa.length;
  aoa.push(['Total', toTaka(accountsTotalMinor(accounts.map((a) => ({ balanceMinor: latest.get(a.id) ?? 0 }))))]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (accounts.length > 0) ws[cellRef(totalIdx, 1)].f = `SUM(B2:B${totalIdx})`;
  applyMoneyFormat(ws, [1]);
  ws['!cols'] = [{ wch: 26 }, { wch: 14 }];
  return ws;
}

/** "Debts" sheet — প্রতিটা debt-এর Repaid/Outstanding formula (SUMIF দিয়ে নিচের Repayment Details থেকে), Total Receivable/I Owe SUMIFS। */
function buildDebtsSheet(debts: readonly Debt[]): { ws: XLSX.WorkSheet; receivableCellRef: string; receivableMinor: number; ioweCellRef: string; ioweMinor: number } {
  const aoa: (string | number)[][] = [['Debts & Receivables'], []];
  aoa.push(['ID', 'Person', 'Direction', 'Total (BDT)', 'Date', 'Status', 'Repaid (BDT)', 'Outstanding (BDT)']);
  const summaryStart = aoa.length;
  for (const d of debts) {
    aoa.push([d.id, d.person, d.direction, toTaka(d.totalAmountMinor), d.date, d.receivableStatus, toTaka(sumDebtRepayments(d.repayments)), toTaka(outstandingMinor(d.totalAmountMinor, d.repayments))]);
  }
  const summaryEnd = aoa.length - 1;
  aoa.push([]);
  const receivableRowIdx = aoa.length;
  const receivableMinor = receivableTotalMinor(debts);
  aoa.push(['Total Receivable (Net Worth: owe_me, not forgiven)', toTaka(receivableMinor)]);
  const ioweRowIdx = aoa.length;
  const ioweMinor = debts.filter((d) => d.direction === 'i_owe').reduce((s, d) => s + outstandingMinor(d.totalAmountMinor, d.repayments), 0);
  aoa.push(['Total I Owe (Outstanding)', toTaka(ioweMinor)]);
  aoa.push([]);
  aoa.push(['Repayment Details']);
  aoa.push(['Debt ID', 'Person', 'Date', 'Amount (BDT)', 'Note']);
  const detailStart = aoa.length;
  for (const d of debts) for (const r of d.repayments) aoa.push([d.id, d.person, r.date, toTaka(r.amountMinor), r.note]);
  const detailEnd = aoa.length - 1;
  if (detailEnd < detailStart) aoa.push(['', '', '', '', 'No repayments yet']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const hasDebts = summaryEnd >= summaryStart;
  const hasDetail = detailEnd >= detailStart;
  if (hasDebts) {
    for (let i = summaryStart; i <= summaryEnd; i++) {
      if (hasDetail) ws[cellRef(i, 6)].f = `SUMIF($A$${detailStart + 1}:$A$${detailEnd + 1},A${i + 1},$D$${detailStart + 1}:$D$${detailEnd + 1})`;
      ws[cellRef(i, 7)].f = `MAX(0,D${i + 1}-G${i + 1})`;
    }
    ws[cellRef(receivableRowIdx, 1)].f = `SUMIFS(H${summaryStart + 1}:H${summaryEnd + 1},C${summaryStart + 1}:C${summaryEnd + 1},"owe_me",F${summaryStart + 1}:F${summaryEnd + 1},"<>forgiven")`;
    ws[cellRef(ioweRowIdx, 1)].f = `SUMIFS(H${summaryStart + 1}:H${summaryEnd + 1},C${summaryStart + 1}:C${summaryEnd + 1},"i_owe")`;
  }

  applyMoneyFormat(ws, [1, 3, 6, 7]);
  ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
  return { ws, receivableCellRef: cellRef(receivableRowIdx, 1), receivableMinor, ioweCellRef: cellRef(ioweRowIdx, 1), ioweMinor };
}

/** "HomeDeposit" sheet — প্রতিটা fund-এর Net Balance = SUMIFS(deposit) − SUMIFS(withdrawal), নিচে raw entry log। */
function buildHomeDepositSheet(funds: readonly Fund[], entries: readonly HomeDepositEntry[]): { ws: XLSX.WorkSheet; netCellRef: string; netTotalMinor: number } {
  const fundName = new Map(funds.map((f) => [f.id, f.name]));
  const aoa: (string | number)[][] = [['Home Deposit (Piggy Bank)'], []];
  aoa.push(['Fund', 'Date', 'Type', 'Deposit (BDT)', 'Withdrawal (BDT)', 'Note']);
  const detailStart = aoa.length;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sorted) {
    aoa.push([fundName.get(e.fundId) ?? e.fundId, e.date, e.type, e.type === 'deposit' ? toTaka(e.amountMinor) : '', e.type === 'withdrawal' ? toTaka(e.amountMinor) : '', e.note]);
  }
  const detailEnd = aoa.length - 1;
  if (detailEnd < detailStart) aoa.push(['', '', '', '', '', 'No entries yet']);
  aoa.push([]);
  aoa.push(['Fund', 'Net Balance (BDT)']);
  const fundSummaryStart = aoa.length;
  for (const f of funds) aoa.push([f.name, toTaka(netBalanceMinor(entries.filter((e) => e.fundId === f.id)))]);
  const fundSummaryEnd = aoa.length - 1;
  aoa.push([]);
  const totalRowIdx = aoa.length;
  const netTotalMinor = netBalanceMinor(entries);
  aoa.push(['Home Deposit Total (Net)', toTaka(netTotalMinor)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const hasDetail = detailEnd >= detailStart;
  const hasFunds = fundSummaryEnd >= fundSummaryStart;
  if (hasFunds && hasDetail) {
    for (let i = fundSummaryStart; i <= fundSummaryEnd; i++) {
      ws[cellRef(i, 1)].f = `SUMIFS($D$${detailStart + 1}:$D$${detailEnd + 1},$A$${detailStart + 1}:$A$${detailEnd + 1},A${i + 1})-SUMIFS($E$${detailStart + 1}:$E$${detailEnd + 1},$A$${detailStart + 1}:$A$${detailEnd + 1},A${i + 1})`;
    }
  }
  if (hasFunds) ws[cellRef(totalRowIdx, 1)].f = `SUM(B${fundSummaryStart + 1}:B${fundSummaryEnd + 1})`;

  applyMoneyFormat(ws, [1, 3, 4]);
  ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
  return { ws, netCellRef: cellRef(totalRowIdx, 1), netTotalMinor };
}

/** "GPF" sheet — Contribution/Interest/Withdrawal SUMIFS + Balance = Contribution+Interest−Withdrawal। */
function buildGpfSheet(entries: readonly GpfEntry[]): { ws: XLSX.WorkSheet; balanceCellRef: string; balanceMinor: number } {
  const aoa: (string | number)[][] = [['GPF (Provident Fund)'], []];
  aoa.push(['Date', 'Type', 'Amount (BDT)', 'Fiscal Year', 'Note']);
  const detailStart = aoa.length;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sorted) aoa.push([e.date, e.type, toTaka(e.amountMinor), e.fiscalYear, e.note]);
  const detailEnd = aoa.length - 1;
  if (detailEnd < detailStart) aoa.push(['', '', '', '', 'No entries yet']);
  aoa.push([]);
  const totals = gpfTotalsMinor(entries);
  const contribRowIdx = aoa.length;
  aoa.push(['Total Contributions', toTaka(totals.contributions)]);
  const interestRowIdx = aoa.length;
  aoa.push(['Total Interest', toTaka(totals.interest)]);
  const withdrawalRowIdx = aoa.length;
  aoa.push(['Total Withdrawals', toTaka(totals.withdrawals)]);
  const balanceRowIdx = aoa.length;
  aoa.push(['GPF Balance', toTaka(totals.balance)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const hasDetail = detailEnd >= detailStart;
  if (hasDetail) {
    ws[cellRef(contribRowIdx, 1)].f = `SUMIFS($C$${detailStart + 1}:$C$${detailEnd + 1},$B$${detailStart + 1}:$B$${detailEnd + 1},"contribution")`;
    ws[cellRef(interestRowIdx, 1)].f = `SUMIFS($C$${detailStart + 1}:$C$${detailEnd + 1},$B$${detailStart + 1}:$B$${detailEnd + 1},"interest")`;
    ws[cellRef(withdrawalRowIdx, 1)].f = `SUMIFS($C$${detailStart + 1}:$C$${detailEnd + 1},$B$${detailStart + 1}:$B$${detailEnd + 1},"withdrawal")`;
  }
  ws[cellRef(balanceRowIdx, 1)].f = `B${contribRowIdx + 1}+B${interestRowIdx + 1}-B${withdrawalRowIdx + 1}`;

  applyMoneyFormat(ws, [1, 2]);
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 24 }];
  return { ws, balanceCellRef: cellRef(balanceRowIdx, 1), balanceMinor: totals.balance };
}

interface LedgerTotals {
  receivableCellRef: string; receivableMinor: number;
  ioweCellRef: string; ioweMinor: number;
  runningCellRef: string; runningTotalMinor: number;
  netCellRef: string; netTotalMinor: number;
  balanceCellRef: string; balanceMinor: number;
}

/** "Net Worth" sheet — Accounts (latest snapshot) + cross-sheet formula দিয়ে Receivable/Running Investment/Home Deposit/GPF যোগ করে Total Assets (Gross); নিচে Liabilities (I Owe) তথ্য। */
function buildNetWorthSheet(accounts: readonly Account[], balances: readonly AccountBalance[], t: LedgerTotals): XLSX.WorkSheet {
  const latest = latestBalanceByAccount(balances);
  const latestYm = new Map<string, string>();
  for (const b of balances) {
    const cur = latestYm.get(b.accountId);
    if (!cur || b.yyyymm > cur) latestYm.set(b.accountId, b.yyyymm);
  }
  const aoa: (string | number)[][] = [['Net Worth'], [], ['Assets'], ['Account', 'Holder', 'As of', 'Balance (BDT)']];
  const accStart = aoa.length;
  for (const a of accounts) aoa.push([a.name, a.holder ?? '', latestYm.get(a.id) ?? '', toTaka(latest.get(a.id) ?? 0)]);
  const accEnd = aoa.length - 1;
  if (accEnd < accStart) aoa.push(['', '', '', '']);
  aoa.push([]);
  const accTotalRow = aoa.length;
  const accTotalMinor = accountsTotalMinor(accounts.map((a) => ({ balanceMinor: latest.get(a.id) ?? 0 })));
  aoa.push(['Accounts Total', toTaka(accTotalMinor)]);
  const recvRow = aoa.length;
  aoa.push(['+ Total Receivable (Ledger)', toTaka(t.receivableMinor)]);
  const invRow = aoa.length;
  aoa.push(['+ Running Investment', toTaka(t.runningTotalMinor)]);
  const hdRow = aoa.length;
  aoa.push(['+ Home Deposit (Net)', toTaka(t.netTotalMinor)]);
  const gpfRow = aoa.length;
  aoa.push(['+ GPF Balance', toTaka(t.balanceMinor)]);
  aoa.push([]);
  const totalAssetsRow = aoa.length;
  aoa.push(['Total Assets (Gross)', toTaka(accTotalMinor) + toTaka(t.receivableMinor) + toTaka(t.runningTotalMinor) + toTaka(t.netTotalMinor) + toTaka(t.balanceMinor)]);
  aoa.push([]);
  aoa.push(['Liabilities']);
  const ioweRow = aoa.length;
  aoa.push(['I Owe (Outstanding) — not deducted above, per app policy', toTaka(t.ioweMinor)]);
  const netOfIoweRow = aoa.length;
  aoa.push(['Net of I Owe (informational only)', toTaka(accTotalMinor) + toTaka(t.receivableMinor) + toTaka(t.runningTotalMinor) + toTaka(t.netTotalMinor) + toTaka(t.balanceMinor) - toTaka(t.ioweMinor)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (accEnd >= accStart) ws[cellRef(accTotalRow, 1)].f = `SUM(D${accStart + 1}:D${accEnd + 1})`;
  ws[cellRef(recvRow, 1)].f = `Debts!${t.receivableCellRef}`;
  ws[cellRef(invRow, 1)].f = `Investment!${t.runningCellRef}`;
  ws[cellRef(hdRow, 1)].f = `HomeDeposit!${t.netCellRef}`;
  ws[cellRef(gpfRow, 1)].f = `GPF!${t.balanceCellRef}`;
  ws[cellRef(totalAssetsRow, 1)].f = `B${accTotalRow + 1}+B${recvRow + 1}+B${invRow + 1}+B${hdRow + 1}+B${gpfRow + 1}`;
  ws[cellRef(ioweRow, 1)].f = `Debts!${t.ioweCellRef}`;
  ws[cellRef(netOfIoweRow, 1)].f = `B${totalAssetsRow + 1}-B${ioweRow + 1}`;

  applyMoneyFormat(ws, [1, 3]);
  ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
  return ws;
}

export interface FullReportInput {
  /** আজকের তারিখ "YYYY-MM-DD" (Dhaka) — Monthly Statement কোন বছর/মাস পর্যন্ত ভরবে তা নির্ধারণ; Date.now()-এর ওপর নির্ভর না করে deterministic। */
  today: string;
  txs: readonly Transaction[];
  historical: readonly HistoricalYearlyTotal[];
  snapshots: readonly NetWorthSnapshot[];
  debts: readonly Debt[];
  investments: readonly Investment[];
  funds: readonly Fund[];
  homeDeposits: readonly HomeDepositEntry[];
  gpf: readonly GpfEntry[];
  accounts: readonly Account[];
  accountBalances: readonly AccountBalance[];
}

/** একটাই Workbook — ৮ sheet (আসল Excel-এর কাঠামো + Debts/HomeDeposit/GPF/Net Worth)। */
export function buildFullReportWorkbook(input: FullReportInput): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const invSheet = buildInvestmentSheet(input.investments);
  XLSX.utils.book_append_sheet(wb, invSheet.ws, 'Investment');
  XLSX.utils.book_append_sheet(wb, buildMonthlySheet(Number(input.today.slice(0, 4)), input.today.slice(0, 7), input), 'Monthly Statement');
  XLSX.utils.book_append_sheet(wb, buildYearlySheet(input), 'Yearly Statement');
  XLSX.utils.book_append_sheet(wb, buildCalculationSheet(input.accounts, input.accountBalances), 'Calculation');

  const debtsSheet = buildDebtsSheet(input.debts);
  XLSX.utils.book_append_sheet(wb, debtsSheet.ws, 'Debts');
  const hdSheet = buildHomeDepositSheet(input.funds, input.homeDeposits);
  XLSX.utils.book_append_sheet(wb, hdSheet.ws, 'HomeDeposit');
  const gpfSheet = buildGpfSheet(input.gpf);
  XLSX.utils.book_append_sheet(wb, gpfSheet.ws, 'GPF');

  XLSX.utils.book_append_sheet(
    wb,
    buildNetWorthSheet(input.accounts, input.accountBalances, {
      receivableCellRef: debtsSheet.receivableCellRef,
      receivableMinor: debtsSheet.receivableMinor,
      ioweCellRef: debtsSheet.ioweCellRef,
      ioweMinor: debtsSheet.ioweMinor,
      runningCellRef: invSheet.runningCellRef,
      runningTotalMinor: invSheet.runningTotalMinor,
      netCellRef: hdSheet.netCellRef,
      netTotalMinor: hdSheet.netTotalMinor,
      balanceCellRef: gpfSheet.balanceCellRef,
      balanceMinor: gpfSheet.balanceMinor,
    }),
    'Net Worth',
  );

  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string): void {
  XLSX.writeFile(wb, fileName);
}

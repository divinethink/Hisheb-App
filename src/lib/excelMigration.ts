// Excel "Investment" শীট → InvestmentInput[] parser — one-time migration importer (DF12, Roadmap §১৩.২,
// Checklist P3)। Header-row lookup দিয়ে column খুঁজে বের করে, hardcoded row/column-index না (Roadmap §২
// Source File Freshness Rule — owner migration-সময় নিজের সর্বশেষ ফাইল দেবেন, যার row-সংখ্যা ভিন্ন হতে পারে)।
//
// স্কোপ (owner-approved, Checklist "ঘ" ৪): শুধু Investment শীটের প্রথম টেবিল। "Repayment" কলাম = owner-এর
// মোট ফেরত-পাওয়া টাকা (principal+profit) — নতুন app-schema-র repayments[]-এর একটামাত্র entry হিসেবে বসে,
// কারণ Excel-এ প্রতিটা কিস্তির আলাদা তারিখ/অঙ্ক নেই (Profit = Σrepayments − principal, Architecture Plan §২)।
// Home Deposit ও netWorthSnapshots seed ইচ্ছাকৃতভাবে এখানে নেই — Excel-এর সেই অংশের multi-block লেআউট
// (একাধিক বছর পাশাপাশি, merged header) নির্ভরযোগ্যভাবে auto-parse করার মতো স্পষ্ট না; ইতিমধ্যে-তৈরি Home
// Deposit (P3-4) ও Update Balances (P3-5) স্ক্রিন দিয়ে owner ম্যানুয়ালি এই অল্প-সংখ্যক এন্ট্রি করবেন — ভুল
// auto-parse হওয়া টাকার অঙ্কের চেয়ে এটা নিরাপদ (Zero Data Loss/Maximum Safety নীতি)।
import * as XLSX from 'xlsx';
import type { InvestmentInput } from '../validation/investmentSchema';

export interface ParsedInvestmentRow {
  sourceRow: number; // 1-based sheet row নম্বর, preview/debug-এর জন্য
  input: InvestmentInput;
}
export interface SkippedInvestmentRow {
  rowIndex: number;
  reason: string;
}
export interface InvestmentParseResult {
  rows: ParsedInvestmentRow[];
  skipped: SkippedInvestmentRow[];
}

const HEADER_ALIASES = {
  date: ['investment date'],
  investedTo: ['investe to', 'invested to', 'investate to'],
  medium: ['medium', 'via'],
  principal: ['all investment', 'amount'],
  duration: ['duratiom', 'duration'],
  repaymentDate: ['repayment date'],
  repayment: ['repayment'],
} as const;
type ColKey = keyof typeof HEADER_ALIASES;

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findCol(headerRow: unknown[], aliases: readonly string[]): number {
  return headerRow.findIndex((c) => aliases.includes(norm(c)));
}

/** Excel serial date (real xlsx cell) বা "DD.MM.YYYY"/"DD-MM-YYYY" স্ট্রিং — দুটোই "YYYY-MM-DD"-তে। */
export function parseExcelDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const dmy = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/.exec(s);
  if (dmy) {
    const [, dd, mm, yyRaw] = dmy;
    const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

/** টাকা (পূর্ণ Taka, Excel-এ paisa নেই) → int minor। অবৈধ/শূন্য/ঋণাত্মক হলে null (R1)। */
export function parseTakaToMinor(v: unknown): number | null {
  let n: number | null = null;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v.replace(/[,\s]/g, ''));
    n = Number.isFinite(parsed) ? parsed : null;
  }
  if (n == null || !Number.isFinite(n)) return null;
  const minor = Math.round(n * 100);
  return minor > 0 ? minor : null;
}

// --- Account balances (Monthly Statement শীট) — Net Worth §৪.৬ baseline seed-এর জন্য (owner-approved,
// একক মাস, prospective-only C7 নীতি অনুযায়ী)। Home Deposit ইচ্ছাকৃতভাবে এখানে নেই — সেই টেবিলের 2026
// কলাম দুই fund মিলিয়ে ("T,H") আছে, per-fund split নেই বলে owner ম্যানুয়ালি করবেন।
export interface AccountBalanceRow {
  label: string;
  balanceMinor: number;
}
export interface MonthlyBalanceParseResult {
  accounts: AccountBalanceRow[];
  totalDepositMinor: number | null; // sheet-এর নিজস্ব "Total Deposit" cell — owner cross-check-এর জন্য
}

const BALANCE_HEADER_ALIASES = {
  mbankCash: ['mbank+cash +others', 'mbank+cash+others', 'mbank+cash', 'mbank+ cash', 'mbank + cash +others'],
  dbbl: ['dbbl'],
  sibl: ['sibl'],
  ibbl: ['ibbl'],
  ibblHira: ['ibbl hira'],
  totalDeposit: ['total deposit'],
} as const;
type BalanceColKey = keyof typeof BALANCE_HEADER_ALIASES;
const BALANCE_LABELS: Record<Exclude<BalanceColKey, 'totalDeposit'>, string> = {
  mbankCash: 'Mbank+Cash+others',
  dbbl: 'DBBL',
  sibl: 'SIBL',
  ibbl: 'IBBL',
  ibblHira: 'IBBL Hira',
};

/** টাকা → int minor, শূন্য/ঋণাত্মকও বৈধ (accountBalances.balanceMinor শুধু `is int`, §৩) — parseTakaToMinor-এর
 *  বিপরীতে ধনাত্মক-only না। */
function parseTakaToMinorAllowAny(v: unknown): number | null {
  let n: number | null = null;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v.replace(/[,\s]/g, ''));
    n = Number.isFinite(parsed) ? parsed : null;
  }
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** "Monthly Statement" শীটের প্রথম বছর-সেকশনে `monthName`-এর row থেকে DBBL/SIBL/IBBL/IBBL Hira/
 *  Mbank+Cash+others কলাম পড়ে। সেকশন/মাস না পেলে null। */
export function parseMonthlyAccountBalances(workbook: XLSX.WorkBook, monthName: string): MonthlyBalanceParseResult | null {
  const sheet = workbook.Sheets['Monthly Statement'];
  if (!sheet) return null;
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  let headerIdx = -1;
  let cols: Partial<Record<BalanceColKey, number>> = {};
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (norm(row[0]) !== 'মাস') continue;
    const found: Partial<Record<BalanceColKey, number>> = {};
    for (const key of Object.keys(BALANCE_HEADER_ALIASES) as BalanceColKey[]) {
      const idx = findCol(row, BALANCE_HEADER_ALIASES[key]);
      if (idx !== -1) found[key] = idx;
    }
    if (found.dbbl != null && found.sibl != null && found.ibbl != null) {
      headerIdx = i;
      cols = found;
      break; // প্রথম মিলে যাওয়া বছর-সেকশন
    }
  }
  if (headerIdx === -1) return null;

  const targetNorm = norm(monthName);
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (row.some((c) => typeof c === 'string' && c.includes('Income, Expenditure'))) break; // পরের সেকশন শুরু
    if (norm(row[0]) !== targetNorm) continue;

    const accounts: AccountBalanceRow[] = [];
    for (const key of ['mbankCash', 'dbbl', 'sibl', 'ibbl', 'ibblHira'] as const) {
      const idx = cols[key];
      if (idx == null) continue;
      const minor = parseTakaToMinorAllowAny(row[idx]);
      if (minor != null) accounts.push({ label: BALANCE_LABELS[key], balanceMinor: minor });
    }
    const totalDepositMinor = cols.totalDeposit != null ? parseTakaToMinorAllowAny(row[cols.totalDeposit]) : null;
    return { accounts, totalDepositMinor };
  }
  return null;
}

/** "Investment" শীটের প্রথম টেবিল পার্স করে। দ্বিতীয় (২০২৬-এর খালি টেমপ্লেট) টেবিলের হেডার এলে থেমে যায়। */
export function parseInvestmentSheet(workbook: XLSX.WorkBook): InvestmentParseResult {
  const sheet = workbook.Sheets['Investment'];
  if (!sheet) return { rows: [], skipped: [{ rowIndex: 0, reason: 'শীট "Investment" পাওয়া যায়নি' }] };

  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  let headerIdx = -1;
  let cols: Record<ColKey, number> | null = null;
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (row.findIndex((c) => norm(c) === 'sl') === -1) continue;
    const found = {} as Record<ColKey, number>;
    let ok = true;
    for (const key of Object.keys(HEADER_ALIASES) as ColKey[]) {
      const idx = findCol(row, HEADER_ALIASES[key]);
      if (idx === -1) {
        ok = false;
        break;
      }
      found[key] = idx;
    }
    if (ok) {
      headerIdx = i;
      cols = found;
      break;
    }
  }
  if (headerIdx === -1 || !cols) {
    return { rows: [], skipped: [{ rowIndex: 0, reason: 'Investment টেবিলের হেডার-রো (SL/Investment Date/...) খুঁজে পাওয়া যায়নি' }] };
  }

  const rows: ParsedInvestmentRow[] = [];
  const skipped: SkippedInvestmentRow[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (row.every((c) => c == null || c === '')) continue; // ফাঁকা spacer-রো, চলতে থাকে
    if (row.some((c) => typeof c === 'string' && c.includes('২০২৬ সালে'))) break; // দ্বিতীয় টেবিল শুরু

    const sl = row[0];
    if (sl == null || sl === '') continue;

    const date = parseExcelDate(row[cols.date]);
    const investedTo = String(row[cols.investedTo] ?? '').trim();
    const principalMinor = parseTakaToMinor(row[cols.principal]);
    if (!date || !investedTo || principalMinor == null) {
      skipped.push({ rowIndex: i + 1, reason: 'তারিখ/Invested-to/Amount অনুপস্থিত বা অবৈধ' });
      continue;
    }

    const repaymentMinor = parseTakaToMinor(row[cols.repayment]);
    const repaymentDate = parseExcelDate(row[cols.repaymentDate]) ?? date;
    const repayments = repaymentMinor != null ? [{ date: repaymentDate, amountMinor: repaymentMinor }] : [];

    rows.push({
      sourceRow: i + 1,
      input: {
        date,
        investedTo,
        medium: String(row[cols.medium] ?? '').trim(),
        principalMinor,
        currency: 'BDT',
        duration: String(row[cols.duration] ?? '').trim(),
        note: '',
        repayments,
        investmentOutcome: 'running',
        zakatable: true,
        expectedRepaymentDate: null,
      },
    });
  }
  return { rows, skipped };
}

// --- Historical yearly totals (Yearly Statement + Monthly Statement) → historicalYearlyTotals/{year} ---
// Architecture Plan §২ (C1/C17/O5): totalIncome থেকে "বিনিয়োগ হতে" বাদ; totalDeposit = ওই বছরের ডিসেম্বরের
// Monthly Statement-এর Total Deposit (Monthly শীটে বছর না থাকলে Yearly শীটের Total Deposit)। Header/label lookup —
// hardcoded row/col না (Source File Freshness Rule)।
export interface HistoricalYearRow {
  year: number;
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  totalDepositMinor: number;
  investmentIncomeExcludedMinor: number; // preview-এর জন্য; Firestore-এ যায় না
  depositSource: 'monthly-december' | 'yearly-sheet';
}
export interface HistoricalParseResult {
  rows: HistoricalYearRow[];
  errors: string[];
}

const YEAR_RE = /(20\d{2})/;

export function parseHistoricalYearly(workbook: XLSX.WorkBook, excludeYears: number[] = []): HistoricalParseResult {
  const errors: string[] = [];
  const ys = workbook.Sheets['Yearly Statement'];
  if (!ys) return { rows: [], errors: ['"Yearly Statement" শীট পাওয়া যায়নি'] };
  const yGrid: unknown[][] = XLSX.utils.sheet_to_json(ys, { header: 1, raw: true, defval: null });

  const hIdx = yGrid.findIndex((r) => (r ?? []).some((c) => norm(c) === 'title'));
  if (hIdx < 0) return { rows: [], errors: ['Yearly Statement-এ "Title" header row পাওয়া যায়নি'] };
  const header = yGrid[hIdx];
  const titleCol = header.findIndex((c) => norm(c) === 'title');
  const yearCols = new Map<number, number>();
  header.forEach((c, i) => {
    const m = i !== titleCol ? YEAR_RE.exec(String(c ?? '')) : null;
    if (m) yearCols.set(Number(m[1]), i);
  });

  const LABELS = { cost: 'total cost (y)', income: 'total income', deposit: 'total deposit' } as const;
  const rowOf: Partial<Record<keyof typeof LABELS, unknown[]>> = {};
  for (let i = hIdx + 1; i < yGrid.length; i++) {
    const label = norm(yGrid[i]?.[titleCol]);
    for (const k of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
      if (label === LABELS[k] && !rowOf[k]) rowOf[k] = yGrid[i];
    }
  }
  for (const k of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
    if (!rowOf[k]) errors.push(`Yearly Statement-এ "${LABELS[k]}" row পাওয়া যায়নি`);
  }
  if (errors.length) return { rows: [], errors };

  // Monthly Statement: বছর-সেকশন → December Total Deposit + সেকশনের Total-এর "বিনিয়োগ হতে"
  const monthly = new Map<number, { deposit: number | null; invest: number }>();
  const ms = workbook.Sheets['Monthly Statement'];
  if (ms) {
    const g: unknown[][] = XLSX.utils.sheet_to_json(ms, { header: 1, raw: true, defval: null });
    let cur: number | null = null;
    let investCol = -1;
    let depositCol = -1;
    for (const row of g) {
      const first = norm(row?.[0]);
      const sec = /^(20\d{2}) income/.exec(first);
      if (sec) {
        cur = Number(sec[1]);
        investCol = -1;
        depositCol = -1;
        monthly.set(cur, { deposit: null, invest: 0 });
        continue;
      }
      if (cur == null) continue;
      const entry = monthly.get(cur)!;
      if (first === 'মাস') {
        investCol = row.findIndex((c) => norm(c).includes('বিনিয়োগ'));
        depositCol = row.findIndex((c) => norm(c) === 'total deposit');
      } else if (first === 'december' && depositCol >= 0) {
        entry.deposit = parseTakaToMinorAllowAny(row[depositCol]);
      } else if (first === 'total' && investCol >= 0) {
        entry.invest = parseTakaToMinorAllowAny(row[investCol]) ?? 0;
      }
    }
  }

  const rows: HistoricalYearRow[] = [];
  for (const [year, col] of [...yearCols.entries()].sort((a, b) => a[0] - b[0])) {
    if (excludeYears.includes(year)) continue;
    const cost = parseTakaToMinorAllowAny(rowOf.cost![col]);
    const income = parseTakaToMinorAllowAny(rowOf.income![col]);
    const yDeposit = parseTakaToMinorAllowAny(rowOf.deposit![col]);
    if (cost == null || income == null) {
      errors.push(`${year}: Total Cost/Total Income পড়া যায়নি`);
      continue;
    }
    const m = monthly.get(year);
    const dec = m?.deposit ?? null;
    const deposit = dec ?? yDeposit;
    if (deposit == null) {
      errors.push(`${year}: Total Deposit পড়া যায়নি`);
      continue;
    }
    const excluded = m?.invest ?? 0;
    rows.push({
      year,
      totalIncomeMinor: income - excluded,
      totalExpenseMinor: cost,
      totalDepositMinor: deposit,
      investmentIncomeExcludedMinor: excluded,
      depositSource: dec != null ? 'monthly-december' : 'yearly-sheet',
    });
  }
  return { rows, errors };
}

// --- Monthly netWorthSnapshots backfill (Overview → Net Worth Trend chart history, P4, Checklist P4) ---
// Excel "Monthly Statement" শীটের প্রতি-মাস "Total Deposit" কলাম থেকে netWorthSnapshots/{yyyymm} backfill —
// শুধু chart-history দেখানোর জন্য (Cross-check কখনো এই ডেটা ব্যবহার করবে না, Cross-check শুধু owner নিজে
// "Save & Snapshot" চাপা baseline থেকে prospective, C7)। কোনো existing doc overwrite এখানে হবে না — caller
// (ImportExcelMonthlySnapshots.tsx) Firestore-এর existing yyyymm-দের বিরুদ্ধে exclusiveMaxYyyymm নির্ধারণ করে
// পাঠায়, যাতে owner-এর নিজে-নেওয়া Aug ২০২৬ baseline-সহ যেকোনো বিদ্যমান doc কখনো ছোঁয়া না হয়।
const MONTH_NUM: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function lastDayOfMonthStr(year: number, month: number): string {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface MonthlySnapshotRow {
  yyyymm: string;
  totalDepositMinor: number;
  snapshotDate: string;
  unverified: boolean;
}
export interface MonthlySnapshotParseResult {
  rows: MonthlySnapshotRow[];
  skipped: { yyyymm: string; reason: string }[];
  errors: string[];
}

/** minYyyymm ≤ yyyymm < exclusiveMaxYyyymm রেঞ্জের মাসগুলো পড়ে (caller বাউন্ড ঠিক করে, hardcode এখানে না)।
 *  unverifiedYyyymm — DF11-এর মতো known Excel-Deviation-অমিল থাকা মাসকে flag করার জন্য (ঐচ্ছিক)। */
export function parseMonthlyNetWorthSnapshots(
  workbook: XLSX.WorkBook,
  opts: { minYyyymm: string; exclusiveMaxYyyymm: string; unverifiedYyyymm?: string[] },
): MonthlySnapshotParseResult {
  const sheet = workbook.Sheets['Monthly Statement'];
  if (!sheet) return { rows: [], skipped: [], errors: ['"Monthly Statement" শীট পাওয়া যায়নি'] };
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const rows: MonthlySnapshotRow[] = [];
  const skipped: { yyyymm: string; reason: string }[] = [];
  let curYear: number | null = null;
  let depositCol = -1;

  for (const row of grid) {
    const first = norm(row?.[0]);
    const sec = /^(20\d{2}) income/.exec(first);
    if (sec) {
      curYear = Number(sec[1]);
      depositCol = -1;
      continue;
    }
    if (curYear == null) continue;
    if (first === 'মাস') {
      depositCol = findCol(row, BALANCE_HEADER_ALIASES.totalDeposit);
      continue;
    }
    const monthNum = MONTH_NUM[first];
    if (!monthNum || depositCol === -1) continue;

    const yyyymm = `${curYear}-${String(monthNum).padStart(2, '0')}`;
    if (yyyymm < opts.minYyyymm || yyyymm >= opts.exclusiveMaxYyyymm) continue;

    const minor = parseTakaToMinorAllowAny(row[depositCol]);
    if (minor == null || minor === 0) {
      skipped.push({ yyyymm, reason: 'Total Deposit ফাঁকা/০ (ভবিষ্যৎ/অনুপস্থিত মাস)' });
      continue;
    }
    rows.push({
      yyyymm,
      totalDepositMinor: minor,
      snapshotDate: lastDayOfMonthStr(curYear, monthNum),
      unverified: (opts.unverifiedYyyymm ?? []).includes(yyyymm),
    });
  }
  rows.sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
  return { rows, skipped, errors: [] };
}

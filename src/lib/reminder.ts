// In-app reminder সিদ্ধান্ত (pure — React/Firebase-মুক্ত, Architecture Plan §৪ reminder.ts, Roadmap §৪.১৩/§৪.১০)।
// এটা guaranteed push না: অ্যাপ না খুললে মিস হবে (Cloud Function ছাড়া সম্ভব না)।
import { shiftMonth, toDhakaDate } from './date';
import { investmentStatus } from './investmentCalc';
import { repaymentStatus } from './debtCalc';

export const DUE_WINDOW_DAYS = 3; // মেয়াদ-শেষের ৩ দিন আগে থেকে (আজ সহ) — export: Ledger due-soon chip (UI Polish 1_5 §৩) reuse করে

export type BudgetLevel = '70' | '80' | '90' | '100';
export type BudgetTone = 'info' | 'warning' | 'danger' | 'critical';

export interface ReminderSettings {
  reminderEnabled: boolean;
  lastReminderShownDate: string | null;
  lastDueDateReminderShownDate: string | null; // G2
  lastBudgetThresholdShownDate: string | null;
  lastBudgetThresholdShownLevel: BudgetLevel | null;
  overallMonthlyBudgetMinor: number | null;
}
export interface SnapshotLike {
  yyyymm: string;
  snapshotDate: string;
}
/** Due-date reminder-এর উৎস: `expectedRepaymentDate` ফাঁকা (null) হলে সেই entry silently বাদ (G2) */
export interface DueItem {
  name: string;
  expectedRepaymentDate: string | null;
  /** সম্পূর্ণ পরিশোধ / forgiven / written_off — reminder অর্থহীন */
  settled: boolean;
}
export interface DebtLike {
  person: string;
  totalAmountMinor: number;
  repayments: readonly { date: string; amountMinor: number }[];
  receivableStatus: string;
  expectedRepaymentDate: string | null;
}
export interface InvestmentLike {
  investedTo: string;
  principalMinor: number;
  repayments: readonly { date: string; amountMinor: number }[];
  investmentOutcome: string;
  expectedRepaymentDate: string | null;
}
export function dueItemsFrom(debts: readonly DebtLike[], investments: readonly InvestmentLike[]): DueItem[] {
  return [
    ...debts.map((d) => ({
      name: d.person,
      expectedRepaymentDate: d.expectedRepaymentDate,
      settled: repaymentStatus(d.totalAmountMinor, d.repayments) === 'paid' || d.receivableStatus === 'forgiven',
    })),
    ...investments.map((i) => ({
      name: i.investedTo,
      expectedRepaymentDate: i.expectedRepaymentDate,
      settled: investmentStatus(i.principalMinor, i.repayments) === 'closed' || i.investmentOutcome === 'written_off',
    })),
  ];
}

/** নিকটতম due item (window-এর মধ্যে, overdue-সহ, lower bound নেই) — pickReminders-এর একই due-date
 *  জানালা-লজিক reuse করে, শুধু "একটা reminder message" না দিয়ে name+day-count রিটার্ন করে। Ledger
 *  ট্যাবের Debts কার্ডের due-soon chip-এর উৎস (UI Polish 1_5 §৩, নতুন calculation না)। */
export function nearestDueItem(items: readonly DueItem[], today: string): { name: string; days: number } | null {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + DUE_WINDOW_DAYS);
  const last = limit.toISOString().slice(0, 10);
  const candidates = [...items]
    .filter((d): d is DueItem & { expectedRepaymentDate: string } => !d.settled && !!d.expectedRepaymentDate && d.expectedRepaymentDate <= last)
    .sort((a, b) => (a.expectedRepaymentDate < b.expectedRepaymentDate ? -1 : 1));
  if (candidates.length === 0) return null;
  const item = candidates[0];
  const days = Math.round((new Date(`${item.expectedRepaymentDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000);
  return { name: item.name, days };
}

export interface ReminderInput {
  now: Date;
  settings: ReminderSettings;
  snapshots: readonly SnapshotLike[];
  /** চলতি মাসের মোট ব্যয় (লাইভ যোগফল) */
  monthExpenseMinor: number;
  /** ঐচ্ছিক — না দিলে due-date reminder নেই */
  dues?: readonly DueItem[];
}
export type Reminder =
  | { kind: 'budget'; level: BudgetLevel; tone: BudgetTone; message: string }
  | { kind: 'monthEnd'; message: string }
  | { kind: 'missedMonth'; month: string; message: string }
  | { kind: 'dueDate'; message: string };

const BUDGET_MESSAGES: Record<BudgetLevel, { tone: BudgetTone; message: string }> = {
  '70': { tone: 'info', message: "You've used 70% of your monthly budget." },
  '80': { tone: 'warning', message: "You've used 80% of your monthly budget." },
  '90': { tone: 'danger', message: "You've used 90% of your monthly budget." },
  '100': { tone: 'critical', message: "You've exceeded your monthly budget." },
};

export function budgetLevel(spentMinor: number, budgetMinor: number): BudgetLevel | null {
  if (budgetMinor <= 0) return null;
  const pct = (spentMinor * 100) / budgetMinor;
  if (pct >= 100) return '100';
  if (pct >= 90) return '90';
  if (pct >= 80) return '80';
  if (pct >= 70) return '70';
  return null;
}

const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hourCycle: 'h23' });
export function dhakaHour(now: Date): number {
  return Number(hourFmt.format(now));
}

function isLastDayOfMonth(today: string): boolean {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.getUTCDate() === 1;
}

/** প্রাসঙ্গিক reminder-এর তালিকা (অগ্রাধিকার: budget → month-end → missed-month)। খালি = কিছু দেখানোর নেই। */
export function pickReminders(input: ReminderInput): Reminder[] {
  const { now, settings, snapshots, monthExpenseMinor, dues = [] } = input;
  if (!settings.reminderEnabled) return [];
  const today = toDhakaDate(now);
  const month = today.slice(0, 7);
  const out: Reminder[] = [];

  // Budget: একটা মাসে প্রতিটা স্তর একবার; শুধু সর্বোচ্চ crossed স্তর; নিচের স্তর re-show হয় না; মাস বদলালে reset
  if (settings.overallMonthlyBudgetMinor) {
    const level = budgetLevel(monthExpenseMinor, settings.overallMonthlyBudgetMinor);
    if (level) {
      const shownThisMonth = settings.lastBudgetThresholdShownDate?.slice(0, 7) === month;
      const shownLevel = shownThisMonth && settings.lastBudgetThresholdShownLevel ? Number(settings.lastBudgetThresholdShownLevel) : 0;
      if (Number(level) > shownLevel) out.push({ kind: 'budget', level, ...BUDGET_MESSAGES[level] });
    }
  }

  if (settings.lastReminderShownDate !== today) {
    const snapByMonth = new Map(snapshots.map((s) => [s.yyyymm, s]));
    // (ক) মাসের শেষ দিন সন্ধ্যা ৭টার পর; আজই এই মাসের snapshot নেওয়া হয়ে থাকলে আর দরকার নেই
    if (isLastDayOfMonth(today) && dhakaHour(now) >= 19 && snapByMonth.get(month)?.snapshotDate !== today) {
      out.push({ kind: 'monthEnd', message: "Today is the last day of the month. Don't forget to update your monthly balances." });
    }
    // (খ) fallback: মাসের প্রথম ৩ দিনে আগের মাসের snapshot না থাকলে
    const prev = shiftMonth(month, -1);
    if (Number(today.slice(8, 10)) <= 3 && !snapByMonth.has(prev)) {
      out.push({ kind: 'missedMonth', month: prev, message: "Last month's balances haven't been updated." });
    }
  }

  // Due-date (G2): আজ থেকে ৩ দিনের মধ্যে মেয়াদ, বা ইতিমধ্যে overdue (lower bound নেই); ফাঁকা তারিখ/settled entry স্কিপ; দিনে একবার (debounce)
  if (settings.lastDueDateReminderShownDate !== today) {
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + DUE_WINDOW_DAYS);
    const last = limit.toISOString().slice(0, 10);
    const soon = dues
      .filter((d) => !d.settled && d.expectedRepaymentDate && d.expectedRepaymentDate <= last)
      .sort((a, b) => (a.expectedRepaymentDate! < b.expectedRepaymentDate! ? -1 : 1));
    if (soon.length > 0) {
      out.push({ kind: 'dueDate', message: soon.map((d) => `${d.name} is due on ${d.expectedRepaymentDate}.`).join(' ') });
    }
  }
  return out;
}

// Home বেল-এর নোটিফিকেশন তালিকা (pure — React/Firebase-মুক্ত, Architecture Plan §০ lib/ purity)।
// ব্যানার (reminder.ts) থেকে আলাদা: ব্যানারে "দিনে একবার" debounce আছে, এখানে নেই — যা এখন সত্যি তার তালিকা।
// কিছু জমা রাখা হয় না; অ্যাপ খুললে লাইভ হিসাব। অ্যাপ বন্ধ থাকলে কিছু আসে না (push নেই)।
import { monthSpendStats } from './budgetPace';
import { dateLabel, shiftMonth, toDhakaDate } from './date';
import { formatAmount } from './format';
import { BUDGET_MESSAGES, budgetLevel, isLastDayOfMonth, type BudgetTone, type DueItem } from './reminder';

export const DUE_WINDOW = 3; // মেয়াদের ৩ দিন আগে থেকে (overdue-সহ)
export const FORECAST_MIN_DAYS = 5; // মাসের প্রথম কয়েক দিনের গড় অস্থির — এর আগে forecast সতর্কতা নেই

export type NotificationTarget = 'menu' | 'ledger' | 'networth';
export interface AppNotification {
  /** স্থিতিশীল আইডি — "দেখা হয়েছে" মনে রাখতে ব্যবহৃত (নতুন ঘটনা = নতুন আইডি) */
  id: string;
  kind: 'budget' | 'forecast' | 'due' | 'monthEnd' | 'missedMonth';
  tone: BudgetTone;
  message: string;
  target: NotificationTarget;
  /** networth টার্গেটে কোন মাস preselect হবে */
  month?: string;
}
export interface NotificationInput {
  now: Date;
  reminderEnabled: boolean;
  budgetMinor: number | null;
  /** চলতি মাসের মোট ব্যয় */
  monthExpenseMinor: number;
  snapshots: readonly { yyyymm: string; snapshotDate: string }[];
  dues: readonly DueItem[];
}

export function buildNotifications(input: NotificationInput): AppNotification[] {
  const { now, reminderEnabled, budgetMinor, monthExpenseMinor, snapshots, dues } = input;
  if (!reminderEnabled) return [];
  const today = toDhakaDate(now);
  const month = today.slice(0, 7);
  const out: AppNotification[] = [];

  if (budgetMinor && budgetMinor > 0) {
    const level = budgetLevel(monthExpenseMinor, budgetMinor);
    if (level) out.push({ id: `budget:${month}:${level}`, kind: 'budget', ...BUDGET_MESSAGES[level], target: 'menu' });
    // forecast: ১০০%-এর আগে পর্যন্ত (১০০%+ হলে level-নোটিফিকেশনই যথেষ্ট)
    if (level !== '100') {
      const s = monthSpendStats(monthExpenseMinor, budgetMinor, month, today);
      if (s.forecastMinor != null && s.elapsedDays >= FORECAST_MIN_DAYS && s.forecastMinor > budgetMinor) {
        out.push({
          id: `forecast:${month}`,
          kind: 'forecast',
          tone: 'warning',
          message: `At this pace you may spend ${formatAmount(s.forecastMinor)} this month, above your ${formatAmount(budgetMinor)} target.`,
          target: 'menu',
        });
      }
    }
  }

  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + DUE_WINDOW);
  const last = limit.toISOString().slice(0, 10);
  const soon = dues
    .filter((d): d is DueItem & { expectedRepaymentDate: string } => !d.settled && !!d.expectedRepaymentDate && d.expectedRepaymentDate <= last)
    .sort((a, b) => (a.expectedRepaymentDate < b.expectedRepaymentDate ? -1 : 1));
  for (const d of soon) {
    const when = d.expectedRepaymentDate;
    const overdue = when < today;
    out.push({
      id: `due:${d.name}:${when}`,
      kind: 'due',
      tone: overdue ? 'danger' : 'warning',
      message: when === today ? `${d.name} is due today.` : overdue ? `${d.name} was due on ${dateLabel(when, today)}.` : `${d.name} is due on ${dateLabel(when, today)}.`,
      target: 'ledger',
    });
  }

  const snapByMonth = new Map(snapshots.map((s) => [s.yyyymm, s]));
  if (isLastDayOfMonth(today) && snapByMonth.get(month)?.snapshotDate !== today) {
    out.push({
      id: `monthEnd:${month}`,
      kind: 'monthEnd',
      tone: 'info',
      message: "Today is the last day of the month. Don't forget to update your monthly balances.",
      target: 'networth',
      month,
    });
  }
  const prev = shiftMonth(month, -1);
  if (Number(today.slice(8, 10)) <= 3 && !snapByMonth.has(prev)) {
    out.push({
      id: `missedMonth:${prev}`,
      kind: 'missedMonth',
      tone: 'info',
      message: "Last month's balances haven't been updated.",
      target: 'networth',
      month: prev,
    });
  }
  return out;
}

export function unseenCount(list: readonly AppNotification[], seen: readonly string[]): number {
  const s = new Set(seen);
  return list.filter((n) => !s.has(n.id)).length;
}

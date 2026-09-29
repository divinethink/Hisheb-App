import { describe, expect, it } from 'vitest';
import { budgetLevel, dueItemsFrom, pickReminders, type DueItem, type ReminderSettings } from './reminder';

const base: ReminderSettings = {
  reminderEnabled: true,
  lastReminderShownDate: null,
  lastDueDateReminderShownDate: null,
  lastBudgetThresholdShownDate: null,
  lastBudgetThresholdShownLevel: null,
  overallMonthlyBudgetMinor: null,
};
const at = (iso: string) => new Date(iso); // Dhaka = UTC+6
const pick = (iso: string, over: Partial<ReminderSettings> = {}, snaps: { yyyymm: string; snapshotDate: string }[] = [], spent = 0) =>
  pickReminders({ now: at(iso), settings: { ...base, ...over }, snapshots: snaps, monthExpenseMinor: spent });

describe('budgetLevel', () => {
  it('স্তর-সীমা', () => {
    expect(budgetLevel(6999, 10000)).toBeNull();
    expect(budgetLevel(7000, 10000)).toBe('70');
    expect(budgetLevel(8000, 10000)).toBe('80');
    expect(budgetLevel(9000, 10000)).toBe('90');
    expect(budgetLevel(10000, 10000)).toBe('100');
    expect(budgetLevel(50, 0)).toBeNull();
  });
});

describe('pickReminders — budget', () => {
  const s = { overallMonthlyBudgetMinor: 10000 };
  it('সর্বোচ্চ crossed স্তর দেখায়', () => {
    const r = pick('2026-09-15T06:00:00Z', s, [], 9200);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'budget', level: '90', tone: 'danger' });
  });
  it('একই মাসে দেখানো স্তর বা তার নিচের স্তর re-show হয় না; উঁচু স্তর হয়', () => {
    const shown = { ...s, lastBudgetThresholdShownDate: '2026-09-10', lastBudgetThresholdShownLevel: '80' as const };
    expect(pick('2026-09-15T06:00:00Z', shown, [], 8500)).toHaveLength(0);
    expect(pick('2026-09-15T06:00:00Z', shown, [], 9500)[0]).toMatchObject({ level: '90' });
  });
  it('নতুন মাসে reset', () => {
    const shown = { ...s, lastBudgetThresholdShownDate: '2026-08-28', lastBudgetThresholdShownLevel: '100' as const };
    expect(pick('2026-09-15T06:00:00Z', shown, [], 7500)[0]).toMatchObject({ level: '70' });
  });
  it('বাজেট না থাকলে/reminder বন্ধ থাকলে কিছুই না', () => {
    expect(pick('2026-09-15T06:00:00Z', {}, [], 99999)).toHaveLength(0);
    expect(pick('2026-09-15T06:00:00Z', { ...s, reminderEnabled: false }, [], 99999)).toHaveLength(0);
  });
});

describe('pickReminders — month-end / fallback', () => {
  const prevSnap = [{ yyyymm: '2026-08', snapshotDate: '2026-08-31' }];
  it('মাসের শেষ দিন ১৯:০০ Dhaka-র পর দেখায়', () => {
    expect(pick('2026-09-30T13:00:00Z', {}, prevSnap)[0]).toMatchObject({ kind: 'monthEnd' }); // 19:00 Dhaka
  });
  it('১৯:০০-র আগে বা মাসের শেষ দিন না হলে দেখায় না', () => {
    expect(pick('2026-09-30T12:59:00Z', {}, prevSnap)).toHaveLength(0); // 18:59 Dhaka
    expect(pick('2026-09-29T15:00:00Z', {}, prevSnap)).toHaveLength(0);
  });
  it('UTC-তে পরের দিন হলেও Dhaka-তারিখ ধরে (রাত ১১টা Dhaka)', () => {
    expect(pick('2026-09-30T17:00:00Z', {}, prevSnap)[0]).toMatchObject({ kind: 'monthEnd' });
  });
  it('আজ ইতিমধ্যে দেখানো হয়ে থাকলে বা আজই snapshot নেওয়া থাকলে না', () => {
    expect(pick('2026-09-30T14:00:00Z', { lastReminderShownDate: '2026-09-30' }, prevSnap)).toHaveLength(0);
    expect(pick('2026-09-30T14:00:00Z', {}, [...prevSnap, { yyyymm: '2026-09', snapshotDate: '2026-09-30' }])).toHaveLength(0);
  });
  it('ফেব্রুয়ারির শেষ দিন (leap নয়) ধরে', () => {
    expect(pick('2026-02-28T14:00:00Z', {}, [{ yyyymm: '2026-01', snapshotDate: '2026-01-31' }])[0]).toMatchObject({ kind: 'monthEnd' });
  });
  it('মাসের প্রথম ৩ দিনে আগের মাসের snapshot না থাকলে fallback (আগের মাস preselect)', () => {
    expect(pick('2026-10-02T06:00:00Z', {}, prevSnap)[0]).toMatchObject({ kind: 'missedMonth', month: '2026-09' });
    expect(pick('2026-10-02T06:00:00Z', {}, [{ yyyymm: '2026-09', snapshotDate: '2026-09-30' }])).toHaveLength(0);
    expect(pick('2026-10-04T06:00:00Z', {}, prevSnap)).toHaveLength(0);
  });
  it('বছর-সীমা: জানুয়ারির শুরুতে আগের মাস = ডিসেম্বর', () => {
    expect(pick('2027-01-01T06:00:00Z', {}, [])[0]).toMatchObject({ kind: 'missedMonth', month: '2026-12' });
  });
});

describe('pickReminders — due-date (G2)', () => {
  const now = '2026-09-25T06:00:00Z'; // Dhaka 2026-09-25
  const run = (dues: DueItem[], over: Partial<ReminderSettings> = {}) =>
    pickReminders({ now: at(now), settings: { ...base, ...over }, snapshots: [{ yyyymm: '2026-08', snapshotDate: '2026-08-31' }], monthExpenseMinor: 0, dues });
  const due = (name: string, date: string | null, settled = false): DueItem => ({ name, expectedRepaymentDate: date, settled });

  it('আজ থেকে ৩ দিনের মধ্যে হলে দেখায়, তারিখ-ক্রমে', () => {
    const r = run([due('B', '2026-09-28'), due('A', '2026-09-25')]);
    expect(r).toEqual([{ kind: 'dueDate', message: 'A is due on 2026-09-25. B is due on 2026-09-28.' }]);
  });
  it('ফাঁকা তারিখ, সীমার বাইরে, বা settled হলে silently স্কিপ', () => {
    expect(run([due('X', null), due('Y', '2026-09-29'), due('W', '2026-09-26', true)])).toHaveLength(0);
  });
  it('overdue (মেয়াদ পেরিয়ে গেছে) entry-ও দেখায় — lower bound নেই', () => {
    expect(run([due('Z', '2026-09-24')])).toEqual([{ kind: 'dueDate', message: 'Z is due on 2026-09-24.' }]);
  });
  it('আজ দেখানো হয়ে থাকলে বা reminder বন্ধ থাকলে না', () => {
    expect(run([due('A', '2026-09-26')], { lastDueDateReminderShownDate: '2026-09-25' })).toHaveLength(0);
    expect(run([due('A', '2026-09-26')], { reminderEnabled: false })).toHaveLength(0);
  });
  it('dueItemsFrom: পরিশোধিত/forgiven/closed/written_off = settled', () => {
    const items = dueItemsFrom(
      [
        { person: 'P1', totalAmountMinor: 100, repayments: [{ date: '2026-09-20', amountMinor: 100 }], receivableStatus: 'active', expectedRepaymentDate: '2026-09-26' },
        { person: 'P2', totalAmountMinor: 100, repayments: [], receivableStatus: 'forgiven', expectedRepaymentDate: '2026-09-26' },
        { person: 'P3', totalAmountMinor: 100, repayments: [{ date: '2026-09-20', amountMinor: 10 }], receivableStatus: 'doubtful', expectedRepaymentDate: '2026-09-26' },
      ],
      [
        { investedTo: 'I1', principalMinor: 100, repayments: [], investmentOutcome: 'written_off', expectedRepaymentDate: '2026-09-26' },
        { investedTo: 'I2', principalMinor: 100, repayments: [], investmentOutcome: 'running', expectedRepaymentDate: '2026-09-26' },
      ],
    );
    expect(items.map((i) => i.settled)).toEqual([true, true, false, true, false]);
  });
});

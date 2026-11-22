import { describe, expect, it } from 'vitest';
import { buildNotifications, unseenCount, type NotificationInput } from './notifications';

const base: NotificationInput = { now: new Date('2026-11-12T06:00:00Z'), reminderEnabled: true, budgetMinor: null, monthExpenseMinor: 0, snapshots: [{ yyyymm: '2026-10', snapshotDate: '2026-10-31' }], dues: [] };
const run = (o: Partial<NotificationInput>) => buildNotifications({ ...base, ...o });

describe('buildNotifications', () => {
  it('বন্ধ থাকলে খালি', () => {
    expect(run({ reminderEnabled: false, budgetMinor: 1000, monthExpenseMinor: 2000 })).toEqual([]);
  });
  it('কিছু না থাকলে খালি', () => {
    expect(run({})).toEqual([]);
  });
  it('budget স্তর — আইডিতে মাস ও স্তর', () => {
    const r = run({ budgetMinor: 10000, monthExpenseMinor: 9200 });
    expect(r[0]).toMatchObject({ id: 'budget:2026-11:90', kind: 'budget', target: 'menu' });
  });
  it('১০০%+ হলে forecast আলাদা আসে না', () => {
    expect(run({ budgetMinor: 10000, monthExpenseMinor: 12000 }).map((n) => n.kind)).toEqual(['budget']);
  });
  it('forecast: ১২ দিনে ৫০% খরচ → মাস-শেষে ছাড়াবে', () => {
    const r = run({ budgetMinor: 10000, monthExpenseMinor: 5000 });
    expect(r.map((n) => n.kind)).toEqual(['forecast']);
  });
  it('মাসের শুরুর ৪ দিনে forecast নেই', () => {
    expect(run({ now: new Date('2026-11-04T06:00:00Z'), budgetMinor: 10000, monthExpenseMinor: 3000 })).toEqual([]);
  });
  it('due: ৩ দিনের মধ্যে ও overdue আলাদা লাইনে; settled/ফাঁকা বাদ', () => {
    const r = run({
      dues: [
        { name: 'A', expectedRepaymentDate: '2026-11-14', settled: false },
        { name: 'B', expectedRepaymentDate: '2026-11-01', settled: false },
        { name: 'C', expectedRepaymentDate: '2026-11-13', settled: true },
        { name: 'D', expectedRepaymentDate: null, settled: false },
        { name: 'E', expectedRepaymentDate: '2026-11-30', settled: false },
      ],
    });
    expect(r.map((n) => n.id)).toEqual(['due:B:2026-11-01', 'due:A:2026-11-14']);
    expect(r[0].tone).toBe('danger');
  });
  it('মাস-শেষ ও missed-month', () => {
    expect(run({ now: new Date('2026-11-30T14:00:00Z') }).map((n) => n.kind)).toContain('monthEnd');
    const m = run({ now: new Date('2026-11-02T06:00:00Z'), snapshots: [] });
    expect(m[0]).toMatchObject({ kind: 'missedMonth', month: '2026-10', target: 'networth' });
  });
});

describe('unseenCount', () => {
  it('শুধু নতুন আইডি গোনে', () => {
    const l = run({ budgetMinor: 10000, monthExpenseMinor: 9200 });
    expect(unseenCount(l, [])).toBe(1);
    expect(unseenCount(l, ['budget:2026-11:90'])).toBe(0);
    expect(unseenCount(l, ['budget:2026-11:80'])).toBe(1);
  });
});

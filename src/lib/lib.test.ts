import { describe, it, expect } from 'vitest';
import { formatAmount, formatNet, formatSigned } from './format';
import { minorToInput, parseAmountToMinor } from './money';
import { currentMonth, dateLabel, formatDisplayDate, isValidDate, occurredAtFor, toDhakaDate } from './date';
import { groupByDate, summarize } from './summary';

describe('formatAmount (lakh-style, DF9)', () => {
  it.each([
    [0, 'BDT 0'],
    [99900, 'BDT 999'],
    [100000, 'BDT 1,000'],
    [4440800, 'BDT 44,408'],
    [16241700, 'BDT 1,62,417'],
    [123456789000, 'BDT 1,23,45,67,890'],
    [12550, 'BDT 125.50'],
  ])('%i → %s', (minor, out) => expect(formatAmount(minor)).toBe(out));
  it('signed', () => {
    expect(formatSigned(130000, 'expense')).toBe('−BDT 1,300');
    expect(formatSigned(130000, 'income')).toBe('+BDT 1,300');
    expect(formatNet(-50000)).toBe('−BDT 500');
    expect(formatNet(0)).toBe('BDT 0');
  });
});

describe('parseAmountToMinor (ধনাত্মক int, R1)', () => {
  it.each([
    ['1250', 125000],
    ['1,250.5', 125050],
    ['0.01', 1],
    ['1.005', null], // ৩ দশমিক — অবৈধ
    ['0', null],
    ['-5', null],
    ['', null],
    ['abc', null],
    ['১২৩', null], // Latin সংখ্যা ছাড়া নয়
    ['1234567890123', null], // ১২ অঙ্কের বেশি
  ])('%s → %s', (s, out) => expect(parseAmountToMinor(s)).toBe(out));
  it('minorToInput round-trips', () => {
    for (const s of ['1250', '1250.5', '0.07', '10.25']) expect(minorToInput(parseAmountToMinor(s)!)).toBe(s);
  });
});

describe('date (Asia/Dhaka)', () => {
  it('UTC evening rolls to next Dhaka day (real CSV rows)', () => {
    expect(toDhakaDate(new Date('2025-09-30T18:32:14+00:00'))).toBe('2025-10-01');
    expect(toDhakaDate(new Date('2026-08-31T19:37:37+00:00'))).toBe('2026-09-01');
    expect(toDhakaDate(new Date('2025-09-19T07:46:06+00:00'))).toBe('2025-09-19');
  });
  it('currentMonth, isValidDate', () => {
    expect(currentMonth(new Date('2026-09-22T00:00:00Z'))).toBe('2026-09');
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-02-28')).toBe(true);
  });
  it('occurredAtFor', () => {
    const now = new Date('2026-09-22T05:00:00Z');
    expect(occurredAtFor('2026-09-22', now)).toBe(now);
    expect(occurredAtFor('2026-09-01', now).toISOString()).toBe('2026-09-01T06:00:00.000Z');
  });
  it('dateLabel', () => {
    expect(dateLabel('2026-09-22', '2026-09-22')).toBe('Today');
    expect(dateLabel('2026-09-21', '2026-09-22')).toBe('Yesterday');
    expect(dateLabel('2026-09-04', '2026-09-22')).toBe('Sep 4');
    expect(dateLabel('2025-12-04', '2026-09-22')).toBe('Dec 4, 2025');
  });

  it('formatDisplayDate', () => {
    expect(formatDisplayDate('2026-09-04')).toBe('4/9/2026');
    expect(formatDisplayDate('2026-01-21')).toBe('21/1/2026');
  });
});

describe('summary', () => {
  const mk = (id: string, date: string, type: 'income' | 'expense', amountMinor: number, iso: string) => ({
    id, date, type, amountMinor, occurredAt: { toDate: () => new Date(iso) },
  });
  const txs = [
    mk('a', '2026-09-03', 'expense', 51500, '2026-09-03T08:00:00Z'),
    mk('b', '2026-09-03', 'expense', 130000, '2026-09-03T18:00:00Z'),
    mk('c', '2026-09-01', 'income', 4200800, '2026-09-01T10:00:00Z'),
  ];
  it('sums income/expense/savings', () => {
    expect(summarize(txs)).toEqual({ incomeMinor: 4200800, expenseMinor: 181500, savingsMinor: 4019300 });
  });
  it('groups by date desc, newest first inside day, with net', () => {
    const g = groupByDate(txs);
    expect(g.map((x) => x.date)).toEqual(['2026-09-03', '2026-09-01']);
    expect(g[0].txs.map((t) => t.id)).toEqual(['b', 'a']);
    expect(g[0].netMinor).toBe(-181500);
  });
});

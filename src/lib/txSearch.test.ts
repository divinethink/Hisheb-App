import { describe, expect, it } from 'vitest';
import { searchTransactions, type SearchableTx } from './txSearch';

const mk = (id: string, date: string, amountMinor: number, categoryName: string, note = '', labelNames: string[] = [], ms = 0): SearchableTx => ({
  id,
  date,
  type: 'expense',
  amountMinor,
  occurredAt: { toDate: () => new Date(ms) },
  categoryName,
  note,
  labelNames,
});
const data = [
  mk('a', '2026-10-25', 6000, 'Groceries', 'দুধ ও ডিম', ['Family']),
  mk('b', '2026-09-10', 31500, 'Groceries', '', [], 1),
  mk('c', '2026-10-20', 4200800, 'Salary', 'Oct pay'),
  mk('d', '2026-10-25', 315050, 'Bills', 'gas', ['Home'], 5),
];

describe('searchTransactions', () => {
  it('খালি query → কিছু না', () => {
    expect(searchTransactions(data, '  ')).toEqual([]);
  });
  it('সব মাসে category/note/label (case-insensitive) খোঁজে, নতুন আগে', () => {
    expect(searchTransactions(data, 'groc').map((t) => t.id)).toEqual(['a', 'b']);
    expect(searchTransactions(data, 'দুধ').map((t) => t.id)).toEqual(['a']);
    expect(searchTransactions(data, 'HOME').map((t) => t.id)).toEqual(['d']);
  });
  it('অঙ্ক: taka substring, কমা/BDT উপেক্ষিত', () => {
    expect(searchTransactions(data, '315').map((t) => t.id)).toEqual(['d', 'b']); // 3150.5 ও 315
    expect(searchTransactions(data, 'BDT 42,008').map((t) => t.id)).toEqual(['c']);
    expect(searchTransactions(data, '60').map((t) => t.id)).toEqual(['a']);
  });
  it('কিছু না মিললে খালি', () => {
    expect(searchTransactions(data, 'zzz')).toEqual([]);
  });
});

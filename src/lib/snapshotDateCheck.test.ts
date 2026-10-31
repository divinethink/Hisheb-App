import { describe, expect, it } from 'vitest';
import { checkSnapshotDate, expectedSnapshotDate, previousSnapshotDate } from './snapshotDateCheck';

const bal = [
  { yyyymm: '2026-09', snapshotDate: '2026-09-30' },
  { yyyymm: '2026-08', snapshotDate: '2026-08-31' },
];

describe('snapshotDateCheck', () => {
  it('previousSnapshotDate: আগের মাসগুলোর সবচেয়ে নতুন; না থাকলে null', () => {
    expect(previousSnapshotDate(bal, '2026-10')).toBe('2026-09-30');
    expect(previousSnapshotDate(bal, '2026-09')).toBe('2026-08-31');
    expect(previousSnapshotDate(bal, '2026-08')).toBeNull();
  });
  it('expectedSnapshotDate: চলতি মাসে আজ, অতীত মাসে মাসের শেষ দিন', () => {
    expect(expectedSnapshotDate('2026-10', '2026-10-31')).toBe('2026-10-31');
    expect(expectedSnapshotDate('2026-02', '2026-10-31')).toBe('2026-02-28');
  });
  it('আজকের তারিখ → ok', () => {
    expect(checkSnapshotDate('2026-10-31', '2026-10', '2026-10-31', bal)).toEqual({ kind: 'ok' });
  });
  it('অন্য তারিখ (আগের snapshot-এর পরে) → differs, daysOff ঋণাত্মক', () => {
    expect(checkSnapshotDate('2026-10-25', '2026-10', '2026-10-31', bal)).toEqual({ kind: 'differs', expected: '2026-10-31', daysOff: -6 });
  });
  it('আগের snapshot-তারিখের সমান বা আগে → invalid', () => {
    expect(checkSnapshotDate('2026-09-30', '2026-10', '2026-10-31', bal)).toEqual({ kind: 'invalid', previousDate: '2026-09-30' });
    expect(checkSnapshotDate('2026-09-15', '2026-10', '2026-10-31', bal)).toEqual({ kind: 'invalid', previousDate: '2026-09-30' });
  });
  it('অতীত মাস মাসের শেষ দিনে → ok; আগের কোনো snapshot না থাকলে invalid নয়', () => {
    expect(checkSnapshotDate('2026-09-30', '2026-09', '2026-10-31', bal)).toEqual({ kind: 'ok' });
    expect(checkSnapshotDate('2026-01-05', '2026-08', '2026-10-31', [])).toMatchObject({ kind: 'differs' });
  });
});

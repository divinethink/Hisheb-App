import { describe, expect, it } from 'vitest';
import { cycleStartOf, summarizeCycles } from './zakatCycle';

describe('cycleStartOf', () => {
  it('বার্ষিক তারিখের আগে/সেদিন/পরে', () => {
    expect(cycleStartOf('2026-03-14', '2025-03-15')).toBe('2025-03-15');
    expect(cycleStartOf('2026-03-15', '2025-03-15')).toBe('2026-03-15');
    expect(cycleStartOf('2026-11-23', '2025-03-15')).toBe('2026-03-15');
  });
  it('বার্ষিক তারিখ না থাকলে ১ জানুয়ারি', () => {
    expect(cycleStartOf('2026-11-23', null)).toBe('2026-01-01');
  });
  it('২৯ ফেব্রুয়ারি অ-লিপ বছরে ১ মার্চ', () => {
    expect(cycleStartOf('2026-02-28', '2024-02-29')).toBe('2025-03-01');
    expect(cycleStartOf('2026-03-01', '2024-02-29')).toBe('2026-03-01');
    expect(cycleStartOf('2028-02-29', '2024-02-29')).toBe('2028-02-29');
  });
});

describe('summarizeCycles', () => {
  const pay = (id: string, date: string, amountMinor: number, cycleStart?: string) => ({ id, date, amountMinor, cycleStart });
  it('ধাপে ধাপে দিলে বাকি কমে; লক না থাকলে চলতি বছরে লাইভ দেয়', () => {
    const [cur] = summarizeCycles([pay('a', '2026-04-01', 30000), pay('b', '2026-06-01', 20000)], [], '2026-03-15', '2026-11-23', 100000);
    expect(cur).toMatchObject({ start: '2026-03-15', isCurrent: true, dueMinor: 100000, paidMinor: 50000, remainingMinor: 50000, overMinor: 0 });
  });
  it('লক থাকলে লাইভ অঙ্ক নয়, লকটাই; বেশি দিলে over', () => {
    const [cur] = summarizeCycles([pay('a', '2026-04-01', 120000)], [{ id: '2026-03-15', dueMinor: 100000 }], '2026-03-15', '2026-11-23', 999999);
    expect(cur).toMatchObject({ dueMinor: 100000, remainingMinor: 0, overMinor: 20000 });
  });
  it('পুরনো বছরে লক না থাকলে due অজানা; চলতি বছর খালি থাকলেও তালিকায়', () => {
    const r = summarizeCycles([pay('a', '2025-04-01', 5000)], [], '2026-03-15', '2026-11-23', 0);
    expect(r.map((c) => c.start)).toEqual(['2026-03-15', '2025-03-15']);
    expect(r[0]).toMatchObject({ dueMinor: null, remainingMinor: null, paidMinor: 0 });
    expect(r[1]).toMatchObject({ dueMinor: null, remainingMinor: null, paidMinor: 5000 });
  });
  it('পেমেন্টে সেভ করা cycleStart-ই প্রাধান্য পায়', () => {
    const r = summarizeCycles([pay('a', '2026-04-01', 5000, '2025-03-15')], [], '2026-03-15', '2026-11-23', 0);
    expect(r.find((c) => c.start === '2025-03-15')?.paidMinor).toBe(5000);
  });
});

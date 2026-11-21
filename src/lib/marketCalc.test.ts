import { describe, expect, it } from 'vitest';
import { matchesQuery, nextOrder, perUnitMinor, priceRange, priceTrend, pushPrice, sortByOrder, swapTarget } from './marketCalc';

const e = (date: string, priceMinor: number, note = '', qty: number | null = null, unit = '') => ({ date, priceMinor, note, qty, unit });

describe('pushPrice', () => {
  it('puts newest first and keeps only 5', () => {
    let h = [] as ReturnType<typeof pushPrice>;
    for (let d = 1; d <= 7; d++) h = pushPrice(h, e(`2026-11-0${d}`, d * 100));
    expect(h).toHaveLength(5);
    expect(h[0].date).toBe('2026-11-07');
    expect(h[4].date).toBe('2026-11-03');
  });
  it('same date replaces instead of duplicating', () => {
    const h = pushPrice([e('2026-11-01', 100)], e('2026-11-01', 120, 'fix'));
    expect(h).toEqual([e('2026-11-01', 120, 'fix')]);
  });
  it('backdated entry lands in order', () => {
    const h = pushPrice([e('2026-11-10', 300), e('2026-11-01', 100)], e('2026-11-05', 200));
    expect(h.map((x) => x.date)).toEqual(['2026-11-10', '2026-11-05', '2026-11-01']);
  });
});

describe('priceTrend / priceRange', () => {
  it('null with fewer than two prices', () => {
    expect(priceTrend([])).toBeNull();
    expect(priceTrend([e('2026-11-01', 100)])).toBeNull();
    expect(priceRange([e('2026-11-01', 100)])).toBeNull();
  });
  it('diff and percent vs previous', () => {
    expect(priceTrend([e('2026-11-02', 11000), e('2026-11-01', 10000)])).toEqual({ diffMinor: 1000, pct: 10 });
    expect(priceTrend([e('2026-11-02', 9000), e('2026-11-01', 10000)])).toEqual({ diffMinor: -1000, pct: -10 });
  });
  it('low and high', () => {
    expect(priceRange([e('3', 300), e('2', 100), e('1', 200)])).toEqual({ lowMinor: 100, highMinor: 300 });
  });
});

describe('quantity-aware compare', () => {
  it('perUnit divides by quantity', () => {
    expect(perUnitMinor(e('1', 25000, '', 0.5, 'কেজি'))).toBe(50000);
    expect(perUnitMinor(e('1', 25000))).toBe(25000);
  });
  it('trend uses per-unit price when units match', () => {
    const t = priceTrend([e('2', 30000, '', 0.5, 'কেজি'), e('1', 50000, '', 1, 'কেজি')]);
    expect(t).toEqual({ diffMinor: 10000, pct: 20 });
  });
  it('no trend or range across different units', () => {
    expect(priceTrend([e('2', 100, '', 500, 'গ্রাম'), e('1', 200, '', 1, 'কেজি')])).toBeNull();
    expect(priceRange([e('2', 100, '', 500, 'গ্রাম'), e('1', 200, '', 1, 'কেজি')])).toBeNull();
  });
});

describe('order helpers', () => {
  const list = [
    { id: 'b', order: 200, name: 'B' },
    { id: 'a', order: 100, name: 'A' },
  ];
  it('sorts and swaps neighbours', () => {
    const s = sortByOrder(list);
    expect(s.map((x) => x.id)).toEqual(['a', 'b']);
    expect(swapTarget(s, 'a', 1)?.map((x) => x.id)).toEqual(['a', 'b']);
    expect(swapTarget(s, 'a', -1)).toBeNull();
    expect(swapTarget(s, 'b', 1)).toBeNull();
  });
  it('nextOrder goes after the last', () => {
    expect(nextOrder([])).toBe(100);
    expect(nextOrder(list)).toBe(300);
  });
});

describe('matchesQuery', () => {
  it('matches name or note, empty matches all', () => {
    expect(matchesQuery('রুই মাছ', '', '')).toBe(true);
    expect(matchesQuery('Rui', 'fresh', 'FRE')).toBe(true);
    expect(matchesQuery('Rui', '', 'x')).toBe(false);
  });
});

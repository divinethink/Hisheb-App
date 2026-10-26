import { describe, expect, it } from 'vitest';
import { monthSpendStats } from './budgetPace';

describe('monthSpendStats', () => {
  it('current month: avg, forecast, safe/day and days left', () => {
    // অক্টোবর (৩১ দিন), আজ ২০ তারিখ, ব্যয় ২২,০০০, বাজেট ৩৫,০০০ (পয়সায় ×১০০)
    const s = monthSpendStats(2_200_000, 3_500_000, '2026-10', '2026-10-20');
    expect(s.elapsedDays).toBe(20);
    expect(s.daysLeft).toBe(11);
    expect(s.avgPerDayMinor).toBe(110_000);
    expect(s.forecastMinor).toBe(3_410_000);
    expect(s.safePerDayMinor).toBe(118_200);
  });

  it('over budget: no safe/day, forecast still shown', () => {
    const s = monthSpendStats(5_862_600, 3_500_000, '2026-10', '2026-10-27');
    expect(s.safePerDayMinor).toBeNull();
    expect(s.daysLeft).toBe(4);
    expect(s.forecastMinor).toBe(6_731_100);
  });

  it('last day of month: no safe/day (daysLeft=0)', () => {
    const s = monthSpendStats(1_000_000, 3_500_000, '2026-10', '2026-10-31');
    expect(s.daysLeft).toBe(0);
    expect(s.safePerDayMinor).toBeNull();
  });

  it('past month: avg over full month, no forecast/safe', () => {
    const s = monthSpendStats(3_000_000, 3_500_000, '2026-09', '2026-10-20');
    expect(s.avgPerDayMinor).toBe(100_000);
    expect(s.forecastMinor).toBeNull();
    expect(s.safePerDayMinor).toBeNull();
    expect(s.daysLeft).toBe(0);
  });

  it('future month: zeros, no forecast', () => {
    const s = monthSpendStats(0, 3_500_000, '2026-11', '2026-10-20');
    expect(s.elapsedDays).toBe(0);
    expect(s.avgPerDayMinor).toBe(0);
    expect(s.forecastMinor).toBeNull();
  });
});

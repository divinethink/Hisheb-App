import { describe, it, expect } from 'vitest';
import { daysToAnniversary } from './zakatDate';

describe('daysToAnniversary', () => {
  it('আজই হলে ০', () => {
    expect(daysToAnniversary('2025-03-15', '2026-03-15')).toBe(0);
  });
  it('এ বছরের তারিখ বাকি থাকলে সেটাই', () => {
    expect(daysToAnniversary('2025-12-31', '2026-11-30')).toBe(31);
  });
  it('পেরিয়ে গেলে পরের বছরের', () => {
    expect(daysToAnniversary('2025-01-01', '2026-11-30')).toBe(32);
  });
  it('২৯ ফেব্রুয়ারি অ-লিপ বছরে ১ মার্চ', () => {
    expect(daysToAnniversary('2024-02-29', '2026-02-28')).toBe(1);
  });
});

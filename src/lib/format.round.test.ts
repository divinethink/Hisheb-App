import { describe, it, expect } from 'vitest';
import { formatNetTakaWhole, formatTakaWhole, roundWhole } from './format';

describe('পূর্ণ-টাকা ফরম্যাট', () => {
  it('পয়সা গোল হয়', () => {
    expect(roundWhole(177146)).toBe(177100);
    expect(roundWhole(177150)).toBe(177200);
    expect(roundWhole(-177146)).toBe(-177100);
    expect(formatTakaWhole(177146)).toBe('৳1,771');
    expect(formatNetTakaWhole(-552474)).toBe('−৳5,525');
    expect(formatTakaWhole(0)).toBe('৳0');
  });
});

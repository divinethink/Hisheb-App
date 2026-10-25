// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hashPin, isValidPin, newSaltB64, safeEqual } from './passcode';

describe('passcode helpers', () => {
  it('শুধু ৪ অঙ্কই বৈধ PIN', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });
  it('একই PIN+salt → একই hash; ভিন্ন salt বা PIN → ভিন্ন hash; hash-এ PIN নেই', async () => {
    const salt = newSaltB64();
    const h1 = await hashPin('1234', salt, 1000);
    expect(await hashPin('1234', salt, 1000)).toBe(h1);
    expect(await hashPin('1235', salt, 1000)).not.toBe(h1);
    expect(await hashPin('1234', newSaltB64(), 1000)).not.toBe(h1);
    expect(h1).not.toContain('1234');
  });
  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});

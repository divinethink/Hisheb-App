// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('crypto', webcrypto);

async function fresh() {
  vi.resetModules();
  return import('./appLock');
}

describe('appLock store', () => {
  beforeEach(() => localStorage.clear());

  it('PIN সেট → hash সংরক্ষিত (plain নয়), ঠিক PIN-এ ok, ভুলে wrong', async () => {
    const a = await fresh();
    expect(a.hasPasscode()).toBe(false);
    await a.setPasscode('1234');
    expect(a.hasPasscode()).toBe(true);
    expect(localStorage.getItem('hn.applock.v1')).not.toContain('1234');
    expect(await a.tryPasscode('1234')).toBe('ok');
    expect(await a.tryPasscode('0000')).toBe('wrong');
  });

  it('কোল্ড-স্টার্টে PIN থাকলে লক; ঠিক PIN-এ unlock', async () => {
    const a = await fresh();
    await a.setPasscode('4321');
    const b = await fresh(); // নতুন সেশন
    expect(b.isLocked()).toBe(true);
    expect(await b.unlock('0000')).toBe('wrong');
    expect(b.isLocked()).toBe(true);
    expect(await b.unlock('4321')).toBe('ok');
    expect(b.isLocked()).toBe(false);
    b.lockNow();
    expect(b.isLocked()).toBe(true);
  });

  it('৫ বার ভুলের পর অপেক্ষা (locked), সময় পেরোলে আবার চেষ্টা চলে', async () => {
    const a = await fresh();
    await a.setPasscode('1111');
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(await a.tryPasscode('0000', t0)).toBe('wrong');
    expect(await a.tryPasscode('1111', t0 + 1000)).toBe('locked'); // ঠিক PIN-ও এখন আটকানো
    expect(a.lockoutRemainingMs(t0 + 1000)).toBeGreaterThan(0);
    expect(await a.tryPasscode('1111', t0 + 31_000)).toBe('ok');
    expect(a.lockoutRemainingMs(t0 + 31_000)).toBe(0);
  });

  it('PIN বন্ধ করলে আর লক নেই', async () => {
    const a = await fresh();
    await a.setPasscode('1234');
    a.lockNow();
    a.clearPasscode();
    expect(a.hasPasscode()).toBe(false);
    expect(a.isLocked()).toBe(false);
  });
});

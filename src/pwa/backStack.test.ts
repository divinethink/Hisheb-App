// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetBackStackForTests, pushBackHandler } from './backStack';

const tick = () => new Promise((r) => setTimeout(r, 25));

describe('backStack (ফোনের ব্যাক বাটন)', () => {
  beforeEach(() => {
    __resetBackStackForTests();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => __resetBackStackForTests());

  it('ব্যাক চাপলে ওপরের handler-ই বন্ধ হয়, নিচেরটা না', async () => {
    const closeScreen = vi.fn();
    const closeSheet = vi.fn();
    pushBackHandler(closeScreen);
    pushBackHandler(closeSheet);
    await tick();
    window.history.back();
    await tick();
    expect(closeSheet).toHaveBeenCalledTimes(1);
    expect(closeScreen).not.toHaveBeenCalled();
  });

  it('handler বন্ধ না করলেও (unsaved confirm) পরের ব্যাকেও আবার ডাকা হয় — আটকে যায় না', async () => {
    const close = vi.fn();
    pushBackHandler(close);
    await tick();
    window.history.back();
    await tick();
    window.history.back();
    await tick();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('UI থেকে বন্ধ (cleanup) হলে close ডাকা হয় না, আর history আগের অবস্থায় ফেরে', async () => {
    const before = window.history.length;
    const close = vi.fn();
    const off = pushBackHandler(close);
    await tick();
    expect(window.history.length).toBe(before + 1);
    off();
    await tick();
    expect(close).not.toHaveBeenCalled();
    // এখন ব্যাক চাপলে (কিছু খোলা নেই) আমাদের handler চলে না
    window.history.back();
    await tick();
    expect(close).not.toHaveBeenCalled();
  });

  it('একই tick-এ screen→child-screen বদলালে অতিরিক্ত history entry জমে না', async () => {
    const offA = pushBackHandler(() => {});
    await tick();
    const lenA = window.history.length;
    offA();
    const closeB = vi.fn();
    pushBackHandler(closeB);
    await tick();
    expect(window.history.length).toBe(lenA);
    window.history.back();
    await tick();
    expect(closeB).toHaveBeenCalledTimes(1);
  });
});

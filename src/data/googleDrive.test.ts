// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { loadGoogleIdentity } from './googleDrive';

afterEach(() => {
  delete (window as { google?: unknown }).google;
  document.head.querySelectorAll('script[src*="gsi/client"]').forEach((s) => s.remove());
});

describe('loadGoogleIdentity', () => {
  it('স্ক্রিপ্ট আগে থেকেই থাকলে সাথে সাথে resolve, নতুন tag নয়', async () => {
    (window as { google?: unknown }).google = { accounts: { oauth2: {} } };
    await expect(loadGoogleIdentity()).resolves.toBeUndefined();
    expect(document.head.querySelectorAll('script[src*="gsi/client"]').length).toBe(0);
  });

  it('লোড ব্যর্থ হলে reject, আর পরে আবার চেষ্টা করা যায় (একটাই tag একবারে)', async () => {
    const p1 = loadGoogleIdentity();
    const tag = document.head.querySelector('script[src*="gsi/client"]') as HTMLScriptElement;
    expect(tag).toBeTruthy();
    expect(loadGoogleIdentity()).toBe(p1); // একই promise, ডুপ্লিকেট tag নেই
    tag.dispatchEvent(new Event('error'));
    await expect(p1).rejects.toThrow('gis-load-failed');
    void loadGoogleIdentity().catch(() => {});
    expect(document.head.querySelectorAll('script[src*="gsi/client"]').length).toBe(1);
  });
});

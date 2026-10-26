import { describe, expect, it } from 'vitest';
import { THEMES, findTheme, normalizeAccent, resolveMode } from './theme';

describe('theme', () => {
  it('system OS-সেটিং অনুসরণ করে, explicit মোড অগ্রাধিকার পায়', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('light', true)).toBe('light');
    expect(resolveMode('dark', false)).toBe('dark');
    expect(resolveMode('sepia', true)).toBe('sepia'); // sepia স্থির — OS dark হলেও বদলায় না
    expect(resolveMode('sepia', false)).toBe('sepia');
  });
  it('অজানা accent → blue', () => {
    expect(normalizeAccent('teal')).toBe('teal');
    expect(normalizeAccent('pink')).toBe('blue');
    expect(normalizeAccent(null)).toBe('blue');
  });
  it('পূর্ণ থিম-id চেনা যায়, tone আছে, পাঁচ থিম', () => {
    expect(THEMES).toHaveLength(5);
    expect(normalizeAccent('bull')).toBe('bull');
    expect(findTheme('bull')?.tone).toBe('dark');
    expect(findTheme('gold')).toBeNull(); // বাদ-দেওয়া থিম → সাধারণ accent-fallback
    expect(findTheme('treasury')?.tone).toBe('light');
    expect(findTheme('blue')).toBeNull();
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(5);
  });
});

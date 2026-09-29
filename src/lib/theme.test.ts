import { describe, expect, it } from 'vitest';
import { normalizeAccent, resolveMode } from './theme';

describe('theme', () => {
  it('system OS-সেটিং অনুসরণ করে, explicit মোড অগ্রাধিকার পায়', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('light', true)).toBe('light');
    expect(resolveMode('dark', false)).toBe('dark');
  });
  it('অজানা accent → blue', () => {
    expect(normalizeAccent('teal')).toBe('teal');
    expect(normalizeAccent('pink')).toBe('blue');
    expect(normalizeAccent(null)).toBe('blue');
  });
});

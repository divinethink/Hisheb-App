import { describe, expect, it } from 'vitest';
import { isOverdue } from './date';

describe('isOverdue', () => {
  it('আজকের আগের তারিখ = overdue; আজ/ভবিষ্যৎ/খালি = নয়', () => {
    expect(isOverdue('2026-10-24', '2026-10-25')).toBe(true);
    expect(isOverdue('2026-10-25', '2026-10-25')).toBe(false);
    expect(isOverdue('2026-10-26', '2026-10-25')).toBe(false);
    expect(isOverdue(null, '2026-10-25')).toBe(false);
    expect(isOverdue(undefined, '2026-10-25')).toBe(false);
  });
});

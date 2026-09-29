import { describe, it, expect } from 'vitest';
import { SettingsSchema } from './settingsSchema';
import { CategorySchema, NameSchema } from './catalogSchemas';
import { TransactionInputSchema } from './transactionSchema';

describe('SettingsSchema', () => {
  it('empty doc parses with safe defaults (features off)', () => {
    const s = SettingsSchema.parse({});
    expect(s.overallMonthlyBudgetMinor).toBeNull();
    expect(s.largeAmountWarningThresholdMinor).toBeNull();
    expect(s.lastBudgetThresholdShownLevel).toBeNull();
    expect(s.displayMode).toBe('system');
    expect(s.appLockEnabled).toBe(false);
  });
  it('rejects non-positive budget', () => {
    expect(SettingsSchema.safeParse({ overallMonthlyBudgetMinor: 0 }).success).toBe(false);
  });
});

describe('catalog schemas', () => {
  it('category defaults', () => {
    const c = CategorySchema.parse({ id: 'x', name: 'Groceries' });
    expect(c).toMatchObject({ archived: false, icon: null, type: null, order: 0 });
  });
  it('NameSchema trims and rejects blank', () => {
    expect(NameSchema.parse('  Fruits ')).toBe('Fruits');
    expect(NameSchema.safeParse('   ').success).toBe(false);
  });
});

describe('TransactionInputSchema', () => {
  const ok = {
    date: '2026-09-22', type: 'expense', amountMinor: 100, categoryId: 'c', categoryName: 'C', occurredAt: new Date(),
  };
  it('accepts valid, rejects ≤0 / non-int', () => {
    expect(TransactionInputSchema.safeParse(ok).success).toBe(true);
    expect(TransactionInputSchema.safeParse({ ...ok, amountMinor: 0 }).success).toBe(false);
    expect(TransactionInputSchema.safeParse({ ...ok, amountMinor: -1 }).success).toBe(false);
    expect(TransactionInputSchema.safeParse({ ...ok, amountMinor: 1.5 }).success).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { evaluateExpression, hasOperator } from './calculator';

describe('hasOperator', () => {
  it('detects any of the four operators', () => {
    expect(hasOperator('500')).toBe(false);
    expect(hasOperator('500+120')).toBe(true);
    expect(hasOperator('500−120')).toBe(true);
    expect(hasOperator('500×2')).toBe(true);
    expect(hasOperator('500÷2')).toBe(true);
  });
});

describe('evaluateExpression', () => {
  it('adds and subtracts left-to-right', () => {
    expect(evaluateExpression('500+120')).toBe('620');
    expect(evaluateExpression('500−120')).toBe('380');
    expect(evaluateExpression('500+120−20')).toBe('600');
  });

  it('applies × and ÷ before + and − (standard precedence)', () => {
    expect(evaluateExpression('500+120×2')).toBe('740');
    expect(evaluateExpression('1000÷4+10')).toBe('260');
  });

  it('handles decimals up to 2 places', () => {
    expect(evaluateExpression('10.5+2.25')).toBe('12.75');
  });

  it('returns null for a dangling/incomplete expression', () => {
    expect(evaluateExpression('500+')).toBeNull();
    expect(evaluateExpression('+500')).toBeNull();
    expect(evaluateExpression('500++120')).toBeNull();
  });

  it('returns null for divide-by-zero', () => {
    expect(evaluateExpression('500÷0')).toBeNull();
  });

  it('returns null when the final result is zero or negative (R1: amount must stay positive)', () => {
    expect(evaluateExpression('100−100')).toBeNull();
    expect(evaluateExpression('100−200')).toBeNull();
  });

  it('passes a plain single number through unchanged (normalized)', () => {
    expect(evaluateExpression('500')).toBe('500');
  });
});

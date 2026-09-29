import { describe, it, expect } from 'vitest';
import { isAllowedUser } from './access';

describe('isAllowedUser', () => {
  const owner = 'Owner@Example.com';
  it('allows verified owner email (case-insensitive)', () => {
    expect(isAllowedUser({ email: 'owner@example.com', emailVerified: true }, owner)).toBe(true);
  });
  it('blocks other email', () => {
    expect(isAllowedUser({ email: 'a@b.com', emailVerified: true }, owner)).toBe(false);
  });
  it('blocks unverified / missing email', () => {
    expect(isAllowedUser({ email: 'owner@example.com', emailVerified: false }, owner)).toBe(false);
    expect(isAllowedUser({ email: null, emailVerified: true }, owner)).toBe(false);
  });
});

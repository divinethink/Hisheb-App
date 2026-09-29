import { describe, it, expect } from 'vitest';
import { checkEnv, REQUIRED_ENV } from './env';

const full = Object.fromEntries(REQUIRED_ENV.map((k) => [k, 'x']));

describe('checkEnv', () => {
  it('ok when all required present', () => {
    expect(checkEnv(full)).toEqual({ ok: true });
  });
  it('lists missing and blank keys', () => {
    const r = checkEnv({ ...full, VITE_FIREBASE_API_KEY: '  ', VITE_OWNER_EMAIL: undefined });
    expect(r).toEqual({ ok: false, missing: ['VITE_FIREBASE_API_KEY', 'VITE_OWNER_EMAIL'] });
  });
  it('optional keys are not required', () => {
    expect(checkEnv(full).ok).toBe(true);
  });
});

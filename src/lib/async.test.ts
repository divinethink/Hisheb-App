import { describe, it, expect } from 'vitest';
import { settleOrPending } from './async';

describe('settleOrPending', () => {
  it('done when resolves in time', async () => {
    expect(await settleOrPending(Promise.resolve(1), 50)).toBe('done');
  });
  it('pending when slow', async () => {
    expect(await settleOrPending(new Promise(() => {}), 10)).toBe('pending');
  });
  it('propagates rejection', async () => {
    await expect(settleOrPending(Promise.reject(new Error('x')), 50)).rejects.toThrow('x');
  });
});

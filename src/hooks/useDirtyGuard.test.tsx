// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDirtyGuard } from './useDirtyGuard';
import { hasDirtyForms } from '../pwa/dirtyForms';

describe('useDirtyGuard', () => {
  it('mount-এ dirty, unmount-এ clean', () => {
    expect(hasDirtyForms()).toBe(false);
    const { unmount } = renderHook(() => useDirtyGuard());
    expect(hasDirtyForms()).toBe(true);
    unmount();
    expect(hasDirtyForms()).toBe(false);
  });
  it('active=false হলে কিছু করে না', () => {
    const { unmount } = renderHook(() => useDirtyGuard(false));
    expect(hasDirtyForms()).toBe(false);
    unmount();
  });
});

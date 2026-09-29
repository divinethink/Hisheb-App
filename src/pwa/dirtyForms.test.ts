import { describe, it, expect } from 'vitest';
import { hasDirtyForms, markClean, markDirty } from './dirtyForms';

describe('dirtyForms', () => {
  it('tracks dirty state and never goes negative', () => {
    expect(hasDirtyForms()).toBe(false);
    markDirty();
    expect(hasDirtyForms()).toBe(true);
    markClean();
    markClean();
    expect(hasDirtyForms()).toBe(false);
  });
});

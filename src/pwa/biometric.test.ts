// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { biometricSupported, disableBiometric, enableBiometric, hasBiometric, verifyBiometric } from './biometric';

vi.stubGlobal('crypto', webcrypto);

const setCreds = (impl: Partial<CredentialsContainer>) => Object.defineProperty(navigator, 'credentials', { value: impl, configurable: true });

describe('biometric (WebAuthn platform authenticator)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.stubGlobal('crypto', webcrypto);
  });

  it('enable সফল হলে credential id সংরক্ষিত; disable-এ মোছে', async () => {
    setCreds({ create: vi.fn().mockResolvedValue({ rawId: new Uint8Array([1, 2, 3]).buffer }) });
    expect(hasBiometric()).toBe(false);
    expect(await enableBiometric()).toBe(true);
    expect(hasBiometric()).toBe(true);
    disableBiometric();
    expect(hasBiometric()).toBe(false);
  });

  it('enable বাতিল/ব্যর্থ হলে false, কিছু সংরক্ষিত হয় না', async () => {
    setCreds({ create: vi.fn().mockRejectedValue(new Error('NotAllowedError')) });
    expect(await enableBiometric()).toBe(false);
    expect(hasBiometric()).toBe(false);
  });

  it('verify: সেট না থাকলে false; সফল হলে true; প্রম্পট বাতিল হলে false (তখন PIN)', async () => {
    expect(await verifyBiometric()).toBe(false);
    setCreds({ create: vi.fn().mockResolvedValue({ rawId: new Uint8Array([9]).buffer }), get: vi.fn().mockResolvedValue({ id: 'x' }) });
    await enableBiometric();
    expect(await verifyBiometric()).toBe(true);
    setCreds({ get: vi.fn().mockRejectedValue(new Error('NotAllowedError')) });
    expect(await verifyBiometric()).toBe(false);
  });

  it('অসমর্থিত ব্রাউজারে supported=false', async () => {
    expect(await biometricSupported()).toBe(false);
  });
});

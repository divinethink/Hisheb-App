// ডিভাইসের Fingerprint/Face আনলক (WebAuthn platform authenticator) — শুধু লোকাল "স্ক্রিন-লক" যাচাই।
// অ্যাপ বায়োমেট্রিক ডেটা দেখে/রাখে না; ফোন "যাচাই হয়েছে" বললে তবেই আনলক। PIN সবসময় বিকল্প।
// সার্ভার-সাইড signature-যাচাই নেই (লক ডিভাইস-লোকাল, অ্যাকাউন্ট-লগইন আলাদা)।
const KEY = 'hn.biometric.v1';

const toB64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u));
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));

export async function biometricSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function storedId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export const hasBiometric = (): boolean => storedId() !== null;

/** ফোনের বায়োমেট্রিক দিয়ে একটা লোকাল credential বানিয়ে সংরক্ষণ — সফল হলে true */
export async function enableBiometric(): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: 'হিসাব-নিকাশ', id: location.hostname },
        user: { id: rand(16), name: 'owner', displayName: 'Owner' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(KEY, toB64(new Uint8Array(cred.rawId)));
    return true;
  } catch {
    return false;
  }
}

/** বায়োমেট্রিক প্রম্পট — সফল হলে true; বাতিল/ব্যর্থ/অসমর্থিত হলে false (তখন PIN) */
export async function verifyBiometric(): Promise<boolean> {
  const id = storedId();
  if (!id) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: 'public-key', id: fromB64(id), transports: ['internal'] }],
        userVerification: 'required',
        rpId: location.hostname,
        timeout: 60_000,
      },
    });
    return res !== null;
  } catch {
    return false;
  }
}

export function disableBiometric(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

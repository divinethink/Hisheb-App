// Passcode (App Lock) — pure crypto helpers, UI/Storage-মুক্ত। PIN কখনো plain সংরক্ষণ হয় না: salt + PBKDF2-SHA256 hash।
// এটা "স্ক্রিন-লক" (পাশের কেউ/অন্যের হাতে ফোন গেলে) — ডেটা-encryption না।
export const PIN_LENGTH = 4;
export const PBKDF2_ITERATIONS = 150_000;

export const isValidPin = (pin: string): boolean => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

const toB64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u));
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function newSaltB64(): string {
  return toB64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin: string, saltB64: string, iterations: number = PBKDF2_ITERATIONS): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations }, key, 256);
  return toB64(new Uint8Array(bits));
}

/** সময়-নির্ভর না এমন তুলনা (দৈর্ঘ্য সমান ধরে) */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

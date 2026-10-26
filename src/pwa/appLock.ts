// App Lock স্টোর — শুধু এই ডিভাইসে (localStorage): PIN-এর salt+hash ও ভুল-চেষ্টার গণনা। PIN/ডেটা Firestore-এ যায় না।
// (localStorage-এ আর্থিক ডেটা না — Architecture Plan §৯ item ৩; এখানে শুধু একমুখী hash।)
import { disableBiometric, hasBiometric, verifyBiometric } from './biometric';
import { hashPin, isValidPin, newSaltB64, PBKDF2_ITERATIONS, safeEqual } from '../lib/passcode';

const KEY = 'hn.applock.v1';
const FAIL_KEY = 'hn.applock.fail.v1';
const FREE_TRIES = 5; // এর পরের প্রতিটা ভুলে অপেক্ষা
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

interface Stored {
  v: 1;
  salt: string;
  hash: string;
  iter: number;
}
interface Fail {
  count: number;
  until: number;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Stored>;
    return o.v === 1 && typeof o.salt === 'string' && typeof o.hash === 'string' && typeof o.iter === 'number' ? (o as Stored) : null;
  } catch {
    return null;
  }
}
function readFail(): Fail {
  try {
    const o = JSON.parse(localStorage.getItem(FAIL_KEY) ?? '{}') as Partial<Fail>;
    return { count: Number(o.count) || 0, until: Number(o.until) || 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}
function writeFail(f: Fail): void {
  try {
    if (f.count === 0) localStorage.removeItem(FAIL_KEY);
    else localStorage.setItem(FAIL_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

export function hasPasscode(): boolean {
  return readStored() !== null;
}

// ---- lock অবস্থা (in-memory, subscribe-যোগ্য) ----
let locked = hasPasscode(); // কোল্ড-স্টার্টে PIN থাকলে লক
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeLock(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const isLocked = (): boolean => locked && hasPasscode();

export function lockNow(): void {
  if (hasPasscode()) {
    locked = true;
    emit();
  }
}

export async function setPasscode(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error('Invalid passcode');
  const salt = newSaltB64();
  const hash = await hashPin(pin, salt, PBKDF2_ITERATIONS);
  const stored: Stored = { v: 1, salt, hash, iter: PBKDF2_ITERATIONS };
  localStorage.setItem(KEY, JSON.stringify(stored)); // ব্যর্থ হলে throw — UI জানাবে
  writeFail({ count: 0, until: 0 });
  locked = false;
  emit();
}

export function clearPasscode(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(FAIL_KEY);
  } catch {
    /* ignore */
  }
  disableBiometric(); // PIN ছাড়া বায়োমেট্রিক-আনলক থাকে না
  locked = false;
  emit();
}

export function lockoutRemainingMs(now: number = Date.now()): number {
  return Math.max(0, readFail().until - now);
}

export type TryResult = 'ok' | 'wrong' | 'locked';

/** PIN যাচাই + ভুল-চেষ্টার throttle (৫ বার ভুলের পর ৩০ সেকেন্ড, তারপর দ্বিগুণ — সর্বোচ্চ ১৫ মিনিট)। লক খোলে না। */
export async function tryPasscode(pin: string, now: number = Date.now()): Promise<TryResult> {
  const stored = readStored();
  if (!stored) return 'ok';
  if (lockoutRemainingMs(now) > 0) return 'locked';
  const hash = await hashPin(pin, stored.salt, stored.iter);
  if (safeEqual(hash, stored.hash)) {
    writeFail({ count: 0, until: 0 });
    return 'ok';
  }
  const count = readFail().count + 1;
  const over = count - FREE_TRIES;
  const until = over >= 0 ? now + Math.min(MAX_LOCKOUT_MS, BASE_LOCKOUT_MS * 2 ** Math.floor(over / FREE_TRIES)) : 0;
  writeFail({ count, until });
  return 'wrong';
}

/** লক-স্ক্রিন থেকে: ঠিক PIN হলে লক খোলে */
export async function unlock(pin: string, now: number = Date.now()): Promise<TryResult> {
  const r = await tryPasscode(pin, now);
  if (r === 'ok') {
    locked = false;
    emit();
  }
  return r;
}

/** লক-স্ক্রিন থেকে: বায়োমেট্রিক সেট থাকলে ফোনের যাচাই; সফল হলে লক খোলে (ব্যর্থ হলে PIN) */
export async function unlockWithBiometric(): Promise<boolean> {
  if (!hasPasscode() || !hasBiometric()) return false;
  const ok = await verifyBiometric();
  if (ok) {
    locked = false;
    emit();
  }
  return ok;
}

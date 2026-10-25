import { useEffect, useSyncExternalStore } from 'react';
import { hasPasscode, isLocked, lockNow, subscribeLock } from '../pwa/appLock';

export const useAppLocked = (): boolean => useSyncExternalStore(subscribeLock, isLocked);
export const useHasPasscode = (): boolean => useSyncExternalStore(subscribeLock, hasPasscode);

/** অ্যাপ ব্যাকগ্রাউন্ডে `graceMs` বা বেশি থাকলে ফিরে এসে লক (এর কম হলে — যেমন কল/নোটিফিকেশন দেখে ফেরা — লক না) */
export function useAutoLock(graceMs = 30_000): void {
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else {
        if (hiddenAt !== null && Date.now() - hiddenAt >= graceMs) lockNow();
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [graceMs]);
}

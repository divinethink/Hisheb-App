import { useEffect, useRef } from 'react';
import { pushBackHandler } from '../pwa/backStack';

/**
 * ফোনের ব্যাক বাটন চাপলে `onBack` ডাকে (সবচেয়ে ওপরের খোলা overlay-ই আগে) — অ্যাপ থেকে বেরোয় না।
 * `active=false` হলে রেজিস্টার হয় না (যেমন Home ট্যাবে ব্যাক = অ্যাপ বন্ধ, স্বাভাবিক)।
 * UI-র নিজস্ব Back/Cancel/Save-এ বন্ধ হলেও history নিজে সামলে নেয় (lib: pwa/backStack.ts)।
 */
export function useBackClose(onBack: () => void, active = true): void {
  const ref = useRef(onBack);
  useEffect(() => {
    ref.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    return pushBackHandler(() => ref.current());
  }, [active]);
}

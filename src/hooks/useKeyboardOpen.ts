import { useEffect, useState } from 'react';

const isTextField = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

// ফোনে কীবোর্ড খোলা থাকলে true (টেক্সট-ঘরে ফোকাস থাকা পর্যন্ত) — নেভ বার তখন লুকানো হয়।
// স্ক্রিন বন্ধ/অ্যাপ ব্যাকগ্রাউন্ডে গেলে ফোকাস ছেড়ে দেয়, যাতে ফিরে এলে নেভ আটকে না থাকে।
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => setOpen(isTextField(document.activeElement));
    const onFocusOut = () => setTimeout(sync, 0);
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      const el = document.activeElement as HTMLElement | null;
      if (isTextField(el)) el?.blur();
      setOpen(false);
    };
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return open;
}

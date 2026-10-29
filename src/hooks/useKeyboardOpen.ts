import { useEffect, useState } from 'react';

const isTextField = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

// আসল কীবোর্ড খোলা থাকলেই true: টেক্সট-ঘরে ফোকাস থাকা + দৃশ্যমান উচ্চতা স্ক্রিনের ~৭৫%-এর নিচে নেমে যাওয়া।
// শুধু ফোকাস থাকলে (কীবোর্ড ছাড়াই) নেভ বার আর লুকাবে না — আগে এটাই নেভ হারানোর কারণ ছিল।
function keyboardShown(): boolean {
  if (!isTextField(document.activeElement)) return false;
  const h = window.visualViewport?.height ?? window.innerHeight;
  const full = Math.max(window.screen.height, 1);
  return h < full * 0.75;
}

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => setOpen(keyboardShown());
    const onFocusOut = () => setTimeout(sync, 0);
    const reset = () => {
      const el = document.activeElement as HTMLElement | null;
      if (document.visibilityState === 'hidden' && isTextField(el)) el?.blur();
      sync();
    };
    const vv = window.visualViewport;
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', reset);
    window.addEventListener('pageshow', sync);
    window.addEventListener('resize', sync);
    vv?.addEventListener('resize', sync);
    return () => {
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', reset);
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('resize', sync);
      vv?.removeEventListener('resize', sync);
    };
  }, []);
  return open;
}

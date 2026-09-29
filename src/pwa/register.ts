import { registerSW } from 'virtual:pwa-register';
import { hasDirtyForms } from './dirtyForms';

// নতুন ভার্সন এলে: কোনো ফর্ম আন-সেভড থাকলে reload স্কিপ (ডেটা হারানো এড়াতে),
// পরের চেকে আবার চেষ্টা হবে। ইউজার-ফেসিং "Update available" UI P6-তে।
export function registerPwa(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (hasDirtyForms()) return;
      void updateSW(true);
    },
  });
}

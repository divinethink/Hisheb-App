import { useEffect } from 'react';
import { markClean, markDirty } from '../pwa/dirtyForms';

/**
 * কম্পোনেন্ট mount থাকাকালীন "কাজ চলছে/ফর্ম খোলা" ধরা — এই সময় PWA-আপডেটের auto-reload
 * ও pull-to-refresh স্কিপ হয় (pwa/dirtyForms.ts)। শিট/স্ক্রিন বন্ধ (unmount) হলে নিজে ছেড়ে দেয়।
 * কেন mount-ভিত্তিক: প্রতিটা ফর্মের আলাদা "dirty" হিসাব না করেও আধা-লেখা ফর্ম ও চলমান
 * Restore/Import/Delete reload থেকে বাঁচে। বাড়তি ঝুঁকি নেই — শুধু আপডেট পরের বার খোলা পর্যন্ত পেছায়।
 */
export function useDirtyGuard(active = true): void {
  useEffect(() => {
    if (!active) return;
    markDirty();
    return () => markClean();
  }, [active]);
}

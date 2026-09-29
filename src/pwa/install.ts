// PWA install prompt (Chrome/Android `beforeinstallprompt`)। iOS Safari-তে এই ইভেন্ট নেই — সেখানে Share → Add to Home Screen।
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** main.tsx-এ একবার — ইভেন্ট React মাউন্টের আগে আসতে পারে, তাই আগেই ধরে রাখা */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    canInstall: deferred !== null,
    install: async () => {
      const ev = deferred;
      if (!ev) return;
      await ev.prompt();
      await ev.userChoice;
      deferred = null;
      notify();
    },
  };
}

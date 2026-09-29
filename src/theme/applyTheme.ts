// DOM-সাইড theme প্রয়োগ (lib/ না — DOM ধরে)। Accent ও Mode স্বতন্ত্র attribute (Architecture Plan §৬)।
// localStorage-এ শুধু non-critical UI-পছন্দ (mode+accent) cache — প্রথম paint-এর আগে ঠিক রঙ বসাতে (dark-user-এর light-flash এড়াতে)।
// আসল সোর্স Firestore `settings`; critical ডেটা কখনো localStorage-এ না (Architecture Plan §৯ item ৩)।
import { normalizeAccent, resolveMode, type DisplayMode } from '../lib/theme';

const CACHE_KEY = 'hn.theme.v1';
let current: { mode: DisplayMode; accent: string } = { mode: 'system', accent: 'blue' };
let mq: MediaQueryList | null = null;

function paint() {
  const root = document.documentElement;
  const dark = mq?.matches ?? false;
  root.dataset.mode = resolveMode(current.mode, dark);
  root.dataset.theme = normalizeAccent(current.accent);
  // browser chrome রং = canvas token (hard-coded hex না)
  const rgb = getComputedStyle(root).getPropertyValue('--color-canvas').trim().split(/\s+/);
  if (rgb.length === 3) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${rgb.join(',')})`);
  }
}

function onSystemChange() {
  if (current.mode === 'system') paint();
}

export function applyTheme(mode: DisplayMode, accent: string): void {
  if (!mq && typeof window.matchMedia === 'function') {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onSystemChange);
  }
  current = { mode, accent };
  paint();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
  } catch {
    /* private mode/quota — cache ঐচ্ছিক */
  }
}

/** boot-এ সিঙ্ক্রোনাস: cache থাকলে সেটা, নইলে system+blue */
export function initTheme(): void {
  let mode: DisplayMode = 'system';
  let accent = 'blue';
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { mode?: string; accent?: string };
      if (c.mode === 'light' || c.mode === 'dark' || c.mode === 'system') mode = c.mode;
      if (typeof c.accent === 'string') accent = c.accent;
    }
  } catch {
    /* ignore */
  }
  applyTheme(mode, accent);
}

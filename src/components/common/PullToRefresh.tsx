import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { hasDirtyForms } from '../../pwa/dirtyForms';

// আঙুল দিয়ে নিচে টানলে রিলোড (owner-request ২০২৬-১০-৩০)। কেন কাস্টম: index.css-এ পেজ-ওভারস্ক্রল বন্ধ
// (overscroll-behavior: none — নেভ বার স্থির রাখতে), তাই ব্রাউজারের নিজস্ব pull-to-refresh আর চলে না।
// শুধু তখনই চালু: স্ক্রল-করা অংশ একদম উপরে, কোনো fullscreen/sheet খোলা নেই, অনুভূমিক সোয়াইপ নয়,
// আর কোনো unsaved ফর্ম নেই (ডেটা হারানো এড়াতে)।
const THRESHOLD = 70;
const MAX_PULL = 110;

function canStart(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== root) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') return false; // ওভারলে/ফুল-স্ক্রিন পেজ/শিট
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollTop > 0) return false;
    el = el.parentElement;
  }
  return true;
}

export default function PullToRefresh({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [loading, setLoading] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const setP = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = t && e.touches.length === 1 && !hasDirtyForms() && canStart(e.target, root) ? { x: t.clientX, y: t.clientY } : null;
    };
    const onMove = (e: TouchEvent) => {
      const st = start.current;
      const t = e.touches[0];
      if (!st || !t) return;
      const dy = t.clientY - st.y;
      if (Math.abs(t.clientX - st.x) > Math.abs(dy) || dy <= 0) {
        if (dy <= 0 && pullRef.current > 0) setP(0);
        return;
      }
      setP(Math.min(MAX_PULL, dy * 0.5));
    };
    const onCancel = () => {
      start.current = null;
      setP(0);
    };
    const onEnd = () => {
      const was = pullRef.current;
      start.current = null;
      if (was >= THRESHOLD * 0.5 && !hasDirtyForms()) {
        setLoading(true);
        setP(THRESHOLD * 0.5);
        window.location.reload();
      } else {
        setP(0);
      }
    };
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onCancel);
    };
  }, []);

  const ready = pull >= THRESHOLD * 0.5;
  return (
    <div ref={rootRef} className="relative h-full">
      {(pull > 0 || loading) && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
          style={{ transform: `translateY(${pull - 36}px)` }}
        >
          <span className="flex size-9 items-center justify-center rounded-full border border-muted/20 bg-canvas text-primary shadow-md">
            <RefreshCw
              size={18}
              className={loading ? 'animate-spin' : ''}
              style={loading ? undefined : { transform: `rotate(${pull * 4}deg)`, opacity: ready ? 1 : 0.6 }}
            />
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

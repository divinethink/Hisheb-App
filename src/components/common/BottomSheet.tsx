import { useEffect, useRef, type ReactNode } from 'react';

// UI Mockup §৩.১ (owner-request, ২০২৬-০৯-২৬): sheet এখন পুরো viewport (100dvh) জুড়ে —
// Spendee-স্টাইল full-screen entry, আগের max-h-[90dvh] partial-sheet না। ভেতরে এখনও
// overflow-y-auto fallback আছে (দীর্ঘ ফর্মে), কিন্তু compact ফর্ম নিজের flex-1 অংশ দিয়ে
// অবশিষ্ট জায়গা fill করে নিতে পারে বলে সাধারণত scroll লাগে না। নিচে sticky footer।
// Nav-এর ওপরে (z-50) তাই কীবোর্ডে nav লুকায়।
export default function BottomSheet({
  title,
  onRequestClose,
  footer,
  children,
}: {
  title: string;
  onRequestClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  const closeRef = useRef(onRequestClose);
  useEffect(() => {
    closeRef.current = onRequestClose;
  });

  // শুধু mount-এ ফোকাস — নইলে প্রতি keystroke-এ input থেকে ফোকাস চুরি হতো
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onRequestClose}
        className="absolute inset-0 bg-fg/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex h-[100dvh] w-full max-w-lg flex-col rounded-t-2xl bg-canvas text-fg outline-none"
      >
        <div
          className="flex items-center justify-between px-4 pb-2 pt-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        <div
          className="flex gap-3 border-t border-muted/30 bg-canvas px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

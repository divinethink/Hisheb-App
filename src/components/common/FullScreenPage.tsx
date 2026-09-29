import { useEffect, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

// §৩.১: ৫+ ফিল্ডের ফর্ম bottom-sheet না, full-screen page। safe-area-inset হ্যান্ডলড।
export default function FullScreenPage({
  title,
  onBack,
  footer,
  children,
}: {
  title: string;
  onBack: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const backRef = { current: onBack };
  backRef.current = onBack;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') backRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-canvas text-fg"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <header className="flex min-h-14 items-center gap-2 border-b border-muted/20 px-2">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ArrowLeft aria-hidden size={20} />
        </button>
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && <div className="flex gap-3 border-t border-muted/20 px-4 py-3">{footer}</div>}
    </div>
  );
}

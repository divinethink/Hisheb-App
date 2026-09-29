import { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';

// UI Mockup §৩: সাবটল, উপরে, dismissible। Firestore offline persistence থাকায় লেখা ফিরলে sync হয়।
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const up = () => {
      setOnline(true);
      setDismissed(false);
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online || dismissed) return null;
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 bg-surface px-4 text-sm text-fg">
      <WifiOff aria-hidden size={16} className="shrink-0 text-muted" />
      <p className="flex-1 py-2">You’re offline — changes will sync when the connection returns.</p>
      <button type="button" aria-label="Dismiss offline notice" onClick={() => setDismissed(true)} className="flex h-11 w-11 shrink-0 items-center justify-center text-muted">
        <X aria-hidden size={18} />
      </button>
    </div>
  );
}

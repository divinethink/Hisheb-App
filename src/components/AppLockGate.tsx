import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import PinPad from './common/PinPad';
import { useAuth } from '../auth/AuthProvider';
import { useAppLocked, useAutoLock } from '../hooks/useAppLock';
import { clearPasscode, lockoutRemainingMs, unlock } from '../pwa/appLock';

function LockScreen() {
  const { signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(() => Math.ceil(lockoutRemainingMs() / 1000));
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setWait(Math.ceil(lockoutRemainingMs() / 1000)), 1000);
    return () => clearInterval(id);
  }, [wait]);

  async function submit(pin: string) {
    const r = await unlock(pin);
    if (r === 'wrong') setError('Wrong passcode');
    if (r === 'locked' || r === 'wrong') setWait(Math.ceil(lockoutRemainingMs() / 1000));
    if (r === 'locked') setError(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-canvas px-6 text-fg"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <Lock aria-hidden size={28} className="mb-3 text-primary" />
      <PinPad
        title="Enter passcode"
        subtitle={wait > 0 ? `Too many attempts. Try again in ${wait}s.` : undefined}
        error={error}
        disabled={wait > 0}
        onComplete={(pin) => void submit(pin)}
      />
      {!confirmOut ? (
        <button type="button" onClick={() => setConfirmOut(true)} className="mt-6 min-h-11 text-sm text-muted underline">
          Forgot passcode?
        </button>
      ) : (
        <div className="mt-6 max-w-xs text-center text-sm text-muted">
          <p>Signing out removes the passcode from this device. Your data stays safe in your account.</p>
          <div className="mt-2 flex justify-center gap-3">
            <button type="button" onClick={() => setConfirmOut(false)} className="min-h-11 px-3 text-fg">Cancel</button>
            <button
              type="button"
              onClick={() => {
                clearPasscode();
                void signOut();
              }}
              className="min-h-11 px-3 font-medium text-expense"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** PIN সেট থাকলে অ্যাপ খোলা/ফেরার সময় লক-স্ক্রিন; নিচের কনটেন্ট mount থাকে (অসেভড ফর্ম হারায় না) কিন্তু ফোকাস/অ্যাক্সেসের বাইরে (inert)। */
export default function AppLockGate({ children }: { children: ReactNode }) {
  const locked = useAppLocked();
  useAutoLock();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.toggleAttribute('inert', locked);
  }, [locked]);
  return (
    <>
      <div ref={ref} className="h-full" aria-hidden={locked || undefined}>
        {children}
      </div>
      {locked && <LockScreen />}
    </>
  );
}

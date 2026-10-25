import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { PIN_LENGTH } from '../../lib/passcode';

/** ৪-অঙ্কের PIN কীপ্যাড (নিজস্ব — ফোনের কীবোর্ড খোলে না)। ৪টা অঙ্ক হলে onComplete(pin) ডেকে নিজেই ফাঁকা হয়। */
export default function PinPad({
  title,
  subtitle,
  error,
  disabled = false,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  disabled?: boolean;
  onComplete: (pin: string) => void;
}) {
  const [digits, setDigits] = useState('');
  const cb = useRef(onComplete);
  useEffect(() => {
    cb.current = onComplete;
  });

  // digits ref-এও রাখা: setState-updater-এর ভেতরে side-effect (onComplete) নয় — StrictMode-এ দুবার চলত
  const ref = useRef('');
  const set = (v: string) => {
    ref.current = v;
    setDigits(v);
  };
  const press = useCallback(
    (d: string) => {
      if (disabled || ref.current.length >= PIN_LENGTH) return;
      const next = ref.current + d;
      set(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => {
          cb.current(next);
          set('');
        }, 120);
      }
    },
    [disabled],
  );
  const back = useCallback(() => {
    if (ref.current.length < PIN_LENGTH) set(ref.current.slice(0, -1));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [press, back]);

  const key = 'flex h-16 items-center justify-center rounded-2xl bg-surface text-2xl font-medium text-fg active:bg-muted/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {subtitle && <p className="mt-1 text-center text-sm text-muted">{subtitle}</p>}
      <div className="my-6 flex gap-4" role="status" aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 border-primary ${i < digits.length ? 'bg-primary' : ''}`} />
        ))}
      </div>
      <p role="alert" className="mb-3 min-h-5 text-center text-sm text-expense">
        {digits.length === 0 ? error : ''}
      </p>
      <div className="grid w-full grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => press(d)} className={key}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" disabled={disabled} onClick={() => press('0')} className={key}>
          0
        </button>
        <button type="button" aria-label="Delete" disabled={disabled} onClick={back} className={key}>
          <Delete aria-hidden size={22} />
        </button>
      </div>
    </div>
  );
}

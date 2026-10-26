import { useEffect, useState } from 'react';
import { Lock, LockKeyhole, ShieldOff, KeyRound, Fingerprint } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import PinPad from '../../common/PinPad';
import Card from '../../common/Card';
import { useHasPasscode } from '../../../hooks/useAppLock';
import { biometricSupported, disableBiometric, enableBiometric, hasBiometric } from '../../../pwa/biometric';
import { clearPasscode, lockNow, lockoutRemainingMs, setPasscode, tryPasscode } from '../../../pwa/appLock';

type Step = { k: 'home' } | { k: 'verify'; then: 'change' | 'off' } | { k: 'new' } | { k: 'confirm'; first: string };

// Passcode সেট/বদল/বন্ধ। PIN শুধু এই ডিভাইসে hash হয়ে থাকে; অন্য ডিভাইসে আলাদা সেট করতে হয়।
export default function PasscodeScreen({ onClose }: { onClose: () => void }) {
  const has = useHasPasscode();
  const [step, setStep] = useState<Step>({ k: 'home' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioOn, setBioOn] = useState(() => hasBiometric());
  useEffect(() => {
    let alive = true;
    void biometricSupported().then((ok) => alive && setBioSupported(ok));
    return () => {
      alive = false;
    };
  }, []);

  async function toggleBio() {
    if (busy) return;
    setNotice(null);
    if (bioOn) {
      disableBiometric();
      setBioOn(false);
      return;
    }
    setBusy(true);
    try {
      const ok = await enableBiometric();
      setBioOn(ok);
      setNotice(ok ? 'Fingerprint unlock is on. Your passcode still works as a backup.' : 'Couldn’t set up fingerprint on this device. You can keep using the passcode.');
    } finally {
      setBusy(false);
    }
  }

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  async function onVerify(pin: string, then: 'change' | 'off') {
    if (busy) return;
    setBusy(true);
    try {
      const r = await tryPasscode(pin);
      if (r === 'ok') {
        if (then === 'off') {
          clearPasscode();
          setBioOn(false);
          setNotice('Passcode turned off.');
          go({ k: 'home' });
        } else {
          go({ k: 'new' });
        }
      } else if (r === 'locked') {
        setError(`Too many attempts. Try again in ${Math.ceil(lockoutRemainingMs() / 1000)}s.`);
      } else {
        setError('Wrong passcode');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(pin: string, first: string) {
    if (busy) return;
    if (pin !== first) {
      setError('Passcodes didn’t match. Try again.');
      setStep({ k: 'new' });
      return;
    }
    setBusy(true);
    try {
      await setPasscode(pin);
      setNotice('Passcode is on. The app locks when opened or after 30 seconds in the background.');
      go({ k: 'home' });
    } catch {
      setError('Couldn’t save the passcode on this device.');
      setStep({ k: 'new' });
    } finally {
      setBusy(false);
    }
  }

  const rowCls = 'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

  return (
    <FullScreenPage title="Passcode" onBack={step.k === 'home' ? onClose : () => go({ k: 'home' })}>
      {step.k === 'home' && (
        <>
          {notice && <p role="status" className="mb-3 rounded-xl bg-income/10 p-3 text-sm text-income">{notice}</p>}
          <p className="text-sm text-muted">
            Locks the app on this device with a 4-digit code, so no one else can see your balances if they pick up your phone.
            It’s a screen lock, not encryption, and each device has its own passcode.
          </p>
          <Card className="mt-4 overflow-hidden">
            {!has ? (
              <button type="button" className={rowCls} onClick={() => { setNotice(null); go({ k: 'new' }); }}>
                <Lock aria-hidden size={19} className="text-primary" />
                <span className="flex-1">Set passcode</span>
              </button>
            ) : (
              <>
                <button type="button" className={rowCls} onClick={() => lockNow()}>
                  <LockKeyhole aria-hidden size={19} className="text-primary" />
                  <span className="flex-1">Lock now</span>
                </button>
                <button type="button" role="switch" aria-checked={bioOn} disabled={busy || !bioSupported} className={`${rowCls} border-t border-muted/10 disabled:opacity-60`} onClick={() => void toggleBio()}>
                  <Fingerprint aria-hidden size={19} className="text-primary" />
                  <span className="flex-1">
                    Fingerprint / face unlock
                    {!bioSupported && <span className="block text-xs text-muted">Not available on this device or browser</span>}
                  </span>
                  <span aria-hidden className={`relative inline-block h-6 w-10 rounded-full ${bioOn ? 'bg-primary' : 'bg-muted/30'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas shadow transition-all ${bioOn ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                </button>
                <button type="button" className={`${rowCls} border-t border-muted/10`} onClick={() => { setNotice(null); go({ k: 'verify', then: 'change' }); }}>
                  <KeyRound aria-hidden size={19} className="text-muted" />
                  <span className="flex-1">Change passcode</span>
                </button>
                <button type="button" className={`${rowCls} border-t border-muted/10`} onClick={() => { setNotice(null); go({ k: 'verify', then: 'off' }); }}>
                  <ShieldOff aria-hidden size={19} className="text-expense" />
                  <span className="flex-1">Turn off passcode</span>
                </button>
              </>
            )}
          </Card>
          {!has && <p className="mt-3 text-xs text-muted">Fingerprint / face unlock appears here after you set a passcode.</p>}
        </>
      )}
      {step.k === 'verify' && (
        <div className="pt-6">
          <PinPad title="Enter current passcode" error={error} disabled={busy} onComplete={(p) => void onVerify(p, step.then)} />
        </div>
      )}
      {step.k === 'new' && (
        <div className="pt-6">
          <PinPad title="Choose a 4-digit passcode" error={error} disabled={busy} onComplete={(p) => go({ k: 'confirm', first: p })} />
        </div>
      )}
      {step.k === 'confirm' && (
        <div className="pt-6">
          <PinPad title="Re-enter to confirm" error={error} disabled={busy} onComplete={(p) => void onConfirm(p, step.first)} />
        </div>
      )}
    </FullScreenPage>
  );
}

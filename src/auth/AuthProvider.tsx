import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth, OWNER_EMAIL } from '../firebaseConfig';
import { isAllowedUser } from '../lib/access';

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string | null;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; error?: string }
  | { status: 'restricted' }
  | { status: 'signedIn'; user: SessionUser };

interface AuthApi {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

function errorMessage(code: string): string | undefined {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return undefined; // ইউজার নিজে বন্ধ করেছে — error না
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked. Allow popups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        // restricted অবস্থা sign-out-এর callback-এ মুছে ফেলা যাবে না
        setState((prev) => (prev.status === 'restricted' ? prev : { status: 'signedOut' }));
        return;
      }
      if (!isAllowedUser({ email: user.email, emailVerified: user.emailVerified }, OWNER_EMAIL)) {
        setState({ status: 'restricted' });
        void fbSignOut(auth);
        return;
      }
      setState({
        status: 'signedIn',
        user: { uid: user.uid, email: user.email!, displayName: user.displayName },
      });
    });
  }, []);

  // Popup সরাসরি click-handler থেকে ট্রিগার হয় — এখানে কোনো await আগে নেই
  const signIn = useCallback(async () => {
    setState({ status: 'signedOut' });
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setState({ status: 'signedOut', error: errorMessage(code) });
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

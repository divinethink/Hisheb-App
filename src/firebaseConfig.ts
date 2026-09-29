// Firebase modular v9+ SDK (compat নিষিদ্ধ)। এই ফাইল শুধু data/ ও auth/ ইমপোর্ট করবে।
// ক্রম গুরুত্বপূর্ণ: App Check আগে, তারপর Auth ও Firestore।
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { browserLocalPersistence, browserPopupRedirectResolver, initializeAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getEnv } from './config/env';

const env = getEnv();

export const app = initializeApp(env.firebase);

// Debug token: dev-এ অথবা env-এ দেওয়া থাকলে (Staging)। Production env-এ সেট করা যাবে না।
if (import.meta.env.DEV || env.appCheckDebugToken) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = env.appCheckDebugToken ?? true;
}
initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(env.appCheckSiteKey),
  isTokenAutoRefreshEnabled: true,
});

// initializeAuth: persistence আগেই বলা থাকে, তাই signInWithPopup সরাসরি click-handler থেকে কল করা যায়
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

// Offline persistence (IndexedDB) + মাল্টি-ট্যাব
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const OWNER_EMAIL = env.ownerEmail;

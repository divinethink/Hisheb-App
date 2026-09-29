// Config/secrets কোডে hardcode নয় — শুধু env থেকে (Dev Rule: Config Not Hardcoded)।
// Boot-এ fail-fast: কিছু মিসিং থাকলে অস্পষ্ট runtime error না দিয়ে স্পষ্ট তালিকা দেখানো হয়।

export const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_APPCHECK_SITE_KEY',
  'VITE_OWNER_EMAIL',
] as const;

type RawEnv = Record<string, string | undefined>;

export type EnvCheck = { ok: true } | { ok: false; missing: string[] };

export function checkEnv(env: RawEnv): EnvCheck {
  const missing = REQUIRED_ENV.filter((k) => !env[k]?.trim());
  return missing.length === 0 ? { ok: true } : { ok: false, missing: [...missing] };
}

export interface AppEnv {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    storageBucket?: string;
    messagingSenderId?: string;
  };
  appCheckSiteKey: string;
  appCheckDebugToken?: string;
  ownerEmail: string;
  /** ঐচ্ছিক — না থাকলে Google Drive backup বাটন নীরবে বন্ধ থাকে (P5)। */
  googleDriveClientId?: string;
}

function raw(): RawEnv {
  return import.meta.env as unknown as RawEnv;
}

/** checkEnv() ok হওয়ার পরেই কল করতে হবে। */
export function getEnv(): AppEnv {
  const e = raw();
  const check = checkEnv(e);
  if (!check.ok) throw new Error(`Missing env: ${check.missing.join(', ')}`);
  const v = (k: string) => e[k]!.trim();
  const opt = (k: string) => e[k]?.trim() || undefined;
  return {
    firebase: {
      apiKey: v('VITE_FIREBASE_API_KEY'),
      authDomain: v('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: v('VITE_FIREBASE_PROJECT_ID'),
      appId: v('VITE_FIREBASE_APP_ID'),
      storageBucket: opt('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: opt('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    },
    appCheckSiteKey: v('VITE_APPCHECK_SITE_KEY'),
    appCheckDebugToken: opt('VITE_APPCHECK_DEBUG_TOKEN'),
    ownerEmail: v('VITE_OWNER_EMAIL'),
    googleDriveClientId: opt('VITE_GOOGLE_DRIVE_CLIENT_ID'),
  };
}

export function checkCurrentEnv(): EnvCheck {
  return checkEnv(raw());
}

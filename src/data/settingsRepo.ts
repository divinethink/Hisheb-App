// settings/{doc} repo — single doc "main", defensive read (Architecture Plan §২.২)।
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SettingsSchema, type Settings } from '../validation/settingsSchema';

const settingsDoc = (uid: string) => doc(db, 'users', uid, 'settings', 'main');

export function subscribeSettings(uid: string, onChange: (s: Settings) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    settingsDoc(uid),
    (snap) => onChange(SettingsSchema.parse(snap.data() ?? {})),
    onError,
  );
}

/** Partial আপডেট — merge write, বাকি ফিল্ড অপরিবর্তিত থাকে। */
export async function updateSettings(uid: string, patch: Partial<Settings>): Promise<void> {
  await setDoc(settingsDoc(uid), patch, { merge: true });
}

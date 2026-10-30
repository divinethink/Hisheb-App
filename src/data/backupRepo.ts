// পুরো Firestore ডেটার হুবহু JSON ব্যাকআপ (Architecture Plan §৫) — data/ layer।
// ইচ্ছাকৃতভাবে প্রতিটা repo-র Zod parse বাইপাস করে raw doc.data() পড়া হয় —
// ব্যাকআপ round-trip-এ প্রতিটা ফিল্ড (এমনকি ভবিষ্যতে UI-অজানা ফিল্ডও) অবিকৃত
// থাকা দরকার (Zero Data Loss)। Restore = full replace, নিরাপদ ক্রমে: (১) সব doc আগে যাচাই
// (backupValidate — একটাও অবৈধ হলে কিছুই ছোঁয়া হয় না), (২) প্রতিটা collection-এ backup-doc set,
// (৩) তারপর backup-এ নেই এমন doc delete — মাঝপথে ব্যর্থ হলেও পুরনো ডেটা মোছা থাকে না।
// Chunked writeBatch (৪৫০/chunk, Architecture Plan §২.২ chunking-নিয়ম) — ৫০০-ডকুমেন্ট batch-লিমিট এড়াতে।
import { collection, doc, getDoc, getDocs, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { assertBackupValid } from './backupValidate';

export const BACKUP_SCHEMA_VERSION = 1;
const RESTORE_CHUNK = 450;

// Architecture Plan §২-এর সব সক্রিয় (activated) collection — নতুন কোনো
// collection activate হলে এই তালিকায় যোগ করতে হবে।
export const BACKUP_COLLECTIONS = [
  'transactions',
  'accounts',
  'accountBalances',
  'netWorthSnapshots',
  'debts',
  'investments',
  'investmentCompanies',
  'depositFunds',
  'homeDeposits',
  'customLedgers',
  'categories',
  'labels',
  'historicalYearlyTotals',
  'gpfEntries',
] as const;

export interface BackupPayload {
  schemaVersion: number;
  appVersion: string;
  backupTime: string; // ISO
  ownerEmail: string | null;
  collections: Record<string, Record<string, unknown>>;
  settings: Record<string, unknown> | null;
}

// Firestore Timestamp (duck-typed — data/ লেয়ার বলে firebase টাইপ-ইমপোর্ট এখানে
// অনুমোদিত) → JSON-নিরাপদ ISO-wrapper-এ রূপান্তর, যাতে JSON.stringify-এ ভেঙে না যায়।
function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === 'object') {
    const maybeTs = v as { toDate?: () => Date };
    if (typeof maybeTs.toDate === 'function') {
      return { __timestamp: maybeTs.toDate().toISOString() };
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = serializeValue(val);
    return out;
  }
  return v;
}

async function readCollectionRaw(uid: string, col: string): Promise<Record<string, unknown>> {
  const snap = await getDocs(collection(db, 'users', uid, col));
  const out: Record<string, unknown> = {};
  snap.docs.forEach((d) => {
    out[d.id] = serializeValue(d.data());
  });
  return out;
}

export async function readAllDataForBackup(uid: string): Promise<Record<string, Record<string, unknown>>> {
  const entries = await Promise.all(
    BACKUP_COLLECTIONS.map(async (col) => [col, await readCollectionRaw(uid, col)] as const),
  );
  return Object.fromEntries(entries);
}

export async function buildBackupPayload(uid: string, ownerEmail: string | null): Promise<BackupPayload> {
  const [collections, settingsSnap] = await Promise.all([
    readAllDataForBackup(uid),
    getDoc(doc(db, 'users', uid, 'settings', 'main')),
  ]);
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: '1.0.0',
    backupTime: new Date().toISOString(),
    ownerEmail,
    collections,
    settings: settingsSnap.exists() ? (serializeValue(settingsSnap.data()) as Record<string, unknown>) : null,
  };
}

// serializeValue-এর বিপরীত: `{ __timestamp: isoString }` wrapper ফিরিয়ে
// Firestore Timestamp বানায়, বাকি সব as-is।
function deserializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(deserializeValue);
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (typeof obj.__timestamp === 'string' && Object.keys(obj).length === 1) {
      return Timestamp.fromDate(new Date(obj.__timestamp));
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(obj)) out[k] = deserializeValue(val);
    return out;
  }
  return v;
}

/** ন্যূনতম shape-check — ফাইলটা আসলে এই অ্যাপের backup কিনা যাচাই। */
export function parseBackupPayload(raw: unknown): BackupPayload {
  const obj = raw as Partial<BackupPayload> | null;
  if (
    !obj ||
    typeof obj !== 'object' ||
    typeof obj.schemaVersion !== 'number' ||
    typeof obj.backupTime !== 'string' ||
    !obj.collections ||
    typeof obj.collections !== 'object'
  ) {
    throw new Error('Invalid backup file — this does not look like a হিসাব-নিকাশ backup.');
  }
  const payload = obj as BackupPayload;
  // ফাইল বাছাইয়ের সময়ই অবৈধ doc ধরা — restore শুরুর (এবং confirm-এর) আগে
  assertBackupValid(payload.collections, BACKUP_COLLECTIONS, payload.settings);
  return payload;
}

// backup-এ নেই এমন doc মোছে (লেখা শেষ হওয়ার পরে চলে)
async function deleteDocsNotIn(uid: string, col: string, keep: Set<string>): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, col));
  const ids = snap.docs.map((d) => d.id).filter((id) => !keep.has(id));
  for (let i = 0; i < ids.length; i += RESTORE_CHUNK) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + RESTORE_CHUNK)) batch.delete(doc(db, 'users', uid, col, id));
    await batch.commit();
  }
}

async function writeAllDocs(uid: string, col: string, docs: Record<string, unknown>): Promise<void> {
  const entries = Object.entries(docs);
  for (let i = 0; i < entries.length; i += RESTORE_CHUNK) {
    const batch = writeBatch(db);
    for (const [id, data] of entries.slice(i, i + RESTORE_CHUNK)) {
      batch.set(doc(db, 'users', uid, col, id), deserializeValue(data) as Record<string, unknown>);
    }
    await batch.commit();
  }
}

/**
 * Full-replace restore (Roadmap §৪.৮) — প্রতিটা active collection-এ আগে backup-এর doc
 * বসানো, তারপর backup-এ নেই এমন doc মোছা (শেষ অবস্থা আগের মতোই; ক্রমটা নিরাপদ)। কল করার আগে auto-backup + owner-confirmation
 * নেওয়া UI-র দায়িত্ব (BackupRestore.tsx)।
 */
export async function restoreFromBackup(
  uid: string,
  payload: BackupPayload,
  onProgress?: (label: string) => void,
): Promise<void> {
  // কিছু লেখা/মোছার আগে আবার যাচাই (parseBackupPayload ছাড়া সরাসরি কল হলেও নিরাপদ)
  assertBackupValid(payload.collections, BACKUP_COLLECTIONS, payload.settings);
  for (const col of BACKUP_COLLECTIONS) {
    // পুরনো ব্যাকআপে এই collection-এর key-ই নেই (পরে যোগ হওয়া) → বর্তমান ডেটা মোছা নয় (Zero Data Loss)
    if (!(col in payload.collections)) continue;
    onProgress?.(`Restoring ${col}…`);
    const docs = payload.collections[col] ?? {};
    if (Object.keys(docs).length > 0) await writeAllDocs(uid, col, docs);
    await deleteDocsNotIn(uid, col, new Set(Object.keys(docs)));
  }
  if (payload.settings) {
    onProgress?.('Restoring settings…');
    await setDoc(doc(db, 'users', uid, 'settings', 'main'), deserializeValue(payload.settings) as Record<string, unknown>);
  }
}

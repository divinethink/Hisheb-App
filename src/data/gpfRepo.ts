// gpfEntries repo — §২.২ প্যাটার্ন (homeDepositRepo-এর মতো: প্রতিটা entry আলাদা doc, hard delete)।
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GpfEntryInputSchema, GpfEntrySchema, type GpfEntry, type GpfEntryInput } from '../validation/gpfSchema';

const col = (uid: string) => collection(db, 'users', uid, 'gpfEntries');

export function subscribeGpfEntries(
  uid: string,
  onChange: (e: GpfEntry[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    col(uid),
    (snap) => {
      const out: GpfEntry[] = [];
      for (const d of snap.docs) {
        const r = GpfEntrySchema.safeParse({ ...d.data(), id: d.id });
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(r.data);
      }
      out.sort((a, b) => b.date.localeCompare(a.date));
      onChange(out);
    },
    onError,
  );
}

/** CSV import-এর idempotency — বিদ্যমান importKey-গুলোর সেট (one-shot)। */
export async function getGpfImportKeys(uid: string): Promise<Set<string>> {
  const snap = await getDocs(col(uid));
  const keys = new Set<string>();
  for (const d of snap.docs) {
    const r = GpfEntrySchema.safeParse({ ...d.data(), id: d.id });
    if (r.success && r.data.importKey) keys.add(r.data.importKey);
  }
  return keys;
}

export async function addGpfEntry(uid: string, input: GpfEntryInput): Promise<string> {
  const data = GpfEntryInputSchema.parse(input);
  const ref = await addDoc(col(uid), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateGpfEntry(
  uid: string,
  id: string,
  patch: Partial<Pick<GpfEntryInput, 'date' | 'amountMinor' | 'type' | 'note' | 'fiscalYear'>>,
): Promise<void> {
  await updateDoc(doc(col(uid), id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteGpfEntry(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(col(uid), id));
}

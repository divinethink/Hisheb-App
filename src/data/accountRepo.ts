// accounts repo — §২.২ প্যাটার্ন। Hard-delete নেই, archive দিয়ে hide (§৪.২)।
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AccountSchema, type Account, type AccountInput } from '../validation/accountSchema';

const accCol = (uid: string) => collection(db, 'users', uid, 'accounts');

/** archived বাদে, order → name — একটা খারাপ doc বাকি সব crash করবে না (§২.২ safeParse)। */
export function subscribeAccounts(
  uid: string,
  onChange: (a: Account[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    accCol(uid),
    (snap) => {
      const out: Account[] = [];
      for (const d of snap.docs) {
        const r = AccountSchema.safeParse({ ...d.data(), id: d.id });
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        if (!r.data.archived) out.push(r.data);
      }
      out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      onChange(out);
    },
    onError,
  );
}

export async function addAccount(uid: string, input: AccountInput): Promise<string> {
  const ref = await addDoc(accCol(uid), {
    ...input,
    order: Date.now(), // gap-based reorder পরে লাগলে; এখন শুধু শেষে যোগ
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAccount(
  uid: string,
  id: string,
  patch: Partial<Pick<AccountInput, 'name' | 'holder' | 'currency' | 'zakatable' | 'archived'>>,
): Promise<void> {
  await updateDoc(doc(accCol(uid), id), { ...patch, updatedAt: serverTimestamp() });
}

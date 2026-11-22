// medPurchases repo — §২.২ প্যাটার্ন। UI সরাসরি SDK ছোঁয় না।
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  MedPurchaseInputSchema,
  MedPurchaseSchema,
  type MedPurchase,
  type MedPurchaseInput,
} from '../validation/medPurchaseSchema';

const col = (uid: string) => collection(db, 'users', uid, 'medPurchases');

export function subscribeMedPurchases(
  uid: string,
  onChange: (p: MedPurchase[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  // ⚠️ এখানে .limit() নেই — মোট হিসাব truncate হলে ভুল হবে (Dev Rules §৭)
  return onSnapshot(
    col(uid),
    (snap) => {
      const out: MedPurchase[] = [];
      for (const d of snap.docs) {
        const r = MedPurchaseSchema.safeParse({ ...d.data(), id: d.id });
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(r.data);
      }
      onChange(out);
    },
    onError,
  );
}

/** ফর্ম খোলার সময়ই id তৈরি — retry/double-tap একই doc-এ লেখে, duplicate হয় না (idempotent)। */
export function newMedPurchaseId(uid: string): string {
  return doc(col(uid)).id;
}

export function addMedPurchase(uid: string, id: string, input: MedPurchaseInput): Promise<void> {
  const data = MedPurchaseInputSchema.parse(input);
  return setDoc(doc(col(uid), id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function updateMedPurchase(uid: string, id: string, input: MedPurchaseInput): Promise<void> {
  const data = MedPurchaseInputSchema.parse(input);
  return updateDoc(doc(col(uid), id), { ...data, updatedAt: serverTimestamp() });
}

export function deleteMedPurchase(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(col(uid), id));
}

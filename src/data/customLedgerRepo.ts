// customLedgers repo — §২.২ প্যাটার্ন। kind='deposit' হলে addFund() reuse করে background-এ
// একটা normal depositFunds doc auto-create করে (zero new engine)।
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { addFund } from './homeDepositRepo';
import { CustomLedgerSchema, type CustomLedger } from '../validation/customLedgerSchema';

const ledgerCol = (uid: string) => collection(db, 'users', uid, 'customLedgers');

export function subscribeCustomLedgers(
  uid: string,
  onChange: (l: CustomLedger[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    ledgerCol(uid),
    (snap) => {
      const out: CustomLedger[] = [];
      for (const d of snap.docs) {
        const r = CustomLedgerSchema.safeParse({ ...d.data(), id: d.id });
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

export async function addCustomLedger(
  uid: string,
  input: { name: string; kind: 'deposit' | 'investment' },
): Promise<string> {
  const fundId = input.kind === 'deposit' ? await addFund(uid, { name: input.name, currency: 'BDT', zakatable: true, archived: false }) : null;
  const ref = await addDoc(ledgerCol(uid), {
    name: input.name,
    kind: input.kind,
    fundId,
    archived: false,
    order: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function archiveCustomLedger(uid: string, id: string): Promise<void> {
  await updateDoc(doc(ledgerCol(uid), id), { archived: true, updatedAt: serverTimestamp() });
}

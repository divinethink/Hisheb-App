// depositFunds + homeDeposits repo — §২.২ প্যাটার্ন। Fund: accountRepo-এর মতো (archive দিয়ে hide)।
// homeDeposits: প্রতিটা entry আলাদা ডকুমেন্ট (repayments[]-এর মতো embedded array না) — add/update/delete সরাসরি।
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  FundSchema,
  HomeDepositEntrySchema,
  type Fund,
  type FundInput,
  type HomeDepositEntry,
  type HomeDepositEntryInput,
} from '../validation/homeDepositSchema';

const fundCol = (uid: string) => collection(db, 'users', uid, 'depositFunds');
const entryCol = (uid: string) => collection(db, 'users', uid, 'homeDeposits');

/** archived বাদে, order → name (accountRepo-এর হুবহু প্যাটার্ন)। */
export function subscribeFunds(
  uid: string,
  onChange: (f: Fund[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    fundCol(uid),
    (snap) => {
      const out: Fund[] = [];
      for (const d of snap.docs) {
        const r = FundSchema.safeParse({ ...d.data(), id: d.id });
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

export async function addFund(uid: string, input: FundInput): Promise<string> {
  const ref = await addDoc(fundCol(uid), {
    ...input,
    order: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateFund(
  uid: string,
  id: string,
  patch: Partial<Pick<FundInput, 'name' | 'zakatable' | 'archived'>>,
): Promise<void> {
  await updateDoc(doc(fundCol(uid), id), { ...patch, updatedAt: serverTimestamp() });
}

/** সব fund-এর সব entry — client-side fundId দিয়ে group/filter হয় (§২.২ safeParse)। */
export function subscribeHomeDeposits(
  uid: string,
  onChange: (e: HomeDepositEntry[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    entryCol(uid),
    (snap) => {
      const out: HomeDepositEntry[] = [];
      for (const d of snap.docs) {
        const r = HomeDepositEntrySchema.safeParse({ ...d.data(), id: d.id });
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

export async function addHomeDeposit(uid: string, input: HomeDepositEntryInput): Promise<string> {
  const data = HomeDepositEntrySchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(input);
  const ref = await addDoc(entryCol(uid), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateHomeDeposit(
  uid: string,
  id: string,
  patch: Partial<Pick<HomeDepositEntryInput, 'date' | 'amountMinor' | 'type' | 'note'>>,
): Promise<void> {
  await updateDoc(doc(entryCol(uid), id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteHomeDeposit(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(entryCol(uid), id));
}

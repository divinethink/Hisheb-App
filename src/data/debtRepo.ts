// debts repo — §২.২ প্যাটার্ন। repayments[] সবসময় পুরো array রিপ্লেস হয় (Firestore-এ array-item-edit সরাসরি নেই)।
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { toDhakaDate } from '../lib/date';
import { sumRepayments } from '../lib/debtCalc';
import { DebtSchema, type Debt, type DebtInput, type Repayment, type Borrowing } from '../validation/debtSchema';

const debtCol = (uid: string) => collection(db, 'users', uid, 'debts');

/** পুরনো doc-এ `borrowings` খালি থাকলে display-এর জন্য সিড করে — কোনো Firestore write হয় না (approved plan)। */
function withBorrowingsFallback(d: Debt): Debt {
  if (d.borrowings.length > 0) return d;
  return { ...d, borrowings: [{ date: d.date, amountMinor: d.totalAmountMinor, note: '' }] };
}

export function subscribeDebts(
  uid: string,
  onChange: (d: Debt[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    debtCol(uid),
    (snap) => {
      const out: Debt[] = [];
      for (const d of snap.docs) {
        const r = DebtSchema.safeParse({ ...d.data(), id: d.id });
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(withBorrowingsFallback(r.data));
      }
      out.sort((a, b) => b.date.localeCompare(a.date));
      onChange(out);
    },
    onError,
  );
}

export async function addDebt(uid: string, input: DebtInput): Promise<string> {
  const data = DebtSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(input);
  const ref = await addDoc(debtCol(uid), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

type EditablePatch = Partial<Pick<DebtInput, 'person' | 'direction' | 'date' | 'note' | 'expectedRepaymentDate'>>;

export async function updateDebt(uid: string, id: string, patch: EditablePatch): Promise<void> {
  await updateDoc(doc(debtCol(uid), id), { ...patch, updatedAt: serverTimestamp() });
}

export async function setReceivableStatus(
  uid: string,
  id: string,
  receivableStatus: Debt['receivableStatus'],
): Promise<void> {
  await updateDoc(doc(debtCol(uid), id), {
    receivableStatus,
    receivableStatusChangedAt: toDhakaDate(new Date()), // DF1
    updatedAt: serverTimestamp(),
  });
}

/** ➕/✕ দুটোতেই — caller নতুন সম্পূর্ণ array পাঠায় (idempotent না, তবে UI single-tap action)। */
export async function setRepayments(uid: string, id: string, repayments: Repayment[]): Promise<void> {
  await updateDoc(doc(debtCol(uid), id), { repayments, updatedAt: serverTimestamp() });
}

/** repayments-এর সিমেট্রিক — borrowings লেখার সময় totalAmountMinor (Σborrowings) auto-derive করে একসাথে লিখে। */
export async function setBorrowings(uid: string, id: string, borrowings: Borrowing[]): Promise<void> {
  await updateDoc(doc(debtCol(uid), id), {
    borrowings,
    totalAmountMinor: sumRepayments(borrowings),
    updatedAt: serverTimestamp(),
  });
}

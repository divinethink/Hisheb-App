// debts repo — §২.২ প্যাটার্ন। repayments[] সবসময় পুরো array রিপ্লেস হয় (Firestore-এ array-item-edit সরাসরি নেই)।
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { toDhakaDate } from '../lib/date';
import { sumRepayments } from '../lib/debtCalc';
import { DebtSchema, type Debt, type DebtInput, type RepaymentIn, type BorrowingIn } from '../validation/debtSchema';
import type { LineStatus } from '../lib/debtCalc';

const debtCol = (uid: string) => collection(db, 'users', uid, 'debts');

/** নতুন Borrowing লাইনের স্থায়ী আইডি (শোধ লিংক করার জন্য)। */
export function newBorrowingId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? `b_${c.randomUUID().slice(0, 12)}` : `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Firestore `undefined` মানে না — key বাদ দেয়। */
function strip<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * পুরনো doc-এ `borrowings` খালি থাকলে display-এর জন্য সিড করে — কোনো Firestore write হয় না (approved plan)।
 * id না থাকা লাইনে সবসময় deterministic 'L<index>' বসে (লেখার সময় persist হয়, তাই লিংক স্থিতিশীল)।
 */
function withBorrowingsFallback(d: Debt): Debt {
  const base = d.borrowings.length > 0 ? d.borrowings : [{ date: d.date, amountMinor: d.totalAmountMinor, note: '', statusChangedAt: null }];
  return { ...d, borrowings: base.map((b, i) => (b.id ? b : { ...b, id: `L${i}` })) };
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
  const parsed = DebtSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(input);
  const data = { ...parsed, borrowings: parsed.borrowings.map((b) => strip({ ...b, id: b.id ?? newBorrowingId() })) };
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
export async function setRepayments(uid: string, id: string, repayments: RepaymentIn[]): Promise<void> {
  await updateDoc(doc(debtCol(uid), id), { repayments: repayments.map((r) => strip(r)), updatedAt: serverTimestamp() });
}

/** repayments-এর সিমেট্রিক — borrowings লেখার সময় totalAmountMinor (Σborrowings) auto-derive করে একসাথে লিখে। */
export async function setBorrowings(uid: string, id: string, borrowings: BorrowingIn[]): Promise<void> {
  await updateDoc(doc(debtCol(uid), id), {
    borrowings: borrowings.map((b) => strip(b)),
    totalAmountMinor: sumRepayments(borrowings),
    updatedAt: serverTimestamp(),
  });
}

/** একটি লাইনের manual status বদল (Active/Doubtful/Written-off) — পুরো borrowings array রিপ্লেস; statusChangedAt = আজ (Asia/Dhaka)। */
export async function setBorrowingStatus(uid: string, debt: Debt, index: number, status: LineStatus): Promise<void> {
  const next = debt.borrowings.map((b, i) => (i === index ? { ...b, status, statusChangedAt: toDhakaDate(new Date()) } : b));
  await setBorrowings(uid, debt.id, next);
}

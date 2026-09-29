// Data Access Layer (Architecture Plan §২.২): UI/lib কখনো সরাসরি firebase/firestore ইমপোর্ট করবে না।
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { parseTransactions } from './parseTransactions';
import {
  TransactionInputSchema,
  TransactionUpdateSchema,
  type Transaction,
  type TransactionInput,
  type TransactionUpdate,
} from '../validation/transactionSchema';

const txCol = (uid: string) => collection(db, 'users', uid, 'transactions');

// মাসিক টোটাল কোয়েরিতে কখনো limit() নেই — truncate হলে হিসাব ভুল হয় (Roadmap §৯ item ৭)
function monthQuery(uid: string, yyyymm: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) throw new Error(`Invalid month: ${yyyymm}`);
  return query(txCol(uid), where('date', '>=', `${yyyymm}-01`), where('date', '<=', `${yyyymm}-31`));
}

export async function getTransactionsByMonth(
  uid: string,
  yyyymm: string,
  onInvalid?: (id: string, err: unknown) => void,
): Promise<Transaction[]> {
  const snap = await getDocs(monthQuery(uid, yyyymm));
  return parseTransactions(snap.docs, onInvalid);
}

export function subscribeTransactionsByMonth(
  uid: string,
  yyyymm: string,
  onChange: (txs: Transaction[]) => void,
  onInvalid?: (id: string, err: unknown) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    monthQuery(uid, yyyymm),
    (snap) => onChange(parseTransactions(snap.docs, onInvalid)),
    onError,
  );
}

/** Migration-only one-shot: সব non-deleted transaction (limit ছাড়া) — category-type inference-এর জন্য। */
export async function getAllTransactions(
  uid: string,
  onInvalid?: (id: string, err: unknown) => void,
): Promise<Transaction[]> {
  const snap = await getDocs(txCol(uid));
  return parseTransactions(snap.docs, onInvalid);
}

/** Cross-check window (P4): যেকোনো YYYY-MM-DD রেঞ্জ, limit ছাড়া (complete aggregation)। */
export function subscribeTransactionsByRange(
  uid: string,
  start: string,
  end: string,
  onChange: (txs: Transaction[]) => void,
  onInvalid?: (id: string, err: unknown) => void,
  onError?: (err: Error) => void,
): () => void {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(start) || !re.test(end)) throw new Error(`Invalid range: ${start}..${end}`);
  return onSnapshot(
    query(txCol(uid), where('date', '>=', start), where('date', '<=', end)),
    (snap) => onChange(parseTransactions(snap.docs, onInvalid)),
    onError,
  );
}

/** ফর্ম খোলার সময় একবার id বানানো হয়; double-tap/retry একই doc লেখে (idempotent, duplicate নেই) */
export function newTransactionId(uid: string): string {
  return doc(txCol(uid)).id;
}

export async function addTransaction(uid: string, id: string, input: TransactionInput): Promise<void> {
  const data = TransactionInputSchema.parse(input); // write-boundary validation
  await setDoc(doc(txCol(uid), id), {
    ...data,
    occurredAt: Timestamp.fromDate(data.occurredAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTransaction(uid: string, id: string, input: TransactionUpdate): Promise<void> {
  const data = TransactionUpdateSchema.parse(input);
  await updateDoc(doc(txCol(uid), id), { ...data, updatedAt: serverTimestamp() });
}

// soft-delete/restore (Undo snackbar, P2) — `deleted` flag টগল; বাকি ফিল্ড অপরিবর্তিত (C14)।
export async function softDeleteTransaction(uid: string, id: string): Promise<void> {
  await updateDoc(doc(txCol(uid), id), { deleted: true, updatedAt: serverTimestamp() });
}
export async function restoreTransaction(uid: string, id: string): Promise<void> {
  await updateDoc(doc(txCol(uid), id), { deleted: false, updatedAt: serverTimestamp() });
}

/** CSV import idempotency-র ভিত্তি (B8): min/max date-বাউন্ডেড, পুরো collection স্ক্যান না (Improvement 2026-09-17)। */
export async function getExistingImportKeys(uid: string, minDate: string, maxDate: string): Promise<Set<string>> {
  const q = query(txCol(uid), where('date', '>=', minDate), where('date', '<=', maxDate));
  const snap = await getDocs(q);
  const keys = new Set<string>();
  for (const d of snap.docs) {
    const k = (d.data() as { importKey?: unknown }).importKey;
    if (typeof k === 'string') keys.add(k);
  }
  return keys;
}

const BATCH_CHUNK = 450; // Firestore ৫০০-ডকুমেন্ট batch-লিমিট থেকে বাফার (C10 প্যাটার্ন অনুসরণ)

/** Bulk Delete (P5, Roadmap §৪.৮) — soft-delete flag থেকে সম্পূর্ণ আলাদা, permanent।
 *  start/end null মানে কোনো date-bound নেই (All-Time রেঞ্জ)। */
function rangeQuery(uid: string, start: string | null, end: string | null) {
  return start && end
    ? query(txCol(uid), where('date', '>=', start), where('date', '<=', end))
    : query(txCol(uid));
}

/** Bulk Delete confirmation screen-এ কতটা এন্ট্রি মুছে যাবে তা আগে দেখানোর জন্য। */
export async function countTransactionsInRange(uid: string, start: string | null, end: string | null): Promise<number> {
  const snap = await getDocs(rangeQuery(uid, start, end));
  return snap.size;
}

/** স্থায়ীভাবে মুছে ফেলে (soft-delete না) — auto-backup + "DELETE" টাইপ-করে-confirm UI-র দায়িত্ব caller-এর। */
export async function hardDeleteTransactionsByRange(uid: string, start: string | null, end: string | null): Promise<number> {
  const snap = await getDocs(rangeQuery(uid, start, end));
  const ids = snap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += BATCH_CHUNK) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_CHUNK)) batch.delete(doc(txCol(uid), id));
    await batch.commit();
  }
  return ids.length;
}

/** CSV Importer (P1b) — chunked writeBatch, প্রতিটা নতুন doc-এ নিজস্ব id। importKey caller বসিয়ে দেয়। */
export async function importTransactionsBatch(uid: string, inputs: TransactionInput[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < inputs.length; i += BATCH_CHUNK) {
    const chunk = inputs.slice(i, i + BATCH_CHUNK);
    const batch = writeBatch(db);
    for (const raw of chunk) {
      const data = TransactionInputSchema.parse(raw);
      batch.set(doc(txCol(uid)), {
        ...data,
        occurredAt: Timestamp.fromDate(data.occurredAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      written++;
    }
    await batch.commit();
  }
  return written;
}

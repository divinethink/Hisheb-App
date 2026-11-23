// zakatAssets + zakatPayments repo — §২.২ প্যাটার্ন (gpfRepo-এর মতো: প্রতিটা এন্ট্রি আলাদা doc, hard delete)।
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  ZakatAssetInputSchema,
  ZakatAssetSchema,
  ZakatCycleSchema,
  ZakatPaymentInputSchema,
  ZakatPaymentSchema,
  type ZakatAsset,
  type ZakatAssetInput,
  type ZakatCycle,
  type ZakatPayment,
  type ZakatPaymentInput,
} from '../validation/zakatSchema';

const assetsCol = (uid: string) => collection(db, 'users', uid, 'zakatAssets');
const paymentsCol = (uid: string) => collection(db, 'users', uid, 'zakatPayments');
const cyclesCol = (uid: string) => collection(db, 'users', uid, 'zakatCycles');

export function subscribeZakatAssets(
  uid: string,
  onChange: (a: ZakatAsset[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    assetsCol(uid),
    (snap) => {
      const out: ZakatAsset[] = [];
      for (const d of snap.docs) {
        const r = ZakatAssetSchema.safeParse({ ...d.data(), id: d.id });
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(r.data);
      }
      out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      onChange(out);
    },
    onError,
  );
}

export async function addZakatAsset(uid: string, input: ZakatAssetInput): Promise<string> {
  const data = ZakatAssetInputSchema.parse(input);
  const ref = await addDoc(assetsCol(uid), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateZakatAsset(uid: string, id: string, input: ZakatAssetInput): Promise<void> {
  const data = ZakatAssetInputSchema.parse(input);
  await updateDoc(doc(assetsCol(uid), id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteZakatAsset(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(assetsCol(uid), id));
}

export function subscribeZakatPayments(
  uid: string,
  onChange: (p: ZakatPayment[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    paymentsCol(uid),
    (snap) => {
      const out: ZakatPayment[] = [];
      for (const d of snap.docs) {
        const r = ZakatPaymentSchema.safeParse({ ...d.data(), id: d.id });
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

export async function addZakatPayment(uid: string, input: ZakatPaymentInput): Promise<string> {
  const data = ZakatPaymentInputSchema.parse(input);
  const ref = await addDoc(paymentsCol(uid), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateZakatPayment(uid: string, id: string, input: ZakatPaymentInput): Promise<void> {
  const data = ZakatPaymentInputSchema.parse(input);
  await updateDoc(doc(paymentsCol(uid), id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteZakatPayment(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(paymentsCol(uid), id));
}

export function subscribeZakatCycles(
  uid: string,
  onChange: (c: ZakatCycle[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    cyclesCol(uid),
    (snap) => {
      const out: ZakatCycle[] = [];
      for (const d of snap.docs) {
        const r = ZakatCycleSchema.safeParse({ ...d.data(), id: d.id });
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(r.data);
      }
      out.sort((a, b) => b.id.localeCompare(a.id));
      onChange(out);
    },
    onError,
  );
}

/** বছরের "দেয়" অঙ্ক লক/নতুন করে লক। doc id নির্দিষ্ট (cycleStart) বলে retry/double-tap-এ duplicate হয় না। */
export async function setZakatCycleDue(uid: string, cycleStart: string, dueMinor: number): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cycleStart) || !Number.isInteger(dueMinor) || dueMinor <= 0) throw new Error('invalid zakat cycle');
  await setDoc(doc(cyclesCol(uid), cycleStart), { dueMinor, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteZakatCycle(uid: string, cycleStart: string): Promise<void> {
  await deleteDoc(doc(cyclesCol(uid), cycleStart));
}

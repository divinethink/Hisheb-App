// historicalYearlyTotals repo — doc-ID = year, setDoc upsert (idempotent, Architecture Plan §২.২)।
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { HistoricalYearlyTotalSchema, type HistoricalCategoryItem, type HistoricalYearlyTotal } from '../validation/historicalSchema';

const col = (uid: string) => collection(db, 'users', uid, 'historicalYearlyTotals');

export function subscribeHistoricalTotals(
  uid: string,
  onChange: (rows: HistoricalYearlyTotal[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    col(uid),
    (snap) => {
      const out: HistoricalYearlyTotal[] = [];
      for (const d of snap.docs) {
        const r = HistoricalYearlyTotalSchema.safeParse(d.data());
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(r.data);
      }
      out.sort((a, b) => a.year - b.year);
      onChange(out);
    },
    onError,
  );
}

export async function setHistoricalYearlyTotal(
  uid: string,
  t: Pick<HistoricalYearlyTotal, 'year' | 'totalIncomeMinor' | 'totalExpenseMinor' | 'totalDepositMinor'> & {
    categoryTotals?: readonly HistoricalCategoryItem[] | null;
  },
): Promise<void> {
  const { year, totalIncomeMinor, totalExpenseMinor, totalDepositMinor, categoryTotals } = t;
  const totals = { year, totalIncomeMinor, totalExpenseMinor, totalDepositMinor }; // শুধু schema-র ফিল্ড (preview-ফিল্ড Firestore-এ নয়)
  // merge: categoryTotals না এলে আগে-থেকে-থাকা খাতওয়ারি ডেটা মোছে না (zero-data-loss)
  await setDoc(
    doc(col(uid), String(t.year)),
    { ...totals, ...(categoryTotals && categoryTotals.length ? { categoryTotals: [...categoryTotals] } : {}), note: null, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

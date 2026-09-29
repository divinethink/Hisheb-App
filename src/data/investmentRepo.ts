// investments repo — §২.২ প্যাটার্ন। repayments[] সবসময় পুরো array রিপ্লেস হয় (Firestore-এ array-item-edit সরাসরি নেই)।
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { toDhakaDate } from '../lib/date';
import { InvestmentSchema, type Investment, type InvestmentInput, type Repayment } from '../validation/investmentSchema';

const investmentCol = (uid: string) => collection(db, 'users', uid, 'investments');

export function subscribeInvestments(
  uid: string,
  onChange: (d: Investment[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    investmentCol(uid),
    (snap) => {
      const out: Investment[] = [];
      for (const d of snap.docs) {
        const r = InvestmentSchema.safeParse({ ...d.data(), id: d.id });
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

export async function addInvestment(uid: string, input: InvestmentInput): Promise<string> {
  const data = InvestmentSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(input);
  const ref = await addDoc(investmentCol(uid), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

type EditablePatch = Partial<
  Pick<InvestmentInput, 'investedTo' | 'medium' | 'principalMinor' | 'date' | 'duration' | 'note' | 'expectedRepaymentDate'>
>;

export async function updateInvestment(uid: string, id: string, patch: EditablePatch): Promise<void> {
  await updateDoc(doc(investmentCol(uid), id), { ...patch, updatedAt: serverTimestamp() });
}

export async function setInvestmentOutcome(
  uid: string,
  id: string,
  investmentOutcome: Investment['investmentOutcome'],
): Promise<void> {
  await updateDoc(doc(investmentCol(uid), id), {
    investmentOutcome,
    investmentOutcomeChangedAt: toDhakaDate(new Date()), // DF1
    updatedAt: serverTimestamp(),
  });
}

/** ➕/✎/✕ — caller নতুন সম্পূর্ণ array পাঠায় (idempotent না, তবে UI single-tap action)। */
export async function setInvestmentRepayments(uid: string, id: string, repayments: Repayment[]): Promise<void> {
  await updateDoc(doc(investmentCol(uid), id), { repayments, updatedAt: serverTimestamp() });
}

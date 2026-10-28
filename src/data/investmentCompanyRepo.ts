// investmentCompanies repo — §২.২ প্যাটার্ন (customLedgerRepo-র মতো)।
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  InvestmentCompanyInputSchema,
  InvestmentCompanySchema,
  type InvestmentCompany,
  type InvestmentCompanyInput,
} from '../validation/investmentCompanySchema';

const companyCol = (uid: string) => collection(db, 'users', uid, 'investmentCompanies');

export function subscribeInvestmentCompanies(
  uid: string,
  onChange: (c: InvestmentCompany[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    companyCol(uid),
    (snap) => {
      const out: InvestmentCompany[] = [];
      for (const d of snap.docs) {
        const r = InvestmentCompanySchema.safeParse({ ...d.data(), id: d.id });
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(r.data);
      }
      out.sort((a, b) => a.name.localeCompare(b.name));
      onChange(out);
    },
    onError,
  );
}

/** id আগেই তৈরি (client-side) ও setDoc — double-tap-এ duplicate হয় না (idempotent), আর অফলাইনে ack-এর আগেও id পাওয়া যায়। */
export function addInvestmentCompany(uid: string, input: InvestmentCompanyInput): { id: string; done: Promise<void> } {
  const data = InvestmentCompanyInputSchema.parse(input);
  const ref = doc(companyCol(uid));
  return { id: ref.id, done: setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }) };
}

export async function updateInvestmentCompany(uid: string, id: string, input: InvestmentCompanyInput): Promise<void> {
  const data = InvestmentCompanyInputSchema.parse(input);
  await updateDoc(doc(companyCol(uid), id), { ...data, updatedAt: serverTimestamp() });
}

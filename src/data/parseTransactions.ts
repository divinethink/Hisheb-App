// Firestore-নিরপেক্ষ parse ফাংশন (SDK import নেই → সরাসরি unit-test করা যায়)।
import { TransactionSchema, type Transaction } from '../validation/transactionSchema';

export interface RawDoc {
  id: string;
  data(): unknown;
}

/** অবৈধ doc skip+report (একটা খারাপ doc পুরো মাস crash করে না, C14); deleted===true client-side ফিল্টার। */
export function parseTransactions(
  docs: readonly RawDoc[],
  onInvalid?: (id: string, err: unknown) => void,
): Transaction[] {
  const out: Transaction[] = [];
  for (const d of docs) {
    const r = TransactionSchema.safeParse({ ...(d.data() as object), id: d.id });
    if (!r.success) {
      onInvalid?.(d.id, r.error);
      continue;
    }
    if (!r.data.deleted) out.push(r.data);
  }
  return out;
}

// accountBalances + netWorthSnapshots repo — Architecture Plan §২.২ প্যাটার্ন।
// Composite doc-ID + setDoc(merge না, পুরো replace) — একই account+মাস / মাসে সবসময় ঠিক একটা doc (C11/C12)।
import { collection, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  AccountBalanceSchema,
  NetWorthSnapshotSchema,
  type AccountBalance,
  type NetWorthSnapshot,
} from '../validation/netWorthSchema';

const balCol = (uid: string) => collection(db, 'users', uid, 'accountBalances');
const snapCol = (uid: string) => collection(db, 'users', uid, 'netWorthSnapshots');

/** সব accountBalances doc — "latest per account" বের করা caller-এর দায়িত্ব (lib/netWorthCalc.ts, §২.২ safeParse)। */
export function subscribeAccountBalances(
  uid: string,
  onChange: (b: AccountBalance[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    balCol(uid),
    (snap) => {
      const out: AccountBalance[] = [];
      for (const d of snap.docs) {
        const r = AccountBalanceSchema.safeParse(d.data());
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(r.data);
      }
      onChange(out);
    },
    onError,
  );
}

/** নতুন → পুরনো (yyyymm)। */
export function subscribeNetWorthSnapshots(
  uid: string,
  onChange: (s: NetWorthSnapshot[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    snapCol(uid),
    (snap) => {
      const out: NetWorthSnapshot[] = [];
      for (const d of snap.docs) {
        const r = NetWorthSnapshotSchema.safeParse(d.data());
        if (!r.success) {
          onInvalid?.(d.id);
          continue;
        }
        out.push(r.data);
      }
      out.sort((a, b) => b.yyyymm.localeCompare(a.yyyymm));
      onChange(out);
    },
    onError,
  );
}

/** doc-ID = `${accountId}_${yyyymm}` — same account+month চাপলে overwrite, নতুন doc কখনো না (C11)। */
export async function setAccountBalance(
  uid: string,
  accountId: string,
  yyyymm: string,
  balanceMinor: number,
  snapshotDate: string,
): Promise<void> {
  await setDoc(doc(balCol(uid), `${accountId}_${yyyymm}`), {
    accountId,
    yyyymm,
    balanceMinor,
    snapshotDate,
    updatedAt: serverTimestamp(),
  });
}

/** doc-ID = `yyyymm` — same month চাপলে overwrite, নতুন doc কখনো না (C12)। unverified (ঐচ্ছিক, DF11) —
 *  শুধু true হলে ফিল্ড বসে, নাহলে বাদ (পুরনো caller-দের আচরণ অপরিবর্তিত)। */
export async function setNetWorthSnapshot(
  uid: string,
  yyyymm: string,
  totalAssetsMinor: number,
  snapshotDate: string,
  unverified?: boolean,
): Promise<void> {
  await setDoc(doc(snapCol(uid), yyyymm), {
    yyyymm,
    totalAssetsMinor,
    snapshotDate,
    ...(unverified ? { unverified: true } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** এক-বারের read — শুধু existing yyyymm-দের তালিকা (P4 monthly-backfill importer-এর overwrite-protection
 *  চেকের জন্য, one-shot getX প্যাটার্ন §২.২)। */
export async function getExistingNetWorthYyyymms(uid: string): Promise<string[]> {
  const snap = await getDocs(snapCol(uid));
  const out: string[] = [];
  for (const d of snap.docs) {
    const r = NetWorthSnapshotSchema.safeParse(d.data());
    if (r.success) out.push(r.data.yyyymm);
  }
  return out;
}

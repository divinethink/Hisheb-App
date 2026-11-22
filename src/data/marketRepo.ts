// marketGroups / marketItems repo — §২.২ প্যাটার্ন। মোছা নেই, শুধু archive (Zero Data Loss)।
import {
  collection,
  doc,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  MarketGroupInputSchema,
  MarketGroupSchema,
  MarketItemInputSchema,
  MarketItemSchema,
  PriceEntrySchema,
  type MarketGroup,
  type MarketGroupInput,
  type MarketItem,
  type MarketItemInput,
  type PriceEntry,
} from '../validation/marketSchema';
import { pushPrice } from '../lib/marketCalc';
import { MARKET_SEED } from '../lib/marketSeed';

const groupCol = (uid: string) => collection(db, 'users', uid, 'marketGroups');
const itemCol = (uid: string) => collection(db, 'users', uid, 'marketItems');

export function subscribeMarketGroups(
  uid: string,
  onChange: (g: MarketGroup[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    groupCol(uid),
    (snap) => {
      const out: MarketGroup[] = [];
      for (const d of snap.docs) {
        const r = MarketGroupSchema.safeParse({ ...d.data(), id: d.id });
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

export function subscribeMarketItems(
  uid: string,
  onChange: (i: MarketItem[]) => void,
  onInvalid?: (id: string) => void,
  onError?: (e: Error) => void,
) {
  return onSnapshot(
    itemCol(uid),
    (snap) => {
      const out: MarketItem[] = [];
      for (const d of snap.docs) {
        const r = MarketItemSchema.safeParse({ ...d.data(), id: d.id });
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

/** id আগেই তৈরি + setDoc — double-tap-এ duplicate হয় না। */
export function addMarketGroup(uid: string, input: MarketGroupInput): Promise<void> {
  const data = MarketGroupInputSchema.parse(input);
  return setDoc(doc(groupCol(uid)), { ...data, archived: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateMarketGroup(
  uid: string,
  id: string,
  patch: { name?: string; icon?: string | null; archived?: boolean },
): Promise<void> {
  await updateDoc(doc(groupCol(uid), id), {
    ...patch,
    ...(patch.name !== undefined ? { name: MarketGroupInputSchema.shape.name.parse(patch.name) } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** Customize groups: ক্রম ও খোলা/বন্ধ একসাথে (এক batch)। শুধু বদলানো গ্রুপগুলো পাঠানো হয়। */
export async function saveMarketGroupLayout(
  uid: string,
  rows: readonly { id: string; order: number; fold: 'open' | 'closed' }[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const r of rows) batch.update(doc(groupCol(uid), r.id), { order: r.order, fold: r.fold, updatedAt: serverTimestamp() });
  await batch.commit();
}

export function addMarketItem(uid: string, input: MarketItemInput): Promise<void> {
  const data = MarketItemInputSchema.parse(input);
  return setDoc(doc(itemCol(uid)), { ...data, archived: false, history: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateMarketItem(
  uid: string,
  id: string,
  patch: { name?: string; unit?: string; groupId?: string; archived?: boolean },
): Promise<void> {
  await updateDoc(doc(itemCol(uid), id), {
    ...patch,
    ...(patch.name !== undefined ? { name: MarketItemInputSchema.shape.name.parse(patch.name) } : {}),
    ...(patch.unit !== undefined ? { unit: MarketItemInputSchema.shape.unit.parse(patch.unit) } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** নতুন দাম বসানো — শেষ ৫টা ইতিহাস রাখে (lib/marketCalc.pushPrice)। */
export async function recordMarketPrice(uid: string, item: MarketItem, entry: PriceEntry): Promise<void> {
  const e = PriceEntrySchema.parse(entry);
  await updateDoc(doc(itemCol(uid), item.id), { history: pushPrice(item.history, e), updatedAt: serverTimestamp() });
}

/** পাশের এন্ট্রির সাথে ক্রম অদলবদল (এক batch-এ দুটো write)। */
export async function swapMarketOrder(
  uid: string,
  kind: 'group' | 'item',
  a: { id: string; order: number },
  b: { id: string; order: number },
): Promise<void> {
  const col = kind === 'group' ? groupCol(uid) : itemCol(uid);
  const batch = writeBatch(db);
  batch.update(doc(col, a.id), { order: b.order, updatedAt: serverTimestamp() });
  batch.update(doc(col, b.id), { order: a.order, updatedAt: serverTimestamp() });
  await batch.commit();
}

/**
 * প্রথমবার খুললে শুরুর তালিকা বসায়। শুধু **সার্ভার নিশ্চিত করলে** যে দুই collection-ই খালি (অফলাইন/ক্যাশের
 * ভুল "খালি" দেখে বসালে আসল ডেটা চাপা পড়ত না — সার্ভার না পেলে কিছুই করে না)। ফিক্সড id, তাই আবার চালালেও duplicate নয়।
 * মোছা নেই (archive-only), তাই owner সব archive করলেও এটা আর বসে না (doc থেকে যায়)।
 */
export async function seedMarketDefaultsIfEmpty(uid: string): Promise<boolean> {
  try {
    const [g, i] = await Promise.all([
      getDocsFromServer(query(groupCol(uid), limit(1))),
      getDocsFromServer(query(itemCol(uid), limit(1))),
    ]);
    if (!g.empty || !i.empty) return false;
    const batch = writeBatch(db);
    MARKET_SEED.forEach((grp, gi) => {
      const gid = `seed-g${gi + 1}`;
      batch.set(doc(groupCol(uid), gid), {
        name: grp.name,
        icon: grp.icon,
        order: (gi + 1) * 100,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      grp.items.forEach(([name, unit], ii) => {
        batch.set(doc(itemCol(uid), `seed-g${gi + 1}-i${ii + 1}`), {
          groupId: gid,
          name,
          unit,
          order: (ii + 1) * 100,
          archived: false,
          history: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    });
    await batch.commit();
    return true;
  } catch {
    return false; // অফলাইন/অনুমতি-সমস্যা — চুপচাপ, পরের বার আবার চেষ্টা
  }
}

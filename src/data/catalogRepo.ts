// categories + labels repo (P1: list + নাম-ভিত্তিক idempotent add — Audit 2026-09-18)।
// update/merge/rename P2-তে (chunked batch ≤৪৫০, C10)।
import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch, type UpdateData, type DocumentData } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  CategorySchema,
  LabelSchema,
  NameSchema,
  type Category,
  type Label,
} from '../validation/catalogSchemas';

type RawDoc = { id: string; data(): unknown };

function parseList<T extends { name: string; archived: boolean; order: number }>(
  docs: readonly RawDoc[],
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
  onInvalid?: (id: string) => void,
): T[] {
  const out: T[] = [];
  for (const d of docs) {
    const r = schema.safeParse({ ...(d.data() as object), id: d.id });
    if (!r.success) {
      onInvalid?.(d.id);
      continue;
    }
    if (!r.data.archived) out.push(r.data);
  }
  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

const catCol = (uid: string) => collection(db, 'users', uid, 'categories');
const lblCol = (uid: string) => collection(db, 'users', uid, 'labels');
const txCol = (uid: string) => collection(db, 'users', uid, 'transactions');

const BATCH_CHUNK = 450; // Firestore ৫০০-ডকুমেন্ট batch-লিমিট থেকে বাফার (C10 প্যাটার্ন, transactionRepo.ts অনুসরণ)
const IN_CHUNK = 10; // Firestore 'in'/'array-contains-any' কোয়েরির সর্বোচ্চ ভ্যালু-সংখ্যা

async function commitInChunks(uid: string, updates: Array<{ id: string; data: UpdateData<DocumentData> }>) {
  for (let i = 0; i < updates.length; i += BATCH_CHUNK) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + BATCH_CHUNK)) batch.update(doc(txCol(uid), u.id), u.data);
    await batch.commit();
  }
}

export function subscribeCategories(uid: string, onChange: (c: Category[]) => void, onError?: (e: Error) => void) {
  return onSnapshot(catCol(uid), (s) => onChange(parseList<Category>(s.docs, CategorySchema)), onError);
}
export function subscribeLabels(uid: string, onChange: (l: Label[]) => void, onError?: (e: Error) => void) {
  return onSnapshot(lblCol(uid), (s) => onChange(parseList<Label>(s.docs, LabelSchema)), onError);
}

/** নাম আগে থেকে থাকলে সেই doc-এর id ফেরত (duplicate তৈরি হয় না); না থাকলে নতুন। */
/**
 * Archived (merge-এর ফলে হাইড হওয়া) category/label — owner-request (২০২৬-০৯-২৬), Menu-তে
 * "View archived"-এর জন্য one-shot read। Restore করলে `archived: false` — merge-এর ফলে
 * archive হওয়া entry ফেরত আনা যায়, কোনো data হারায় না (transaction-এর reference অবশ্য
 * merge-করা নতুন category/label-এই থাকে, শুধু listing-এ আবার দেখা যাবে)।
 */
export async function getArchivedCategories(uid: string): Promise<Category[]> {
  const snap = await getDocs(query(catCol(uid), where('archived', '==', true)));
  const out: Category[] = [];
  for (const d of snap.docs) {
    const r = CategorySchema.safeParse({ ...(d.data() as object), id: d.id });
    if (r.success) out.push(r.data);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getArchivedLabels(uid: string): Promise<Label[]> {
  const snap = await getDocs(query(lblCol(uid), where('archived', '==', true)));
  const out: Label[] = [];
  for (const d of snap.docs) {
    const r = LabelSchema.safeParse({ ...(d.data() as object), id: d.id });
    if (r.success) out.push(r.data);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function restoreCategory(uid: string, id: string): Promise<void> {
  await updateDoc(doc(catCol(uid), id), { archived: false, updatedAt: serverTimestamp() });
}

export async function restoreLabel(uid: string, id: string): Promise<void> {
  await updateDoc(doc(lblCol(uid), id), { archived: false, updatedAt: serverTimestamp() });
}

export async function addCategory(
  uid: string,
  input: { name: string; type: 'income' | 'expense' | null; icon?: string | null; color?: string | null },
): Promise<{ id: string; name: string }> {
  const name = NameSchema.parse(input.name);
  const existing = await getDocs(query(catCol(uid), where('name', '==', name)));
  if (!existing.empty) return { id: existing.docs[0].id, name };
  const ref = await addDoc(catCol(uid), {
    name,
    icon: input.icon ?? null,
    color: input.color ?? null,
    type: input.type,
    archived: false,
    monthlyBudgetMinor: null,
    order: Date.now(), // নতুন সবসময় শেষে; gap-based reorder P2-তে
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, name };
}

/** Migration-only one-shot (archived-সহ সব) — category-type inference স্ক্রিনের জন্য। */
export async function getCategoriesOnce(uid: string, onInvalid?: (id: string) => void): Promise<Category[]> {
  const snap = await getDocs(catCol(uid));
  const out: Category[] = [];
  for (const d of snap.docs) {
    const r = CategorySchema.safeParse({ ...(d.data() as object), id: d.id });
    if (!r.success) {
      onInvalid?.(d.id);
      continue;
    }
    out.push(r.data);
  }
  return out;
}

/** শুধু `type` ফিল্ড আপডেট — migration স্ক্রিন থেকে ম্যানুয়ালি-সেট-করা type ওভাররাইট করার সুযোগ caller-এর, guard caller-এ। */
export async function updateCategoryType(uid: string, id: string, type: 'income' | 'expense'): Promise<void> {
  await updateDoc(doc(catCol(uid), id), { type, updatedAt: serverTimestamp() });
}

/** rename/icon/color এডিট (P2 — merge আলাদা ধাপে, C10-এর chunked-batch এখানে দরকার নেই)। */
export async function updateCategory(
  uid: string,
  id: string,
  patch: { name?: string; icon?: string | null; color?: string | null },
): Promise<void> {
  const data: UpdateData<DocumentData> = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) data.name = NameSchema.parse(patch.name);
  if (patch.icon !== undefined) data.icon = patch.icon;
  if (patch.color !== undefined) data.color = patch.color;
  await updateDoc(doc(catCol(uid), id), data);
}

export async function updateLabel(
  uid: string,
  id: string,
  patch: { name?: string; icon?: string | null; color?: string | null },
): Promise<void> {
  const data: UpdateData<DocumentData> = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) data.name = NameSchema.parse(patch.name);
  if (patch.icon !== undefined) data.icon = patch.icon;
  if (patch.color !== undefined) data.color = patch.color;
  await updateDoc(doc(lblCol(uid), id), data);
}

export async function addLabel(
  uid: string,
  rawName: string,
  opts?: { icon?: string | null; color?: string | null },
): Promise<{ id: string; name: string }> {
  const name = NameSchema.parse(rawName);
  const existing = await getDocs(query(lblCol(uid), where('name', '==', name)));
  if (!existing.empty) return { id: existing.docs[0].id, name };
  const ref = await addDoc(lblCol(uid), {
    name,
    icon: opts?.icon ?? null,
    color: opts?.color ?? null,
    archived: false,
    order: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, name };
}

/**
 * দুই/একাধিক Category একত্র করা (owner-request, ২০২৬-০৯-২৬) — `keepId`-তে টার্গেট, বাকি
 * `mergeIds`-এর সব transaction.categoryId/categoryName নতুনটায় sync (chunked batch, C10
 * প্যাটার্ন), তারপর পুরনো category-গুলো archive (hard-delete না — zero data loss)। Idempotent:
 * দ্বিতীয়বার চালালে আর কোনো matching transaction পাওয়া যাবে না, শুধু archive-repeat নিরাপদ।
 */
export async function mergeCategories(uid: string, keepId: string, keepName: string, mergeIds: string[]): Promise<number> {
  const ids = mergeIds.filter((id) => id !== keepId);
  if (ids.length === 0) return 0;
  let updated = 0;
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const snap = await getDocs(query(txCol(uid), where('categoryId', 'in', chunk)));
    const patch = snap.docs.map((d) => ({ id: d.id, data: { categoryId: keepId, categoryName: keepName } }));
    await commitInChunks(uid, patch);
    updated += patch.length;
  }
  const archiveBatch = writeBatch(db);
  for (const id of ids) archiveBatch.update(doc(catCol(uid), id), { archived: true, updatedAt: serverTimestamp() });
  await archiveBatch.commit();
  return updated;
}

/**
 * দুই/একাধিক Label একত্র করা — `labelIds[]`/`labelNames[]` index-aligned parallel array বলে
 * (Architecture Plan §২) প্রতিটা matching transaction-এর array রিম্যাপ+dedupe করে লেখা হয়,
 * শুধু id-প্রতিস্থাপন যথেষ্ট না। বাকি সব মন্তব্য mergeCategories-এর মতোই (idempotent, archive)।
 */
export async function mergeLabels(uid: string, keepId: string, keepName: string, mergeIds: string[]): Promise<number> {
  const ids = mergeIds.filter((id) => id !== keepId);
  if (ids.length === 0) return 0;
  const mergeSet = new Set(ids);
  let updated = 0;
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const snap = await getDocs(query(txCol(uid), where('labelIds', 'array-contains-any', chunk)));
    const patch = snap.docs.map((d) => {
      const data = d.data() as { labelIds?: string[]; labelNames?: string[] };
      const oldIds = data.labelIds ?? [];
      const oldNames = data.labelNames ?? [];
      const newIds: string[] = [];
      const newNames: string[] = [];
      const seen = new Set<string>();
      for (let j = 0; j < oldIds.length; j++) {
        const mapped = mergeSet.has(oldIds[j]) ? keepId : oldIds[j];
        const mappedName = mergeSet.has(oldIds[j]) ? keepName : (oldNames[j] ?? '');
        if (seen.has(mapped)) continue;
        seen.add(mapped);
        newIds.push(mapped);
        newNames.push(mappedName);
      }
      return { id: d.id, data: { labelIds: newIds, labelNames: newNames } };
    });
    await commitInChunks(uid, patch);
    updated += patch.length;
  }
  const archiveBatch = writeBatch(db);
  for (const id of ids) archiveBatch.update(doc(lblCol(uid), id), { archived: true, updatedAt: serverTimestamp() });
  await archiveBatch.commit();
  return updated;
}

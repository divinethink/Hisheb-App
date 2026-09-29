import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const OWNER_UID = 'owner-uid';
const OWNER_EMAIL = 'owner@example.com';
let env: RulesTestEnvironment;

const validTx = { amountMinor: 12500, type: 'expense', date: '2026-09-20' };

beforeAll(async () => {
  // OWNER_GMAIL placeholder-কে test-email দিয়ে বদলে আসল rules ফাইলই টেস্ট হয়
  const rules = readFileSync('firestore.rules', 'utf8').replaceAll('OWNER_GMAIL', OWNER_EMAIL);
  env = await initializeTestEnvironment({ projectId: 'demo-hisheb', firestore: { rules } });
});
afterAll(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

const owner = () =>
  env.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: true }).firestore();

describe('Data isolation / access', () => {
  it('owner can create & read own transaction', async () => {
    const db = owner();
    await assertSucceeds(setDoc(doc(db, `users/${OWNER_UID}/transactions/t1`), validTx));
    await assertSucceeds(getDoc(doc(db, `users/${OWNER_UID}/transactions/t1`)));
  });
  it('owner cannot touch another uid path', async () => {
    const db = owner();
    await assertFails(setDoc(doc(db, 'users/other-uid/transactions/t1'), validTx));
    await assertFails(getDoc(doc(db, 'users/other-uid/transactions/t1')));
  });
  it('other Google account (different email/uid) is blocked', async () => {
    const db = env
      .authenticatedContext('stranger', { email: 'stranger@example.com', email_verified: true })
      .firestore();
    await assertFails(setDoc(doc(db, `users/${OWNER_UID}/transactions/t1`), validTx));
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/transactions/t1`)));
  });
  it('same uid but wrong email is blocked', async () => {
    const db = env
      .authenticatedContext(OWNER_UID, { email: 'x@example.com', email_verified: true })
      .firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/transactions/t1`)));
  });
  it('unverified email is blocked', async () => {
    const db = env
      .authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: false })
      .firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/transactions/t1`)));
  });
  it('unauthenticated is blocked', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/transactions/t1`)));
  });
  it('top-level collection and deeper subcollection are default-deny', async () => {
    const db = owner();
    await assertFails(setDoc(doc(db, 'transactions/t1'), validTx));
    await assertFails(setDoc(doc(db, `users/${OWNER_UID}/transactions/t1/sub/s1`), { a: 1 }));
  });
  it('owner can delete own doc', async () => {
    const db = owner();
    await assertSucceeds(setDoc(doc(db, `users/${OWNER_UID}/transactions/t1`), validTx));
    await assertSucceeds(deleteDoc(doc(db, `users/${OWNER_UID}/transactions/t1`)));
  });
});

describe('validWrite — amounts (R1: int, > 0)', () => {
  const path = `users/${OWNER_UID}/transactions/t1`;
  it.each([
    ['zero', 0],
    ['negative', -500],
    ['decimal', 12.5],
    ['string', '500'],
  ])('rejects %s amountMinor', async (_n, v) => {
    await assertFails(setDoc(doc(owner(), path), { ...validTx, amountMinor: v }));
  });
  it('rejects bad type', async () => {
    await assertFails(setDoc(doc(owner(), path), { ...validTx, type: 'transfer' }));
  });
  it.each(['2026-9-1', '20260901', 'not-a-date'])('rejects bad date %s', async (d) => {
    await assertFails(setDoc(doc(owner(), path), { ...validTx, date: d }));
  });
  it('rejects missing fields', async () => {
    await assertFails(setDoc(doc(owner(), path), { amountMinor: 100 }));
  });
  it('update to invalid amount is rejected too', async () => {
    const db = owner();
    await assertSucceeds(setDoc(doc(db, path), validTx));
    await assertFails(setDoc(doc(db, path), { ...validTx, amountMinor: -1 }));
  });
});

describe('validWrite — other collections (P3/P8-এর clause আগে থেকেই যাচাই)', () => {
  const p = (c: string) => doc(owner(), `users/${OWNER_UID}/${c}/x1`);
  it('debts/investments/homeDeposits/zakatPayments require positive int', async () => {
    await assertFails(setDoc(p('debts'), { totalAmountMinor: 0 }));
    await assertSucceeds(setDoc(p('debts'), { totalAmountMinor: 100 }));
    await assertFails(setDoc(p('investments'), { principalMinor: -1 }));
    await assertSucceeds(setDoc(p('investments'), { principalMinor: 100 }));
    await assertFails(setDoc(p('homeDeposits'), { amountMinor: 1.5 }));
    await assertSucceeds(setDoc(p('homeDeposits'), { amountMinor: 100 }));
    await assertFails(setDoc(p('zakatPayments'), { amountMinor: 0 }));
    await assertSucceeds(setDoc(p('zakatPayments'), { amountMinor: 100 }));
  });
  it('gpfEntries require positive int amount and a known type', async () => {
    const ok = { amountMinor: 121300, type: 'contribution' };
    await assertSucceeds(setDoc(p('gpfEntries'), ok));
    await assertFails(setDoc(p('gpfEntries'), { ...ok, amountMinor: 0 }));
    await assertFails(setDoc(p('gpfEntries'), { ...ok, amountMinor: -5 }));
    await assertFails(setDoc(p('gpfEntries'), { ...ok, amountMinor: 1.5 }));
    await assertFails(setDoc(p('gpfEntries'), { ...ok, type: 'bonus' }));
  });
  it('accountBalances/netWorthSnapshots allow zero/negative int but not decimal', async () => {
    await assertSucceeds(setDoc(p('accountBalances'), { balanceMinor: -50 }));
    await assertSucceeds(setDoc(p('netWorthSnapshots'), { totalAssetsMinor: 0 }));
    await assertFails(setDoc(p('accountBalances'), { balanceMinor: 1.5 }));
    await assertFails(setDoc(p('netWorthSnapshots'), { totalAssetsMinor: 'a' }));
  });
  it('historicalYearlyTotals need int totals', async () => {
    const ok = { totalIncomeMinor: 100, totalExpenseMinor: 0, totalDepositMinor: 5 };
    await assertSucceeds(setDoc(p('historicalYearlyTotals'), ok));
    await assertFails(setDoc(p('historicalYearlyTotals'), { ...ok, totalIncomeMinor: 1.5 }));
    await assertFails(setDoc(p('historicalYearlyTotals'), { totalIncomeMinor: 1 }));
  });
  it('labels/categories need non-empty name', async () => {
    await assertFails(setDoc(p('labels'), { name: '' }));
    await assertSucceeds(setDoc(p('labels'), { name: 'Fruits' }));
    await assertFails(setDoc(p('categories'), { icon: 'x' }));
  });
});

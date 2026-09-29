import { describe, it, expect } from 'vitest';
import {
  addDays,
  computeCrossCheck,
  pickSnapshotPair,
  type CrossCheckInput,
  type DebtLite,
  type InvestmentLite,
} from './crossCheck';

const prev = { yyyymm: '2026-08', totalAssetsMinor: 15_103_600, snapshotDate: '2026-08-31' };

const base = (over: Partial<CrossCheckInput> = {}): CrossCheckInput => ({
  previous: prev,
  current: null,
  liveTotalAssetsMinor: 15_103_600,
  today: '2026-09-24',
  transactions: [],
  debts: [],
  investments: [],
  gpfEntries: [],
  periodBalances: [],
  period: '2026-09',
  ...over,
});

const inv = (o: Partial<InvestmentLite> = {}): InvestmentLite => ({
  investedTo: 'X',
  date: '2026-01-01',
  principalMinor: 1_000_000,
  repayments: [],
  investmentOutcome: 'running',
  investmentOutcomeChangedAt: null,
  ...o,
});
const debt = (o: Partial<DebtLite> = {}): DebtLite => ({
  person: 'P',
  direction: 'owe_me',
  totalAmountMinor: 100_000,
  date: '2026-01-01',
  repayments: [],
  receivableStatus: 'active',
  receivableStatusChangedAt: null,
  ...o,
});

describe('addDays', () => {
  it('month/year boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('computeCrossCheck — core formula & window', () => {
  it('window = prev.snapshotDate+1 .. today; snapshot-দিনের লেনদেন আগের snapshot-এর অংশ', () => {
    const r = computeCrossCheck(
      base({
        transactions: [
          { date: '2026-08-31', type: 'expense', amountMinor: 999_999 }, // বাইরে
          { date: '2026-09-01', type: 'income', amountMinor: 4_200_800 },
          { date: '2026-09-02', type: 'expense', amountMinor: 50_000 },
          { date: '2026-09-25', type: 'expense', amountMinor: 1 }, // আজের পরে — বাইরে
        ],
      }),
    );
    expect(r.windowStart).toBe('2026-09-01');
    expect(r.windowEnd).toBe('2026-09-24');
    expect(r.savingsMinor).toBe(4_150_800);
    expect(r.expectedMinor).toBe(15_103_600 + 4_150_800);
  });

  it('deviation = current − expected; matched শুধু ঠিক ০-তে', () => {
    const ok = computeCrossCheck(base({ transactions: [{ date: '2026-09-02', type: 'income', amountMinor: 100 }], liveTotalAssetsMinor: 15_103_700 }));
    expect(ok.status).toBe('matched');
    expect(ok.deviationMinor).toBe(0);

    const off = computeCrossCheck(base({ liveTotalAssetsMinor: 15_103_100 }));
    expect(off.deviationMinor).toBe(-500);
    expect(off.status).toBe('deviation');
    expect(off.unexplainedMinor).toBe(-500);
    expect(off.currentIsLive).toBe(true);
  });

  it('চলতি snapshot doc থাকলে তার totalAssets ও snapshotDate ব্যবহার হয়, live না', () => {
    const cur = { yyyymm: '2026-09', totalAssetsMinor: 16_000_000, snapshotDate: '2026-09-30' };
    const r = computeCrossCheck(
      base({
        current: cur,
        liveTotalAssetsMinor: 1,
        transactions: [{ date: '2026-09-30', type: 'income', amountMinor: 896_400 }],
      }),
    );
    expect(r.currentMinor).toBe(16_000_000);
    expect(r.windowEnd).toBe('2026-09-30');
    expect(r.currentIsLive).toBe(false);
    expect(r.deviationMinor).toBe(0);
  });

  it('previous.unverified flag বহন করে', () => {
    const r = computeCrossCheck(base({ previous: { ...prev, unverified: true } }));
    expect(r.previousUnverified).toBe(true);
  });
});

describe('factors', () => {
  it('(১) closed investment-এর profit window-এ; window-এর বাইরে closed হলে না', () => {
    const closedIn = inv({
      investedTo: 'A',
      principalMinor: 2_000_000,
      repayments: [
        { date: '2026-05-01', amountMinor: 1_000_000 },
        { date: '2026-09-10', amountMinor: 1_150_000 },
      ],
    });
    const closedBefore = inv({ investedTo: 'B', principalMinor: 100, repayments: [{ date: '2026-03-01', amountMinor: 200 }] });
    const r = computeCrossCheck(base({ investments: [closedIn, closedBefore] }));
    const f = r.factors.find((x) => x.key === 'investmentClosure')!;
    expect(f.effectMinor).toBe(150_000);
    expect(f.detail).toEqual(['A (closed)']);
  });

  it('(১) written_off window-এ হলে Remaining Principal loss (ঋণাত্মক); changedAt null হলে ধরা হয় না', () => {
    const wo = inv({
      investedTo: 'W',
      principalMinor: 3_000_000,
      repayments: [{ date: '2026-02-01', amountMinor: 1_000_000 }],
      investmentOutcome: 'written_off',
      investmentOutcomeChangedAt: '2026-09-05',
    });
    const woOld = inv({ investedTo: 'Old', investmentOutcome: 'written_off', investmentOutcomeChangedAt: null });
    const r = computeCrossCheck(base({ investments: [wo, woOld] }));
    const f = r.factors.find((x) => x.key === 'investmentClosure')!;
    expect(f.effectMinor).toBe(-2_000_000);
    expect(f.detail).toEqual(['W (written off)']);
  });

  it('(২) forgiven owe_me debt-এর outstanding; শুধু window-এর ভেতরে changedAt হলে', () => {
    const inW = debt({ person: 'Sumon', totalAmountMinor: 400_000, repayments: [{ date: '2026-02-01', amountMinor: 100_000 }], receivableStatus: 'forgiven', receivableStatusChangedAt: '2026-09-12' });
    const outW = debt({ person: 'Old', receivableStatus: 'forgiven', receivableStatusChangedAt: '2026-07-01' });
    const undated = debt({ person: 'NoDate', receivableStatus: 'forgiven', receivableStatusChangedAt: null });
    const r = computeCrossCheck(base({ debts: [inW, outW, undated] }));
    const f = r.factors.find((x) => x.key === 'debtForgiven')!;
    expect(f.effectMinor).toBe(-300_000);
    expect(f.detail).toEqual(['Sumon']);
  });

  it('(১) post-closure: আগে closed হওয়া investment-এ পরে window-এ আসা বাড়তি repayment-ও মুনাফা হিসেবে ধরা পড়ে', () => {
    const late = inv({
      investedTo: 'Late',
      principalMinor: 1_000_000,
      repayments: [
        { date: '2026-04-01', amountMinor: 1_050_000 }, // closed এপ্রিলে, মুনাফা ৫০_০০০ (window-এর আগে)
        { date: '2026-09-12', amountMinor: 30_000 }, // পরে দেরিতে বাড়তি
      ],
    });
    const f = computeCrossCheck(base({ investments: [late] })).factors.find((x) => x.key === 'investmentClosure')!;
    expect(f.effectMinor).toBe(30_000);
    expect(f.detail).toEqual(['Late (extra repayment)']);
  });

  it('(১) window-এর মধ্যে principal-এর ভেতরের repayment factor তৈরি করে না (মূলধন transfer, account-এর সাথে কাটাকাটি)', () => {
    const partial = inv({ principalMinor: 1_000_000, repayments: [{ date: '2026-09-15', amountMinor: 400_000 }] });
    const newInv = inv({ investedTo: 'N', date: '2026-09-03', principalMinor: 2_000_000 });
    const r = computeCrossCheck(base({ investments: [partial, newInv] }));
    expect(r.factors).toEqual([]);
  });

  it('(৩) owe_me debt-এ পাওনার বেশি ফেরত: শুধু excess; forgiven ও i_owe বাদ', () => {
    const over = debt({ person: 'Over', totalAmountMinor: 100_000, repayments: [{ date: '2026-09-05', amountMinor: 90_000 }, { date: '2026-09-20', amountMinor: 30_000 }] });
    const exact = debt({ person: 'Exact', totalAmountMinor: 50_000, repayments: [{ date: '2026-09-06', amountMinor: 50_000 }] });
    const iOwe = debt({ person: 'IO', direction: 'i_owe', totalAmountMinor: 10, repayments: [{ date: '2026-09-06', amountMinor: 999 }] });
    const r = computeCrossCheck(base({ debts: [over, exact, iOwe] }));
    const f = r.factors.find((x) => x.key === 'debtExcessRepayment')!;
    expect(f.effectMinor).toBe(20_000);
    expect(f.detail).toEqual(['Over']);
  });

  it('as-of মডেল: ধার-দেওয়া/ইনভেস্টমেন্ট/repayment transfer-এ Deviation ০, কোনো factor/unexplained নেই', () => {
    // Accounts −৫০০_০০০ (ধার দিলাম) + Receivable +৫০০_০০০; Accounts +৪০০_০০০ (repayment) + Running −৪০০_০০০ → নিট ০
    const lend = debt({ person: 'L', totalAmountMinor: 500_000, date: '2026-09-05' });
    const repaid = inv({ principalMinor: 1_000_000, repayments: [{ date: '2026-09-15', amountMinor: 400_000 }] });
    const r = computeCrossCheck(base({ debts: [lend], investments: [repaid], liveTotalAssetsMinor: 15_103_600 }));
    expect(r.deviationMinor).toBe(0);
    expect(r.factors).toEqual([]);
    expect(r.unexplainedMinor).toBe(0);
  });

  it('(৫, DF3) i_owe: নতুন ধার +, শোধ −; owe_me গণ্য হয় না', () => {
    const borrowed = debt({ person: 'B', direction: 'i_owe', totalAmountMinor: 500_000, date: '2026-09-04' });
    const repayOld = debt({ person: 'R', direction: 'i_owe', totalAmountMinor: 900_000, date: '2026-01-01', repayments: [{ date: '2026-09-20', amountMinor: 200_000 }] });
    const lend = debt({ person: 'L', direction: 'owe_me', totalAmountMinor: 300_000, date: '2026-09-05' });
    const r = computeCrossCheck(base({ debts: [borrowed, repayOld, lend] }));
    const f = r.factors.find((x) => x.key === 'iOweChange')!;
    expect(f.effectMinor).toBe(300_000);
    expect(f.detail).toEqual(['B', 'R']);
  });

  it('(৬) GPF change: window-এর নেট পরিবর্তন; window-এর বাইরের entry বাদ; withdrawal −', () => {
    const r = computeCrossCheck(
      base({
        gpfEntries: [
          { date: '2026-08-31', type: 'contribution', amountMinor: 127_400 }, // window-এর আগে (snapshot-এ আছে)
          { date: '2026-09-01', type: 'contribution', amountMinor: 127_400 },
          { date: '2026-09-10', type: 'interest', amountMinor: 3_900 },
          { date: '2026-09-15', type: 'withdrawal', amountMinor: 50_000 },
          { date: '2026-09-25', type: 'contribution', amountMinor: 999 }, // today (09-24)-এর পরে
        ],
        liveTotalAssetsMinor: 15_103_600 + 127_400 + 3_900 - 50_000,
      }),
    );
    const f = r.factors.find((x) => x.key === 'gpfChange')!;
    expect(f.effectMinor).toBe(81_300);
    expect(f.detail).toEqual(['contribution', 'interest', 'withdrawal']);
    expect(r.unexplainedMinor).toBe(0);
  });

  it('(৬) GPF: চলতি snapshot থাকলে window শেষ = তার snapshotDate', () => {
    const cur = { yyyymm: '2026-09', totalAssetsMinor: 15_103_600 + 127_400, snapshotDate: '2026-09-05' };
    const r = computeCrossCheck(
      base({
        current: cur,
        gpfEntries: [
          { date: '2026-09-01', type: 'contribution', amountMinor: 127_400 },
          { date: '2026-09-20', type: 'contribution', amountMinor: 127_400 }, // snapshot-এর পরে — বাদ
        ],
      }),
    );
    expect(r.factors.find((x) => x.key === 'gpfChange')!.effectMinor).toBe(127_400);
    expect(r.unexplainedMinor).toBe(0);
  });

  it('unexplained = deviation − Σ factors', () => {
    const borrowed = debt({ direction: 'i_owe', totalAmountMinor: 500_000, date: '2026-09-04' });
    const r = computeCrossCheck(base({ debts: [borrowed], liveTotalAssetsMinor: 15_103_600 + 500_000 + 40 }));
    expect(r.deviationMinor).toBe(500_040);
    expect(r.unexplainedMinor).toBe(40);
  });

  it('factor না থাকলে factors ফাঁকা', () => {
    expect(computeCrossCheck(base()).factors).toEqual([]); // GPF entry না থাকলে gpfChange factor-ও নেই
  });
});

describe('lateSnapshotDates (৪র্থ context-নোট)', () => {
  it('মাস-শেষ থেকে ৩ দিনের বেশি দূরের তারিখই শুধু flag; অন্য মাসের balance বাদ', () => {
    const r = computeCrossCheck(
      base({
        period: '2026-09',
        periodBalances: [
          { yyyymm: '2026-09', snapshotDate: '2026-09-28' }, // ২ দিন — ঠিক
          { yyyymm: '2026-09', snapshotDate: '2026-09-24' }, // ৬ দিন — flag
          { yyyymm: '2026-08', snapshotDate: '2026-08-05' }, // অন্য মাস
        ],
      }),
    );
    expect(r.lateSnapshotDates).toEqual(['2026-09-24']);
  });
});

describe('pickSnapshotPair', () => {
  const s = (yyyymm: string) => ({ yyyymm, totalAssetsMinor: 1, snapshotDate: `${yyyymm}-28` });
  it('period-এর doc থাকলে current=সেটা, previous=আগের সর্বশেষ', () => {
    const { previous, current } = pickSnapshotPair([s('2026-07'), s('2026-09'), s('2026-08')], '2026-09');
    expect(current?.yyyymm).toBe('2026-09');
    expect(previous?.yyyymm).toBe('2026-08');
  });
  it('period-এর doc না থাকলে current=null (live), previous=সর্বশেষ doc', () => {
    const { previous, current } = pickSnapshotPair([s('2026-08')], '2026-09');
    expect(current).toBeNull();
    expect(previous?.yyyymm).toBe('2026-08');
  });
  it('কোনো আগের snapshot না থাকলে previous=null', () => {
    expect(pickSnapshotPair([], '2026-09').previous).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { calcZakat, nisabMinorFor, zakatOf, type ZakatInput } from './zakatCalc';

const ASOF = '2026-11-30';
const base = (over: Partial<ZakatInput> = {}): ZakatInput => ({
  asOf: ASOF,
  settings: { nisabStandard: 'silver', goldPriceMinor: 1_200_000, silverPriceMinor: 20_000 },
  accounts: [],
  debts: [],
  investments: [],
  funds: [],
  deposits: [],
  assets: [],
  ...over,
});
const inv = (o: Partial<ZakatInput['investments'][number]> = {}) => ({
  date: '2026-01-01',
  principalMinor: 5_000_000,
  repayments: [] as { date: string; amountMinor: number }[],
  investmentOutcome: 'running' as const,
  investmentOutcomeChangedAt: null,
  zakatable: true,
  ...o,
});

describe('nisab', () => {
  it('রূপা ৬১২.৩৬ গ্রাম, সোনা ৮৭.৪৮ গ্রাম', () => {
    expect(nisabMinorFor('silver', base().settings)).toBe(12_247_200);
    expect(nisabMinorFor('gold', base().settings)).toBe(104_976_000);
  });
  it('দাম না থাকলে null', () => {
    expect(nisabMinorFor('silver', { nisabStandard: null, goldPriceMinor: null, silverPriceMinor: null })).toBeNull();
    expect(nisabMinorFor('silver', { nisabStandard: null, goldPriceMinor: 5, silverPriceMinor: 0 })).toBeNull();
  });
  it('standard না বাছলে ডিফল্ট রূপা', () => {
    const r = calcZakat(base({ settings: { nisabStandard: null, goldPriceMinor: null, silverPriceMinor: 20_000 } }));
    expect(r.nisabStandard).toBe('silver');
    expect(r.nisabMinor).toBe(12_247_200);
  });
});

describe('calcZakat — উপাদান', () => {
  it('শুধু zakatable account ধরে', () => {
    const r = calcZakat(base({ accounts: [{ zakatable: true, balanceMinor: 10_000_000 }, { zakatable: false, balanceMinor: 5_000_000 }] }));
    expect(r.accountsMinor).toBe(10_000_000);
  });

  it('পাওনা: Active-এর অশোধিত অংশ; Doubtful ও Written-off বাদ', () => {
    const owed = {
      direction: 'owe_me' as const,
      date: '2026-01-01',
      totalAmountMinor: 3_000_000,
      borrowings: [
        { id: 'a', date: '2026-01-01', amountMinor: 2_000_000 },
        { id: 'b', date: '2026-02-01', amountMinor: 1_000_000, status: 'doubtful' as const, statusChangedAt: null },
      ],
      repayments: [{ date: '2026-03-01', amountMinor: 500_000 }],
    };
    const wo = { direction: 'owe_me' as const, date: '2026-01-01', totalAmountMinor: 700_000, repayments: [], receivableStatus: 'forgiven' as const };
    const r = calcZakat(base({ debts: [owed, wo] }));
    expect(r.receivableMinor).toBe(1_500_000);
    expect(r.doubtfulReceivableMinor).toBe(1_000_000);
  });

  it('Doubtful-এর তারিখ asOf-এর পরে হলে তখনো Active ধরা হয়', () => {
    const d = {
      direction: 'owe_me' as const,
      date: '2026-01-01',
      totalAmountMinor: 100,
      borrowings: [{ id: 'a', date: '2026-01-01', amountMinor: 100, status: 'doubtful' as const, statusChangedAt: '2026-12-15' }],
      repayments: [],
    };
    const r = calcZakat(base({ debts: [d] }));
    expect(r.receivableMinor).toBe(100);
    expect(r.doubtfulReceivableMinor).toBe(0);
  });

  it('i_owe বকেয়া বিয়োগ হয় (শোধ বাদে)', () => {
    const d = { direction: 'i_owe' as const, date: '2026-01-01', totalAmountMinor: 400_000, repayments: [{ date: '2026-02-01', amountMinor: 100_000 }] };
    const r = calcZakat(base({ debts: [d], accounts: [{ zakatable: true, balanceMinor: 1_000_000 }] }));
    expect(r.iOweMinor).toBe(300_000);
    expect(r.netMinor).toBe(700_000);
  });

  it('ইনভেস্টমেন্ট: running+zakatable-এর মূলধনের অশোধিত অংশ; doubtful/written-off/non-zakatable/ভবিষ্যৎ বাদ', () => {
    const r = calcZakat(
      base({
        investments: [
          inv({ repayments: [{ date: '2026-05-01', amountMinor: 2_000_000 }] }), // 3,000,000
          inv({ principalMinor: 2_000_000, investmentOutcome: 'doubtful' }),
          inv({ investmentOutcome: 'written_off' }),
          inv({ zakatable: false }),
          inv({ date: '2026-12-05' }),
          inv({ principalMinor: 1_000_000, repayments: [{ date: '2026-12-01', amountMinor: 1_000_000 }] }), // শোধ asOf-এর পরে → পুরোটাই বাকি
        ],
      }),
    );
    expect(r.investmentMinor).toBe(3_000_000 + 1_000_000);
    expect(r.doubtfulInvestmentMinor).toBe(2_000_000);
  });

  it('ফেরতের বেশি শোধ হলে ঋণাত্মক হয় না (০-তে ক্ল্যাম্প)', () => {
    const r = calcZakat(base({ investments: [inv({ principalMinor: 100, repayments: [{ date: '2026-02-01', amountMinor: 500 }] })] }));
    expect(r.investmentMinor).toBe(0);
  });

  it('Home Deposit: শুধু zakatable fund-এর নেট (asOf পর্যন্ত)', () => {
    const r = calcZakat(
      base({
        funds: [{ id: 'f1', zakatable: true }, { id: 'f2', zakatable: false }],
        deposits: [
          { fundId: 'f1', date: '2026-01-01', type: 'deposit', amountMinor: 1_000_000 },
          { fundId: 'f1', date: '2026-02-01', type: 'withdrawal', amountMinor: 200_000 },
          { fundId: 'f1', date: '2026-12-10', type: 'deposit', amountMinor: 999 },
          { fundId: 'f2', date: '2026-01-01', type: 'deposit', amountMinor: 500_000 },
        ],
      }),
    );
    expect(r.homeDepositMinor).toBe(800_000);
  });
});

describe('calcZakat — সম্পদ, Nisab ও ফল', () => {
  const full = (): ZakatInput =>
    base({
      accounts: [{ zakatable: true, balanceMinor: 10_000_000 }],
      debts: [
        { direction: 'owe_me', date: '2026-01-01', totalAmountMinor: 1_500_000, repayments: [] },
        { direction: 'i_owe', date: '2026-01-01', totalAmountMinor: 300_000, repayments: [] },
      ],
      investments: [inv({ principalMinor: 3_000_000 })],
      funds: [{ id: 'f1', zakatable: true }],
      deposits: [{ fundId: 'f1', date: '2026-01-01', type: 'deposit', amountMinor: 800_000 }],
      assets: [
        { category: 'goldJewelry', zakatable: true, weightGrams: 10, valueMinor: null, irrigationMethod: null }, // 12,000,000
        { category: 'silverJewelry', zakatable: true, weightGrams: 100, valueMinor: null, irrigationMethod: null }, // 2,000,000
        { category: 'other', zakatable: true, weightGrams: null, valueMinor: 500_000, irrigationMethod: null },
        { category: 'other', zakatable: false, weightGrams: null, valueMinor: 9_999_999, irrigationMethod: null },
      ],
    });

  it('রূপার Nisab-এ যাকাত বকেয়া: নেট × ২.৫%', () => {
    const r = calcZakat(full());
    expect(r.jewelryMinor).toBe(14_000_000);
    expect(r.grossMinor).toBe(29_800_000);
    expect(r.netMinor).toBe(29_500_000);
    expect(r.status).toBe('due');
    expect(r.zakatMinor).toBe(737_500);
  });

  it('সোনার Nisab-এ একই সম্পদ Nisab-এর নিচে → যাকাত ০', () => {
    const i = full();
    const r = calcZakat({ ...i, settings: { ...i.settings, nisabStandard: 'gold' } });
    expect(r.status).toBe('below_nisab');
    expect(r.zakatMinor).toBe(0);
  });

  it('দাম না থাকলে needs_price, যাকাত ০', () => {
    const i = full();
    const r = calcZakat({ ...i, settings: { nisabStandard: 'silver', goldPriceMinor: 1_200_000, silverPriceMinor: null } });
    expect(r.status).toBe('needs_price');
    expect(r.nisabMinor).toBeNull();
    expect(r.zakatMinor).toBe(0);
  });

  it('গহনার দাম না থাকলে মূল্য ধরা হয় না, সংখ্যা জানানো হয়', () => {
    const r = calcZakat(
      base({
        settings: { nisabStandard: 'silver', goldPriceMinor: null, silverPriceMinor: 20_000 },
        assets: [{ category: 'goldJewelry', zakatable: true, weightGrams: 10, valueMinor: null, irrigationMethod: null }],
      }),
    );
    expect(r.jewelryMinor).toBe(0);
    expect(r.missingPriceCount).toBe(1);
  });

  it('সম্পদ Nisab-এর ঠিক সমান হলে যাকাত বকেয়া', () => {
    const r = calcZakat(base({ accounts: [{ zakatable: true, balanceMinor: 12_247_200 }] }));
    expect(r.status).toBe('due');
    expect(r.zakatMinor).toBe(306_180);
  });

  it('i_owe বেশি হলে নেট ঋণাত্মক, যাকাত ০', () => {
    const r = calcZakat(base({ debts: [{ direction: 'i_owe', date: '2026-01-01', totalAmountMinor: 500, repayments: [] }] }));
    expect(r.netMinor).toBe(-500);
    expect(r.zakatMinor).toBe(0);
  });
});

describe('উশর (আলাদা, Nisab নেই)', () => {
  it('বৃষ্টিনির্ভর ১০%, সেচনির্ভর ৫%; ধরন না বাছলে বাদ + সংখ্যা', () => {
    const r = calcZakat(
      base({
        assets: [
          { category: 'agriculturalProduce', zakatable: true, weightGrams: null, valueMinor: 1_000_000, irrigationMethod: 'rainfed' },
          { category: 'agriculturalProduce', zakatable: true, weightGrams: null, valueMinor: 600_000, irrigationMethod: 'irrigated' },
          { category: 'agriculturalProduce', zakatable: true, weightGrams: null, valueMinor: 400_000, irrigationMethod: null },
          { category: 'agriculturalProduce', zakatable: false, weightGrams: null, valueMinor: 999_999, irrigationMethod: 'rainfed' },
        ],
      }),
    );
    expect(r.ushrMinor).toBe(130_000);
    expect(r.ushrMissingMethodCount).toBe(1);
    expect(r.grossMinor).toBe(0); // ফসল al-Mal বেসে যায় না
  });
});

describe('zakatOf', () => {
  it('২.৫% round-half-up; ঋণাত্মক/০ → ০', () => {
    expect(zakatOf(1_000_000)).toBe(25_000);
    expect(zakatOf(10)).toBe(0); // 0.25 → 0
    expect(zakatOf(20)).toBe(1); // 0.5 → 1
    expect(zakatOf(-5)).toBe(0);
  });
});

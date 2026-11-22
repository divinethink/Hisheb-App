// Zakat হিসাব — pure, platform-independent (lib/ purity; Architecture Plan §১২)।
// Net Worth-এর Total Assets সরাসরি নেওয়া হয় না: উপাদান ধরে আলাদা নিয়মে গণনা।
// ⚠️ GPF ইচ্ছাকৃতভাবে কোনো ইনপুটেই নেই (owner-সিদ্ধান্ত, DF13) — বাড়তি অংশ ধরতে চাইলে zakatAssets-এ category "other" হিসেবে হাতে যোগ।
// ⚠️ account ও ledger-অংশ একই asOf তারিখে (Net Worth-এর liveBasisDate) — নইলে ইনভেস্টমেন্টের টাকা একবার বেশি/কম ধরা পড়ে।
import { lineViews, type DebtLinesInput } from './debtCalc';
import { depositNetAsOfMinor } from './ledgerAsOf';

/** Nisab (গ্রাম) — সোনা ৭.৫ ভরি, রূপা ৫২.৫ ভরি (১ ভরি = ১১.৬৬ গ্রাম) */
export const NISAB_GOLD_GRAMS = 87.48;
export const NISAB_SILVER_GRAMS = 612.36;
export const ZAKAT_RATE_PERMILLE = 25; // ২.৫%

export type NisabStandard = 'gold' | 'silver';
export type ZakatAssetCategory = 'goldJewelry' | 'silverJewelry' | 'agriculturalProduce' | 'other';
export type IrrigationMethod = 'rainfed' | 'irrigated';

export interface ZakatAccountInput {
  zakatable: boolean;
  /** asOf-এর সর্বশেষ balance snapshot (latestBalanceByAccount) */
  balanceMinor: number;
}
export type ZakatDebtInput = DebtLinesInput & {
  direction: 'owe_me' | 'i_owe';
  date: string;
};
export interface ZakatInvestmentInput {
  date: string;
  principalMinor: number;
  repayments: readonly { date: string; amountMinor: number }[];
  investmentOutcome: 'running' | 'doubtful' | 'written_off';
  investmentOutcomeChangedAt: string | null;
  zakatable: boolean;
}
export interface ZakatFundInput {
  id: string;
  zakatable: boolean;
}
export interface ZakatDepositInput {
  fundId: string;
  date: string;
  type: 'deposit' | 'withdrawal';
  amountMinor: number;
}
export interface ZakatAssetInput {
  category: ZakatAssetCategory;
  zakatable: boolean;
  weightGrams: number | null;
  valueMinor: number | null;
  irrigationMethod: IrrigationMethod | null;
}
export interface ZakatSettingsInput {
  nisabStandard: NisabStandard | null;
  /** পয়সা প্রতি গ্রাম */
  goldPriceMinor: number | null;
  silverPriceMinor: number | null;
}

export interface ZakatInput {
  asOf: string;
  settings: ZakatSettingsInput;
  accounts: readonly ZakatAccountInput[];
  debts: readonly ZakatDebtInput[];
  investments: readonly ZakatInvestmentInput[];
  funds: readonly ZakatFundInput[];
  deposits: readonly ZakatDepositInput[];
  assets: readonly ZakatAssetInput[];
}

export type ZakatStatus = 'needs_price' | 'below_nisab' | 'due';

export interface ZakatResult {
  // যাকাতযোগ্য উপাদান
  accountsMinor: number;
  receivableMinor: number;
  investmentMinor: number;
  homeDepositMinor: number;
  jewelryMinor: number;
  otherAssetsMinor: number;
  grossMinor: number;
  iOweMinor: number;
  netMinor: number;
  // Nisab ও ফল
  nisabStandard: NisabStandard;
  nisabMinor: number | null;
  status: ZakatStatus;
  zakatMinor: number;
  // তথ্য: ইচ্ছাকৃতভাবে বাদ পড়া (যাচাইয়ের জন্য দেখানো যায়)
  doubtfulReceivableMinor: number;
  doubtfulInvestmentMinor: number;
  /** দাম না থাকায় মূল্য বসানো যায়নি এমন গহনার সংখ্যা */
  missingPriceCount: number;
  // উশর (আলাদা নিয়ম, Nisab/Hawl নেই — হানাফি)
  ushrMinor: number;
  /** সেচের ধরন না বাছা ফসলের সংখ্যা — এগুলোর উশর ধরা হয়নি */
  ushrMissingMethodCount: number;
}

const paidUpTo = (rs: readonly { date: string; amountMinor: number }[], asOf: string): number =>
  rs.filter((r) => r.date <= asOf).reduce((s, r) => s + r.amountMinor, 0);

/** status-বদলের তারিখ asOf-এর পরে হলে তখনো কার্যকর হয়নি (null = সবসময় কার্যকর) */
const inEffect = (changedAt: string | null | undefined, asOf: string): boolean => changedAt == null || changedAt <= asOf;

/** গ্রাম × দাম (পয়সা/গ্রাম) → পয়সা, পূর্ণসংখ্যায় round */
export function valueFromWeightMinor(grams: number, pricePerGramMinor: number): number {
  return Math.round(grams * pricePerGramMinor);
}

export function nisabMinorFor(standard: NisabStandard, s: ZakatSettingsInput): number | null {
  const price = standard === 'gold' ? s.goldPriceMinor : s.silverPriceMinor;
  if (price == null || price <= 0) return null;
  return valueFromWeightMinor(standard === 'gold' ? NISAB_GOLD_GRAMS : NISAB_SILVER_GRAMS, price);
}

/** ২.৫% — পয়সায় round-half-up */
export const zakatOf = (netMinor: number): number => (netMinor <= 0 ? 0 : Math.round((netMinor * ZAKAT_RATE_PERMILLE) / 1000));

export function calcZakat(input: ZakatInput): ZakatResult {
  const { asOf, settings } = input;
  // বাংলাদেশে সর্বাধিক প্রচলিত: রূপার Nisab — owner না বাছলে ডিফল্ট রূপা
  const standard: NisabStandard = settings.nisabStandard ?? 'silver';

  const accountsMinor = input.accounts.filter((a) => a.zakatable).reduce((s, a) => s + a.balanceMinor, 0);

  // পাওনা: শুধু Active লাইনের অশোধিত অংশ; Doubtful ও Written-off বাদ
  let receivableMinor = 0;
  let doubtfulReceivableMinor = 0;
  let iOweMinor = 0;
  for (const d of input.debts) {
    if (d.direction === 'i_owe') {
      iOweMinor += lineViews(d, asOf).reduce((s, v) => s + v.outstandingMinor, 0);
      continue;
    }
    if (d.date > asOf && (d.borrowings?.length ?? 0) === 0) continue;
    for (const v of lineViews(d, asOf)) {
      if (v.excluded) continue; // written-off
      if (v.status === 'doubtful' && inEffect(v.statusChangedAt, asOf)) doubtfulReceivableMinor += v.outstandingMinor;
      else receivableMinor += v.outstandingMinor;
    }
  }

  // চলমান ইনভেস্টমেন্ট: মূলধনের অশোধিত অংশ (running + zakatable); মুনাফা হাতে এলে account-এ ধরা পড়ে, আলাদা যোগ নয়
  let investmentMinor = 0;
  let doubtfulInvestmentMinor = 0;
  for (const i of input.investments) {
    if (i.date > asOf) continue;
    const remaining = Math.max(0, i.principalMinor - paidUpTo(i.repayments, asOf));
    const outcome = inEffect(i.investmentOutcomeChangedAt, asOf) ? i.investmentOutcome : 'running';
    if (outcome === 'written_off') continue;
    if (outcome === 'doubtful') {
      doubtfulInvestmentMinor += remaining;
      continue;
    }
    if (i.zakatable) investmentMinor += remaining;
  }

  const homeDepositMinor = input.funds
    .filter((f) => f.zakatable)
    .reduce((s, f) => s + Math.max(0, depositNetAsOfMinor(input.deposits.filter((e) => e.fundId === f.id), asOf)), 0);

  // অতিরিক্ত সম্পদ ও উশর
  let jewelryMinor = 0;
  let otherAssetsMinor = 0;
  let missingPriceCount = 0;
  let ushrMinor = 0;
  let ushrMissingMethodCount = 0;
  for (const a of input.assets) {
    if (!a.zakatable) continue;
    if (a.category === 'goldJewelry' || a.category === 'silverJewelry') {
      const price = a.category === 'goldJewelry' ? settings.goldPriceMinor : settings.silverPriceMinor;
      if (a.weightGrams != null && a.weightGrams > 0 && price != null && price > 0) {
        jewelryMinor += valueFromWeightMinor(a.weightGrams, price);
      } else if (a.valueMinor != null && a.valueMinor > 0 && (a.weightGrams == null || a.weightGrams <= 0)) {
        jewelryMinor += a.valueMinor;
      } else {
        missingPriceCount++;
      }
    } else if (a.category === 'agriculturalProduce') {
      const v = a.valueMinor ?? 0;
      if (a.irrigationMethod === 'rainfed') ushrMinor += Math.round(v / 10);
      else if (a.irrigationMethod === 'irrigated') ushrMinor += Math.round(v / 20);
      else if (v > 0) ushrMissingMethodCount++;
    } else {
      otherAssetsMinor += a.valueMinor ?? 0;
    }
  }

  const grossMinor = accountsMinor + receivableMinor + investmentMinor + homeDepositMinor + jewelryMinor + otherAssetsMinor;
  const netMinor = grossMinor - iOweMinor;
  const nisabMinor = nisabMinorFor(standard, settings);
  const status: ZakatStatus = nisabMinor === null ? 'needs_price' : netMinor >= nisabMinor ? 'due' : 'below_nisab';

  return {
    accountsMinor,
    receivableMinor,
    investmentMinor,
    homeDepositMinor,
    jewelryMinor,
    otherAssetsMinor,
    grossMinor,
    iOweMinor,
    netMinor,
    nisabStandard: standard,
    nisabMinor,
    status,
    zakatMinor: status === 'due' ? zakatOf(netMinor) : 0,
    doubtfulReceivableMinor,
    doubtfulInvestmentMinor,
    missingPriceCount,
    ushrMinor,
    ushrMissingMethodCount,
  };
}

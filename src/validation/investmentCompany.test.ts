import { describe, expect, it } from 'vitest';
import { InvestmentSchema } from './investmentSchema';
import {
  InvestmentCompanyInputSchema,
  InvestmentCompanySchema,
  LOGO_MAX_CHARS,
  safeLogo,
} from './investmentCompanySchema';

const LOGO = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
const oldDoc = { id: 'i1', date: '2026-10-15', investedTo: 'Apon Bazaar [9]', principalMinor: 1000000 };

describe('InvestmentSchema — ধাপ ১ additive ফিল্ড', () => {
  it('পুরনো doc (ফিল্ড নেই) আগের মতোই পার্স হয়: companyId/round null, platformNo ফাঁকা, নাম অক্ষত', () => {
    const r = InvestmentSchema.parse(oldDoc);
    expect(r.companyId).toBeNull();
    expect(r.round).toBeNull();
    expect(r.platformNo).toBe('');
    expect(r.investedTo).toBe('Apon Bazaar [9]');
  });
  it('নতুন ফিল্ড পার্স হয়', () => {
    const r = InvestmentSchema.parse({ ...oldDoc, companyId: 'c1', round: 9, platformNo: '74874' });
    expect(r.companyId).toBe('c1');
    expect(r.round).toBe(9);
    expect(r.platformNo).toBe('74874');
  });
  it('round ধনাত্মক পূর্ণসংখ্যা ছাড়া অগ্রাহ্য', () => {
    expect(InvestmentSchema.safeParse({ ...oldDoc, round: 0 }).success).toBe(false);
    expect(InvestmentSchema.safeParse({ ...oldDoc, round: 1.5 }).success).toBe(false);
    expect(InvestmentSchema.safeParse({ ...oldDoc, round: null }).success).toBe(true);
  });
  it('platformNo ৩০ অক্ষরের বেশি অগ্রাহ্য', () => {
    expect(InvestmentSchema.safeParse({ ...oldDoc, platformNo: 'x'.repeat(31) }).success).toBe(false);
  });
});

describe('InvestmentCompanySchema', () => {
  it('ন্যূনতম doc: medium ফাঁকা, logo null', () => {
    const c = InvestmentCompanySchema.parse({ id: 'c1', name: 'Apon Bazaar' });
    expect(c.medium).toBe('');
    expect(c.logo).toBeNull();
  });
  it('নাম ফাঁকা/৬০+ অগ্রাহ্য', () => {
    expect(InvestmentCompanySchema.safeParse({ id: 'c1', name: '' }).success).toBe(false);
    expect(InvestmentCompanySchema.safeParse({ id: 'c1', name: 'x'.repeat(61) }).success).toBe(false);
  });
  it('পড়ায় নমনীয়: খারাপ logo থাকলেও doc পার্স হয়, তবে safeLogo null দেয়', () => {
    const c = InvestmentCompanySchema.parse({ id: 'c1', name: 'A', logo: 'https://x/y.png' });
    expect(safeLogo(c.logo)).toBeNull();
  });
});

describe('InvestmentCompanyInputSchema (লেখার সময় কড়া)', () => {
  it('নাম trim, medium ডিফল্ট ফাঁকা, logo ঐচ্ছিক', () => {
    const r = InvestmentCompanyInputSchema.parse({ name: '  Apon Bazaar ' });
    expect(r.name).toBe('Apon Bazaar');
    expect(r.medium).toBe('');
    expect(r.logo).toBeNull();
  });
  it('বৈধ webp data-URL গ্রহণ', () => {
    expect(InvestmentCompanyInputSchema.safeParse({ name: 'A', logo: LOGO }).success).toBe(true);
  });
  it('svg / বাইরের URL / অতি-বড় logo অগ্রাহ্য', () => {
    expect(InvestmentCompanyInputSchema.safeParse({ name: 'A', logo: 'data:image/svg+xml;base64,PHN2Zz4=' }).success).toBe(false);
    expect(InvestmentCompanyInputSchema.safeParse({ name: 'A', logo: 'https://evil.example/x.png' }).success).toBe(false);
    const big = 'data:image/webp;base64,' + 'A'.repeat(LOGO_MAX_CHARS);
    expect(InvestmentCompanyInputSchema.safeParse({ name: 'A', logo: big }).success).toBe(false);
  });
});

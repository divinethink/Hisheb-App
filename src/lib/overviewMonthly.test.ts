import { describe, it, expect } from 'vitest';
import { bigOneOffs, targetGap, addDays, dailyExpense, leakFinder, monthReport, noSpendCalendar, spendPer100, weekdayIndex, weekdaySpend, type TxLite } from './overviewCalc';

const tx = (date: string, type: 'income' | 'expense', amountMinor: number, categoryName = 'A'): TxLite => ({ date, type, amountMinor, categoryName });
const fmt = (m: number) => `৳${m / 100}`;

describe('তারিখ-হেল্পার', () => {
  it('addDays মাস/বছর পেরোয়', () => {
    expect(addDays('2026-10-29', 3)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('weekdayIndex: শনি=0, শুক্র=6', () => {
    expect(weekdayIndex('2026-10-24')).toBe(0); // শনিবার
    expect(weekdayIndex('2026-10-30')).toBe(6); // শুক্রবার
  });
});

describe('spendPer100', () => {
  it('আয় ০ → null', () => {
    expect(spendPer100([tx('2026-10-01', 'expense', 100)])).toBeNull();
  });
  it('খরচ ≤ আয় হলে যোগফল ঠিক ১০০ ও সঞ্চয় আছে', () => {
    const txs = [tx('2026-10-01', 'income', 30000), tx('2026-10-02', 'expense', 10000, 'X'), tx('2026-10-03', 'expense', 10000, 'Y'), tx('2026-10-04', 'expense', 3333, 'Z')];
    const r = spendPer100(txs)!;
    expect(r.segments.reduce((a, s) => a + s.value, 0)).toBe(100);
    expect(r.savingsPer100).toBe(r.segments.find((s) => s.kind === 'savings')!.value);
    expect(r.overspendMinor).toBe(0);
  });
  it('শীর্ষ ৫-এর বাইরে "অন্যান্য"', () => {
    const txs = [tx('2026-10-01', 'income', 100000), ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((c, i) => tx('2026-10-02', 'expense', 1000 * (10 - i), c))];
    const r = spendPer100(txs)!;
    expect(r.segments.filter((s) => s.kind === 'category')).toHaveLength(5);
    expect(r.segments.some((s) => s.kind === 'others')).toBe(true);
  });
  it('খরচ > আয় → সঞ্চয় সেগমেন্ট নেই, ঘাটতি জানায়', () => {
    const r = spendPer100([tx('2026-10-01', 'income', 10000), tx('2026-10-02', 'expense', 15000, 'X')])!;
    expect(r.savingsPer100).toBeNull();
    expect(r.overspendMinor).toBe(5000);
    expect(r.segments.some((s) => s.kind === 'savings')).toBe(false);
    // ঘাটতিতে ভিত্তি = খরচ, যোগফল ঠিক ১০০ (আয়-ভিত্তিতে ১৫০ হয়ে যেত)
    expect(r.basis).toBe('expense');
    expect(r.segments.reduce((a, s) => a + s.value, 0)).toBe(100);
  });
  it('সঞ্চয় থাকলে ভিত্তি আয়', () => {
    expect(spendPer100([tx('2026-10-01', 'income', 10000), tx('2026-10-02', 'expense', 4000, 'X')])!.basis).toBe('income');
  });
});

describe('leakFinder', () => {
  const many = (cat: string, n: number, amt: number) => Array.from({ length: n }, (_, i) => tx(`2026-10-${String((i % 28) + 1).padStart(2, '0')}`, 'expense', amt, cat));
  it('বেশি বার + ছোট গড় ধরে; কম বার বা বড় গড় বাদ; মোটের বড় আগে', () => {
    const txs = [...many('চা', 20, 5000), ...many('রিকশা', 10, 6000), ...many('খাবার', 30, 40000), ...many('বিল', 3, 1000)];
    const r = leakFinder(txs);
    expect(r.map((x) => x.name)).toEqual(['চা', 'রিকশা']);
    expect(r[0]).toMatchObject({ count: 20, totalMinor: 100000, avgMinor: 5000 });
  });
  it('প্রয়োজনীয় খাত বাদ (নাম মেলানো case/space-নিরপেক্ষ)', () => {
    const txs = [...many('চা', 20, 5000), ...many('Groceries', 10, 6000)];
    expect(leakFinder(txs, 3, [' groceries ']).map((x) => x.name)).toEqual(['চা']);
    expect(leakFinder(txs, 3, []).map((x) => x.name)).toEqual(['চা', 'Groceries']);
  });
  it('income গোনে না', () => {
    expect(leakFinder(Array.from({ length: 10 }, () => tx('2026-10-01', 'income', 100)))).toEqual([]);
  });
});

describe('weekdaySpend', () => {
  it('প্রতি বারের গড় (শূন্য দিন সহ) ও peak', () => {
    // 2026-10-24 শনি ... জানালা ২১ দিন (৩ সপ্তাহ), শুক্রবারে ২১০০০ মোট (৩ শুক্র) = গড় ৭০০০, বাকি দিনে ১০০০ করে প্রতি দিন
    const end = '2026-10-30'; // শুক্র
    const txs: TxLite[] = [];
    for (let i = 0; i < 21; i++) {
      const d = addDays(end, -i);
      txs.push(tx(d, 'expense', weekdayIndex(d) === 6 ? 7000 : 1000));
    }
    const r = weekdaySpend(txs, end, 21)!;
    expect(r.daysCovered).toBe(21);
    expect(r.avgMinor[6]).toBe(7000);
    expect(r.avgMinor[0]).toBe(1000);
    expect(r.peak).toMatchObject({ index: 6, avgMinor: 7000 });
    expect(r.peak!.ratio).toBeCloseTo(7, 5);
  });
  it('প্রথম লেনদেনের আগের দিন গড়ে ধরে না', () => {
    const r = weekdaySpend([tx('2026-10-28', 'expense', 3000), tx('2026-10-29', 'expense', 3000)], '2026-10-30', 90)!;
    expect(r.daysCovered).toBe(3);
  });
  it('জানালায় লেনদেন না থাকলে null; peak কম হলে null', () => {
    expect(weekdaySpend([], '2026-10-30')).toBeNull();
    const flat = Array.from({ length: 14 }, (_, i) => tx(addDays('2026-10-30', -i), 'expense', 1000));
    expect(weekdaySpend(flat, '2026-10-30', 14)!.peak).toBeNull();
  });
  it('ডিফল্ট থ্রেশহোল্ড ১.৫: ১.৩× peak ধরা হয় না, ২× ধরা হয়', () => {
    const mk = (peakAmt: number) => Array.from({ length: 14 }, (_, i) => {
      const d = addDays('2026-10-30', -i);
      return tx(d, 'expense', weekdayIndex(d) === 6 ? peakAmt : 1000);
    });
    expect(weekdaySpend(mk(1300), '2026-10-30', 14)!.peak).toBeNull();
    expect(weekdaySpend(mk(2000), '2026-10-30', 14)!.peak?.index).toBe(6);
  });
});

describe('noSpendCalendar', () => {
  const txs = [tx('2026-10-01', 'expense', 1000), tx('2026-10-04', 'expense', 100), tx('2026-10-05', 'expense', 5000), tx('2026-10-06', 'income', 9999)];
  it('শূন্য-খরচ দিন, স্তর, আগামী দিন', () => {
    const c = noSpendCalendar(txs, '2026-10', '2026-10-07');
    expect(c.days).toHaveLength(31);
    expect(c.days[0].level).not.toBe('none'); // ১ তারিখে খরচ
    expect(c.days[1].level).toBe('none'); // ২
    expect(c.days[5].level).toBe('none'); // ৬ — শুধু income, তাই নো-স্পেন্ড
    expect(c.days[7].level).toBe('future');
    expect(c.days[3].level).toBe('low');
    expect(c.days[4].level).toBe('high');
  });
  it('গণনা ও টানা: ২-৩ তারিখ (২ দিন), ৬-৭ তারিখ (২ দিন, চলতি)', () => {
    const c = noSpendCalendar(txs, '2026-10', '2026-10-07');
    // ৭ তারিখ (আজ) এখনো চলছে — গোনা হয় না: ২,৩,৬ = ৩ দিন; টানা ২-৩ (২), চলতি ৬ (১)
    expect(c.noSpendCount).toBe(3);
    expect(c.bestStreak).toBe(2);
    expect(c.currentStreak).toBe(1);
  });
  it('আজ খরচ-শূন্য হলে "today", খরচ থাকলে সাধারণ স্তর; আজ টানা ভাঙে না', () => {
    const c = noSpendCalendar(txs, '2026-10', '2026-10-07');
    expect(c.days[6].level).toBe('today');
    const c2 = noSpendCalendar([...txs, tx('2026-10-07', 'expense', 100)], '2026-10', '2026-10-07');
    expect(c2.days[6].level).not.toBe('today');
    expect(c2.currentStreak).toBe(0);
  });
  it('পুরনো মাসে চলতি-টানা ০, সব দিন গোনা', () => {
    const c = noSpendCalendar(txs, '2026-10', '2026-11-15');
    expect(c.days.every((d) => d.level !== 'future')).toBe(true);
    expect(c.currentStreak).toBe(0);
    expect(c.bestStreak).toBe(26); // ৬-৩১
  });
});

describe('monthReport', () => {
  const cur = [tx('2026-10-01', 'income', 100000), tx('2026-10-02', 'expense', 40000, 'খাবার'), tx('2026-10-03', 'expense', 40000, 'ভাড়া')];
  const prev = [tx('2026-09-01', 'income', 100000), tx('2026-09-02', 'expense', 40000, 'খাবার'), tx('2026-09-03', 'expense', 40000, 'ভাড়া')];
  const flat = (l: ReturnType<typeof monthReport>[number]) => l.map((p) => p.text).join('');
  it('খরচ কম + টার্গেটের নিচে', () => {
    const lines = monthReport([tx('2026-10-01', 'income', 100000), tx('2026-10-02', 'expense', 72000, 'খাবার')], [tx('2026-09-02', 'expense', 80000, 'খাবার')], 40, fmt);
    expect(flat(lines[0])).toBe('খরচ গত মাসের চেয়ে 10% কম, কিন্তু সঞ্চয় টার্গেটের (40%) 12 পয়েন্ট নিচে');
  });
  it('টার্গেট null → ডিফল্ট ২০%; ছুঁলে "ছুঁয়েছে"', () => {
    const lines = monthReport(cur, prev, null, fmt);
    expect(flat(lines[0])).toContain('(20%)');
    expect(flat(lines[0])).toContain('ছুঁয়েছে');
  });
  it('সবচেয়ে বাড়া খাত (গত মাসে > ০), নতুন খাত বাদ', () => {
    const c2 = [...cur, tx('2026-10-04', 'expense', 20000, 'নতুন')];
    const p2 = [tx('2026-09-02', 'expense', 20000, 'খাবার'), tx('2026-09-03', 'expense', 40000, 'ভাড়া')];
    const lines = monthReport(c2, p2, 20, fmt);
    expect(lines.map(flat).some((s) => s === 'সবচেয়ে বেড়েছে: খাবার (+100%)')).toBe(true);
  });
  it('prev না থাকলে শুধু সঞ্চয় লাইন; আয়ও না থাকলে কিছুই না', () => {
    const lines = monthReport(cur, null, 20, fmt);
    expect(lines).toHaveLength(1);
    expect(flat(lines[0])).toBe('সঞ্চয় টার্গেট (20%) ছুঁয়েছে');
    expect(monthReport([tx('2026-10-01', 'expense', 100)], null, 20, fmt)).toEqual([]);
  });
  it('ছোট-ফাঁক লাইন', () => {
    const leaks = Array.from({ length: 10 }, (_, i) => tx(`2026-10-${String(i + 1).padStart(2, '0')}`, 'expense', 5000, 'চা-নাস্তা'));
    const lines = monthReport(leaks, null, 20, fmt);
    expect(lines.map(flat)).toContain('সবচেয়ে বড় ছোট-ফাঁক: চা-নাস্তা, মাসে ৳500');
  });
});

describe('dailyExpense', () => {
  it('শুধু expense যোগ করে', () => {
    const m = dailyExpense([tx('2026-10-01', 'expense', 100), tx('2026-10-01', 'expense', 50), tx('2026-10-01', 'income', 999)]);
    expect(m.get('2026-10-01')).toBe(150);
  });
});

describe('targetGap', () => {
  const txs = [tx('2026-10-01', 'income', 100000), tx('2026-10-02', 'expense', 60000, 'X'), tx('2026-10-03', 'expense', 30000, 'Y'), tx('2026-10-04', 'expense', 5000, 'Z')];
  it('টার্গেট ২০% ছুঁতে ১৫০০০ কম খরচ দরকার; একক-খাত কাটার শতাংশ', () => {
    // খরচ ৯৫০০০, টার্গেট-সীমা ৮০০০০ → need ১৫০০০
    const g = targetGap(txs, 20)!;
    expect(g.needMinor).toBe(15000);
    expect(g.options.map((o) => o.name)).toEqual(['X', 'Y']); // Z (৫০০০) < need
    expect(g.options[0].cutPct).toBeCloseTo(25, 5);
    expect(g.options[1].cutPct).toBeCloseTo(50, 5);
  });
  it('টার্গেট ছোঁয়া বা আয় ০ হলে null', () => {
    expect(targetGap(txs, 5)).toBeNull();
    expect(targetGap([tx('2026-10-02', 'expense', 100)], 20)).toBeNull();
  });
});

describe('bigOneOffs', () => {
  it('মোট খরচের ≥২০% লেনদেন; বাদে সঞ্চয়-হার', () => {
    const txs = [tx('2026-10-01', 'income', 100000), tx('2026-10-02', 'expense', 50000, 'Tour'), ...[1, 2, 3, 4].map((d) => tx(`2026-10-0${d + 2}`, 'expense', 5000, 'Food'))];
    const b = bigOneOffs(txs)!;
    expect(b.items).toHaveLength(1);
    expect(b.items[0].categoryName).toBe('Tour');
    expect(b.expenseWithoutMinor).toBe(20000);
    expect(b.savingsPct).toBeCloseTo(30, 5);
    expect(b.savingsPctWithout).toBeCloseTo(80, 5);
  });
  it('খরচ-লেনদেন ৪টির কম বা বড় কিছু না থাকলে null', () => {
    expect(bigOneOffs([tx('2026-10-02', 'expense', 5000), tx('2026-10-03', 'expense', 5000)])).toBeNull();
    const even = Array.from({ length: 10 }, (_, i) => tx(`2026-10-${String(i + 1).padStart(2, '0')}`, 'expense', 1000));
    expect(bigOneOffs(even)).toBeNull();
  });
});

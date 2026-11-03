import { describe, it, expect } from 'vitest';
import { matchCategory, mergeByKey, normKey } from './categoryMatch';

const APP = ['বাসা, বিদ্যুৎ, গ্যাস, ময়লা,ইন্টারনেট', 'Groceries/Fruits/Sweets', 'Tour & Travel', 'পরিবারের বিভিন্ন খাতে', 'Hira', 'Hasan Tuhin', 'স্ত্রী পক্ষ', 'বাবা', 'উপহার/দান/রোগী দেখতে/বেড়াতে', 'Transportation', 'Raiyan', 'Groceries', 'Hangout', 'নানা বাড়ি পক্ষ', 'প্রয়োজনীয় জিনিসপত্র', 'হোটেলে খাওয়া', 'Rifa', 'মা', 'অন্যান্য ব্যয়', 'দাদা বাড়ি পক্ষ', 'চা-নাস্তা', 'কেনাকাটা/ অনলাইন অর্ডার'];

describe('matchCategory — Excel পুরনো নাম → অ্যাপের খাত', () => {
  const cases: [string, string][] = [
    ['House Rent, Elec, Gas, Internet', 'বাসা, বিদ্যুৎ, গ্যাস, ময়লা,ইন্টারনেট'],
    ['Hasan', 'Hasan Tuhin'],
    ['Father', 'বাবা'],
    ['Mother', 'মা'],
    ['Father Side', 'দাদা বাড়ি পক্ষ'],
    ['Mother Side', 'নানা বাড়ি পক্ষ'],
    ['Wife Side', 'স্ত্রী পক্ষ'],
    ['Hotel/Launch', 'হোটেলে খাওয়া'],
    ['Tea', 'চা-নাস্তা'],
    ['Others Cost', 'অন্যান্য ব্যয়'],
    ['পরিবারের খাতে', 'পরিবারের বিভিন্ন খাতে'],
    ['কেনাকাটা', 'কেনাকাটা/ অনলাইন অর্ডার'],
    ['Gift/Donate...', 'উপহার/দান/রোগী দেখতে/বেড়াতে'],
  ];
  it.each(cases)('%s → %s (sure)', (old, app) => {
    const m = matchCategory(old, APP);
    expect(m.suggestion).toBe(app);
    expect(m.sure).toBe(true);
  });
  it('বানান-ভুল/স্পেস/কেস সহ্য করে', () => {
    expect(matchCategory('Transporation', APP).suggestion).toBe('Transportation');
    expect(matchCategory(' RAIYAN ', APP).suggestion).toBe('Raiyan');
    expect(matchCategory('hira', APP)).toMatchObject({ suggestion: 'Hira', sure: true });
  });
  it('মিল নেই → null (Excel নামেই থাকবে)', () => {
    expect(matchCategory('ধার শোধ', APP).suggestion).toBeNull();
  });
  it('দুই খাত সমান কাছের হলে sure=false', () => {
    expect(matchCategory('Groceries', ['Groceries Fresh', 'Groceries Dry']).sure).toBe(false);
  });
});

describe('normKey / mergeByKey', () => {
  it('স্পেস/কেস/যতিচিহ্ন উপেক্ষা', () => {
    expect(normKey('Hasan  Tuhin')).toBe(normKey('hasan-tuhin '));
  });
  it('একই খাত দুই লাইনে আসে না — যোগ হয়', () => {
    expect(mergeByKey([{ name: 'Hira', amountMinor: 100 }, { name: 'hira ', amountMinor: 50 }, { name: 'Rifa', amountMinor: 7 }])).toEqual([
      { name: 'Hira', amountMinor: 150 },
      { name: 'Rifa', amountMinor: 7 },
    ]);
  });
});

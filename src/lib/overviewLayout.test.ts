import { describe, expect, it } from 'vitest';
import { SettingsSchema } from '../validation/settingsSchema';
import { CARD_DEFS, defaultLayout, moveCard, sameLayout, sanitizeCards, sanitizeLayout, updateCard } from './overviewLayout';

describe('overviewLayout', () => {
  it('ফিল্ড না থাকলে ডিফল্ট (আগের আচরণ): সব দৃশ্যমান, More-insights কার্ড closed', () => {
    const l = sanitizeLayout(undefined);
    expect(sameLayout(l, defaultLayout())).toBe(true);
    expect(l.defaultTab).toBe('monthly');
    expect(l.banners).toBe(true);
    expect(l.tabs.monthly.map((c) => c.id)).toEqual(CARD_DEFS.monthly.map((d) => d.id));
    expect(l.tabs.monthly.find((c) => c.id === 'leak')?.fold).toBe('closed');
    expect(l.tabs.monthly.find((c) => c.id === 'report')?.fold).toBe('fixed');
    expect(l.tabs.monthly.every((c) => c.visible)).toBe(true);
  });

  it('অবৈধ ইনপুট (স্ট্রিং/অ্যারে/null) → ডিফল্ট', () => {
    for (const bad of ['x', 5, null, [], true]) expect(sameLayout(sanitizeLayout(bad), defaultLayout())).toBe(true);
  });

  it('অচেনা id ও ডুপ্লিকেট বাদ; অবৈধ মানের কার্ড ডিফল্টে ফেরে, বাকি অক্ষত', () => {
    const cards = sanitizeCards('monthly', [
      { id: 'nope', visible: true, fold: 'fixed' },
      { id: 'keynums', visible: false, fold: 'open' },
      { id: 'keynums', visible: true, fold: 'fixed' },
      { id: 'report', visible: 'yes', fold: 'fixed' },
      { id: 'hundred', visible: true, fold: 'wide' },
      'junk',
      null,
    ]);
    expect(cards.filter((c) => c.id === 'keynums')).toHaveLength(1);
    expect(cards.find((c) => c.id === 'keynums')).toEqual({ id: 'keynums', visible: false, fold: 'open' });
    expect(cards.find((c) => c.id === 'nope')).toBeUndefined();
    expect(cards.find((c) => c.id === 'report')).toEqual({ id: 'report', visible: true, fold: 'fixed' });
    expect(cards.find((c) => c.id === 'hundred')?.fold).toBe('fixed');
    expect(cards).toHaveLength(CARD_DEFS.monthly.length);
  });

  it('নতুন কার্ড (সেভ-তালিকায় নেই) শেষে যোগ হয়, সেভ-করা ক্রম অক্ষত', () => {
    const cards = sanitizeCards('monthly', [
      { id: 'keynums', visible: true, fold: 'fixed' },
      { id: 'report', visible: true, fold: 'fixed' },
    ]);
    expect(cards.slice(0, 2).map((c) => c.id)).toEqual(['keynums', 'report']);
    expect(cards).toHaveLength(CARD_DEFS.monthly.length);
    expect(cards[2]!.id).toBe('target');
  });

  it('সীমা: ৪০-এর বেশি এন্ট্রি কাটা হয়', () => {
    const many = Array.from({ length: 100 }, () => ({ id: 'report', visible: false, fold: 'open' }));
    expect(sanitizeCards('monthly', many)).toHaveLength(CARD_DEFS.monthly.length);
  });

  it('defaultTab/banners অবৈধ হলে ডিফল্ট, বৈধ হলে রাখে', () => {
    expect(sanitizeLayout({ defaultTab: 'weekly', banners: 'no' })).toMatchObject({ defaultTab: 'monthly', banners: true });
    expect(sanitizeLayout({ defaultTab: 'yearly', banners: false })).toMatchObject({ defaultTab: 'yearly', banners: false });
  });

  it('moveCard/updateCard: সরানো ও সীমা; মূল অ্যারে অপরিবর্তিত', () => {
    const base = defaultLayout().tabs.monthly;
    expect(moveCard(base, 'target', -1).map((c) => c.id).slice(0, 2)).toEqual(['target', 'report']);
    expect(moveCard(base, 'report', -1).map((c) => c.id)).toEqual(base.map((c) => c.id));
    expect(moveCard(base, base[base.length - 1]!.id, 1).map((c) => c.id)).toEqual(base.map((c) => c.id));
    expect(updateCard(base, 'leak', { visible: false }).find((c) => c.id === 'leak')?.visible).toBe(false);
    expect(base.find((c) => c.id === 'leak')?.visible).toBe(true);
  });

  it('SettingsSchema: ফিল্ড না থাকলে ডিফল্ট layout, ভুল মান crash করে না', () => {
    expect(sameLayout(SettingsSchema.parse({}).overviewLayout, defaultLayout())).toBe(true);
    expect(sameLayout(SettingsSchema.parse({ overviewLayout: 42 }).overviewLayout, defaultLayout())).toBe(true);
  });
});

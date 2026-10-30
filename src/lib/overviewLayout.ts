// Overview কাস্টমাইজ — কার্ডের তালিকা, সাজানো-লজিক, sanitize। pure (React/DB নেই)।
// settings.overviewLayout ঐচ্ছিক: না থাকলে/অবৈধ হলে ডিফল্ট = আগের আচরণ হুবহু।
// অচেনা বা ডুপ্লিকেট id বাদ; নতুন কার্ড (সেভ-করা তালিকায় নেই) ডিফল্ট ক্রমে শেষে যোগ হয়।

export type OverviewTabKey = 'monthly' | 'yearly' | 'alltime';
/** fixed = ভাঁজ হয় না; open/closed = ভাঁজযোগ্য, শুরুতে খোলা/বন্ধ */
export type Fold = 'fixed' | 'open' | 'closed';

export interface CardPref {
  id: string;
  visible: boolean;
  fold: Fold;
}
export interface OverviewLayout {
  defaultTab: OverviewTabKey;
  banners: boolean;
  tabs: Record<OverviewTabKey, CardPref[]>;
}
export interface CardDef {
  id: string;
  title: string;
  defaultFold: Fold;
}

export const TAB_KEYS: readonly OverviewTabKey[] = ['monthly', 'yearly', 'alltime'];
export const TAB_LABEL: Record<OverviewTabKey, string> = { monthly: 'Monthly', yearly: 'Yearly', alltime: 'All-Time' };
export const MAX_CARDS_PER_TAB = 40;

const f = (id: string, title: string, defaultFold: Fold = 'fixed'): CardDef => ({ id, title, defaultFold });

// ক্রম = বর্তমান Overview-র ক্রম। "More insights"-এর কার্ডগুলো আগে ভাঁজ-বন্ধ ছিল, তাই ডিফল্ট closed।
export const CARD_DEFS: Record<OverviewTabKey, readonly CardDef[]> = {
  monthly: [
    f('report', 'Report Card'),
    f('target', 'টার্গেট ছুঁতে কী করা যেত'),
    f('oneoffs', 'Big One-Off Expenses'),
    f('hundred', 'Where My ৳100 Goes'),
    f('category', 'Expense by category'),
    f('keynums', 'Key numbers'),
    f('leak', 'Leak Finder', 'closed'),
    f('weekday', 'Spending by Weekday', 'closed'),
    f('nospend', 'No-Spend Calendar', 'closed'),
  ],
  yearly: [
    f('bestworst', 'Best & toughest month'),
    f('savingsrate', 'Monthly Savings Rate'),
    f('creep', 'জীবনযাত্রার খরচ বৃদ্ধি'),
    f('realgrowth', 'আসল বৃদ্ধি'),
    f('invcheck', 'Investment Reality Check'),
    f('monthbars', 'Income vs expense by month', 'closed'),
    f('category', 'Expense by category'),
    f('breakdown', 'Yearly breakdown'),
  ],
  alltime: [
    f('networth', 'Net Worth'),
    f('bridge', 'সম্পদ বাড়ল কোথা থেকে'),
    f('goal', 'লক্ষ্য ও পূর্বাভাস'),
    f('assetmix', 'সম্পদের মিশ্রণ'),
    f('runway', 'কত মাস চলবে'),
    f('category', 'Expense by category'),
    f('years', 'Years'),
  ],
};

const FOLDS: readonly Fold[] = ['fixed', 'open', 'closed'];

export function cardTitle(tab: OverviewTabKey, id: string): string {
  return CARD_DEFS[tab].find((d) => d.id === id)?.title ?? id;
}

export function defaultCards(tab: OverviewTabKey): CardPref[] {
  return CARD_DEFS[tab].map((d) => ({ id: d.id, visible: true, fold: d.defaultFold }));
}

export function defaultLayout(): OverviewLayout {
  return { defaultTab: 'monthly', banners: true, tabs: { monthly: defaultCards('monthly'), yearly: defaultCards('yearly'), alltime: defaultCards('alltime') } };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** সেভ-করা তালিকা → বৈধ তালিকা। এক কার্ডের মান ভুল হলে শুধু সেটা বাদ যায় (পরে ডিফল্টে ফেরত আসে); বাকি অক্ষত। */
export function sanitizeCards(tab: OverviewTabKey, raw: unknown): CardPref[] {
  const known = new Map(CARD_DEFS[tab].map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: CardPref[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, MAX_CARDS_PER_TAB)) {
      if (!isObj(item)) continue;
      const { id, visible, fold } = item;
      if (typeof id !== 'string' || id.length > 40 || !known.has(id) || seen.has(id)) continue;
      if (typeof visible !== 'boolean' || typeof fold !== 'string' || !FOLDS.includes(fold as Fold)) continue;
      seen.add(id);
      out.push({ id, visible, fold: fold as Fold });
    }
  }
  for (const d of CARD_DEFS[tab]) {
    if (!seen.has(d.id)) out.push({ id: d.id, visible: true, fold: d.defaultFold });
  }
  return out;
}

export function sanitizeLayout(raw: unknown): OverviewLayout {
  const base = defaultLayout();
  if (!isObj(raw)) return base;
  const tabsRaw = isObj(raw.tabs) ? raw.tabs : {};
  return {
    defaultTab: TAB_KEYS.includes(raw.defaultTab as OverviewTabKey) ? (raw.defaultTab as OverviewTabKey) : base.defaultTab,
    banners: typeof raw.banners === 'boolean' ? raw.banners : base.banners,
    tabs: { monthly: sanitizeCards('monthly', tabsRaw.monthly), yearly: sanitizeCards('yearly', tabsRaw.yearly), alltime: sanitizeCards('alltime', tabsRaw.alltime) },
  };
}

/** একটা কার্ড ওপরে/নিচে সরানো (সীমার বাইরে হলে অপরিবর্তিত)। নতুন অ্যারে ফেরত। */
export function moveCard(list: readonly CardPref[], id: string, dir: -1 | 1): CardPref[] {
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function updateCard(list: readonly CardPref[], id: string, patch: Partial<Pick<CardPref, 'visible' | 'fold'>>): CardPref[] {
  return list.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

export function sameLayout(a: OverviewLayout, b: OverviewLayout): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

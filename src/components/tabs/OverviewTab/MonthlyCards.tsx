import { useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Droplets, Target, Wallet, Zap, BarChart3 } from 'lucide-react';
import { Block, Tip } from './OverviewBits';
import BottomSheet from '../../common/BottomSheet';
import { formatDisplayDate } from '../../../lib/date';
import { categoryColorIndex, formatSigned, formatTakaWhole, roundWhole as roundMinor } from '../../../lib/format';
import {
  bigOneOffs,
  DEFAULT_SAVINGS_TARGET_PCT,
  leakFinder,
  monthReport,
  noSpendCalendar,
  spendPer100,
  targetGap,
  weekdaySpend,
  type TxLite,
} from '../../../lib/overviewCalc';

// Overview → Monthly ধাপ ২ (খরচ-সচেতনতা): রিপোর্ট কার্ড / আমার ১০০ টাকা / ছোট ফাঁক / বার-ভিত্তিক খরচ / নো-স্পেন্ড ক্যালেন্ডার।
// শুধু বিদ্যমান লেনদেন থেকে derive — নতুন schema/write নেই। হিসাব lib/overviewCalc.ts-এ (pure, tested)।

const MONTHS_BN_GEN = ['জানুয়ারির', 'ফেব্রুয়ারির', 'মার্চের', 'এপ্রিলের', 'মে-র', 'জুনের', 'জুলাইয়ের', 'আগস্টের', 'সেপ্টেম্বরের', 'অক্টোবরের', 'নভেম্বরের', 'ডিসেম্বরের'];
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const WEEKDAYS_SHORT_BN = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র']; // শনি = ০
const WEEKDAYS_BN = ['শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার'];
const monthIdx = (yyyymm: string) => Number(yyyymm.slice(5, 7)) - 1;
const chartColor = (name: string) => `rgb(var(--chart-${categoryColorIndex(name, 8) + 1}))`;

/** ১. মাসের রিপোর্ট কার্ড — ৩ লাইনের নিয়ম-ভিত্তিক সারাংশ */
export function ReportCard({ month, txs, prevTxs, targetPct, essential }: { month: string; txs: readonly TxLite[]; prevTxs: readonly TxLite[] | null; targetPct: number | null; essential: readonly string[] }) {
  const lines = useMemo(() => monthReport(txs, prevTxs, targetPct, formatTakaWhole, essential), [txs, prevTxs, targetPct, essential]);
  if (lines.length === 0) return null;
  return (
    <Block icon={ClipboardList} title={`${MONTHS_BN_GEN[monthIdx(month)]} রিপোর্ট কার্ড`} sub="আপনার হিসাব থেকে নিজে-নিজে তৈরি">
      <ul className="flex flex-col gap-2 text-sm text-fg">
        {lines.map((line, i) => (
          <li key={i} className="border-t border-muted/10 pt-2 first:border-t-0 first:pt-0">
            •{' '}
            {line.map((p, j) => (
              <span key={j} className={p.tone === 'good' ? 'font-semibold text-income' : p.tone === 'bad' ? 'font-semibold text-expense' : p.text && j > 0 && line[j - 1].text === 'সবচেয়ে বেড়েছে: ' ? 'font-semibold' : undefined}>{p.text}</span>
            ))}
          </li>
        ))}
      </ul>
    </Block>
  );
}

/** ১ক. কী ঠিক করলে টার্গেট ছোঁয়া যেত — সঞ্চয়-হার টার্গেটের নিচে থাকলেই দেখায় */
export function TargetGapCard({ txs, targetPct }: { txs: readonly TxLite[]; targetPct: number | null }) {
  const target = targetPct ?? DEFAULT_SAVINGS_TARGET_PCT;
  const g = useMemo(() => targetGap(txs, target), [txs, target]);
  if (!g) return null;
  return (
    <Block icon={Target} tone="income" title="কী ঠিক করলে টার্গেট ছোঁয়া যেত" sub={`সঞ্চয় টার্গেট ${target}% ছুঁতে খরচ ${formatTakaWhole(g.needMinor)} কম হওয়া দরকার ছিল`}>
      {g.options.length === 0 ? (
        <p className="text-xs text-muted">একটা খাত কমিয়ে এটা হতো না — কয়েকটা খাতে মিলিয়ে কমাতে হতো।</p>
      ) : (
        <ul>
          {g.options.map((o) => (
            <li key={o.name} className="flex items-center justify-between gap-3 border-t border-muted/10 py-2 first:border-t-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{o.name}</p>
                <p className="text-xs text-muted">এ মাসে {formatTakaWhole(o.totalMinor)}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-income">{Math.ceil(o.cutPct)}% কমালেই হতো</p>
            </li>
          ))}
        </ul>
      )}
      <Tip>শুধু একটা খাত কমানোর হিসাব — আয় আর অন্য খরচ একই ধরে।</Tip>
    </Block>
  );
}

/** ১খ. বড় একবারের খরচ আলাদা — মোট খরচের ২০%+ একক লেনদেন */
export function BigOneOffCard({ txs }: { txs: readonly TxLite[] }) {
  const b = useMemo(() => bigOneOffs(txs), [txs]);
  if (!b) return null;
  return (
    <Block icon={Zap} tone="warning" title="বড় একবারের খরচ" sub="মোট খরচের ২০% বা বেশি একটি লেনদেন">
      <ul>
        {b.items.map((t, i) => (
          <li key={i} className="flex items-center justify-between gap-3 border-t border-muted/10 py-2 first:border-t-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{t.categoryName}</p>
              <p className="truncate text-xs text-muted">{formatDisplayDate(t.date)}{t.note ? ` · ${t.note}` : ''}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-expense">{formatTakaWhole(t.amountMinor)}</p>
          </li>
        ))}
      </ul>
      <Tip>
        এগুলো বাদে খরচ {formatTakaWhole(b.expenseWithoutMinor)} (মোট {formatTakaWhole(b.expenseMinor)})
        {b.savingsPct != null && b.savingsPctWithout != null ? ` — সঞ্চয়-হার ${Math.round(b.savingsPct)}% থেকে ${Math.round(b.savingsPctWithout)}%` : ''}।
      </Tip>
    </Block>
  );
}

/** ২. আমার ১০০ টাকা কোথায় যায় */
export function HundredCard({ month, txs }: { month: string; txs: readonly TxLite[] }) {
  const r = useMemo(() => spendPer100(txs), [txs]);
  if (!r || r.segments.length === 0) return null;
  const total = r.segments.reduce((a, s) => a + s.value, 0);
  const colorOf = (s: { kind: string; key: string }) => (s.kind === 'savings' ? 'rgb(var(--color-income))' : s.kind === 'others' ? 'rgb(var(--color-muted))' : chartColor(s.key));
  return (
    <Block icon={Wallet} title="আমার ১০০ টাকা কোথায় যায়" sub={`${MONTHS_BN[monthIdx(month)]} মাসে প্রতি ১০০ টাকা ${r.basis === 'expense' ? 'খরচে' : 'আয়ে'}`}>
      <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={r.basis === 'expense' ? 'খরচের প্রতি ১০০ টাকার ভাগ' : 'আয়ের প্রতি ১০০ টাকার ভাগ'}>
        {r.segments.map((s) => (
          <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: colorOf(s) }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4">
        {r.segments.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2 border-t border-muted/10 py-1.5 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf(s) }} />
              <span className="truncate text-fg">{s.name}</span>
            </span>
            <span className="shrink-0 font-semibold text-fg">৳{s.value}</span>
          </li>
        ))}
      </ul>
      {r.savingsPer100 != null ? (
        <p className="mt-3 rounded-xl bg-income/10 px-3 py-2 text-xs text-income">১০০ টাকার মধ্যে <b>{r.savingsPer100} টাকা</b> আপনার জমেছে।</p>
      ) : (
        <Tip>এই মাসে খরচ আয়ের চেয়ে {formatTakaWhole(r.overspendMinor)} বেশি — তাই জমা হয়নি।</Tip>
      )}
    </Block>
  );
}

/** ৩. ছোট ফাঁক (Leak finder) */
export function LeakCard({ txs, essential }: { txs: readonly TxLite[]; essential: readonly string[] }) {
  const { items, income } = useMemo(() => ({ items: leakFinder(txs, 3, essential), income: txs.reduce((a, t) => (t.type === 'income' ? a + t.amountMinor : a), 0) }), [txs, essential]);
  if (items.length === 0) return null;
  const sum = items.reduce((a, x) => a + x.totalMinor, 0);
  const pctIncome = income > 0 ? Math.round((sum / income) * 1000) / 10 : null;
  return (
    <Block icon={Droplets} tone="expense" title="ছোট ফাঁক" sub="বেশি বার, ছোট অঙ্ক — সবচেয়ে বেশি অজান্তে যায়">
      <ul>
        {items.map((x) => (
          <li key={x.name} className="flex items-center justify-between gap-3 border-t border-muted/10 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{x.name}</p>
              <p className="text-xs text-muted">{x.count} বার · গড় {formatTakaWhole(x.avgMinor)}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-expense">{formatTakaWhole(x.totalMinor)}</p>
          </li>
        ))}
      </ul>
      <Tip>
        {items.length > 1 ? `${items.length}টি মিলে` : 'এটি'} {formatTakaWhole(sum)}
        {pctIncome != null ? ` = আয়ের ${pctIncome}%` : ''}। ৩০% কমালে মাসে {formatTakaWhole(Math.round(sum * 0.3))} বাঁচে।
        {essential.length > 0 ? ` (প্রয়োজনীয় ${essential.length}টি খাত বাদ)` : ''}
      </Tip>
    </Block>
  );
}

/** ৪. বার-ভিত্তিক খরচ (গত ৯০ দিন) */
export function WeekdayCard({ txs, end }: { txs: readonly TxLite[] | null; end: string }) {
  const w = useMemo(() => (txs ? weekdaySpend(txs, end) : null), [txs, end]);
  if (!w) return null;
  const max = Math.max(...w.avgMinor, 1);
  return (
    <Block icon={BarChart3} title="বারভিত্তিক খরচ" sub={`গত ৯০ দিনের গড় দৈনিক খরচ${w.daysCovered < 90 ? ` (ডেটা আছে ${w.daysCovered} দিনের)` : ''}`}>
      <div className="flex h-40 items-end gap-2">
        {w.avgMinor.map((v, i) => {
          const isPeak = w.peak?.index === i;
          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-[10px] ${isPeak ? 'font-semibold text-expense' : 'text-muted'}`}>{formatTakaWhole(v)}</span>
              <div className={`w-full rounded-t ${isPeak ? 'bg-expense' : 'bg-income/50'}`} style={{ height: `${Math.max(2, (v / max) * 100)}px`, maxHeight: '100px' }} />
              <span className="text-[10px] text-muted">{WEEKDAYS_SHORT_BN[i]}</span>
            </div>
          );
        })}
      </div>
      {w.peak && <Tip>{WEEKDAYS_BN[w.peak.index]}ে গড়ে {formatTakaWhole(w.peak.avgMinor)} — অন্য দিনের {(Math.round(w.peak.ratio * 10) / 10).toString()} গুণ।</Tip>}
    </Block>
  );
}

const LEVEL_CLASS: Record<string, string> = {
  none: 'bg-income text-canvas font-semibold',
  low: 'bg-income/15 text-fg',
  mid: 'bg-warning/25 text-fg',
  high: 'bg-expense/30 text-fg',
  today: 'border border-dashed border-primary text-fg',
  future: 'text-muted/40',
};

const LEGEND: { level: string; label: string }[] = [
  { level: 'none', label: 'নো-স্পেন্ড' },
  { level: 'low', label: 'কম খরচ' },
  { level: 'mid', label: 'মাঝারি' },
  { level: 'high', label: 'বেশি খরচ' },
  { level: 'today', label: 'আজ (চলছে)' },
];

/** দিনের ঘরে ট্যাপ → সেদিনের লেনদেনের তালিকা (read-only, লোড-হওয়া txs থেকে) */
function DaySheet({ date, spendMinor, isToday, txs, onClose }: { date: string; spendMinor: number; isToday: boolean; txs: readonly TxLite[]; onClose: () => void }) {
  const rows = useMemo(() => txs.filter((t) => t.date === date), [txs, date]);
  return (
    <BottomSheet
      title={formatDisplayDate(date)}
      onRequestClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="min-h-11 w-full rounded-lg border border-muted/40 text-base">
          বন্ধ করুন
        </button>
      }
    >
      <p className="mb-3 text-sm text-muted">
        {isToday && spendMinor === 0 ? 'আজ চলছে — এখনো খরচ নেই।' : spendMinor === 0 ? 'নো-স্পেন্ড — কোনো খরচ নেই।' : `মোট খরচ: ${formatTakaWhole(spendMinor)}`}
      </p>
      <ul className="flex flex-col gap-1">
        {rows.map((t, i) => (
          <li key={i} className="flex items-start justify-between rounded-lg bg-surface px-3 py-2 text-sm text-fg">
            <span className="min-w-0">
              <span className="block truncate">{t.categoryName}</span>
              {t.note && <span className="block truncate text-xs text-muted">{t.note}</span>}
            </span>
            <span className={`ml-2 shrink-0 ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>{formatSigned(roundMinor(t.amountMinor), t.type)}</span>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

/** ৫. নো-স্পেন্ড ক্যালেন্ডার — দিনের ঘরে ট্যাপ করলে সেদিনের লেনদেন-শিট */
export function NoSpendCalendarCard({ month, txs, today }: { month: string; txs: readonly TxLite[]; today: string }) {
  const c = useMemo(() => noSpendCalendar(txs, month, today), [txs, month, today]);
  const [sel, setSel] = useState<string | null>(null);
  const lead = c.days[0]?.weekday ?? 0;
  const picked = c.days.find((d) => d.date === sel && d.level !== 'future');
  return (
    <Block icon={CalendarDays} tone="income" title="নো-স্পেন্ড ক্যালেন্ডার" sub="দিনের ঘরে ট্যাপ করলে সেদিনের লেনদেন দেখবেন">
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS_SHORT_BN.map((d) => (
          <span key={d} className="pb-1 text-[10px] text-muted">{d}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} aria-hidden />
        ))}
        {c.days.map((d) => (
          <button
            key={d.date}
            type="button"
            disabled={d.level === 'future'}
            aria-pressed={sel === d.date}
            aria-label={d.level === 'future' ? `${d.day}` : `${d.day}: ${formatTakaWhole(d.spendMinor)}`}
            onClick={() => setSel(sel === d.date ? null : d.date)}
            className={`flex aspect-square items-center justify-center rounded-lg text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${LEVEL_CLASS[d.level]} ${d.date === today ? 'ring-2 ring-primary' : ''} ${sel === d.date ? 'outline outline-2 outline-fg' : ''}`}
          >
            {d.day}
          </button>
        ))}
      </div>
      {picked && <DaySheet date={picked.date} spendMinor={picked.spendMinor} isToday={picked.level === 'today'} txs={txs} onClose={() => setSel(null)} />}
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted" aria-label="রঙের অর্থ">
        {LEGEND.map((l) => (
          <li key={l.level} className="flex items-center gap-1">
            <span aria-hidden className={`inline-block h-3 w-3 rounded ${LEVEL_CLASS[l.level]}`} />
            {l.label}
          </li>
        ))}
      </ul>
      {c.days.some((d) => d.level === 'today') && <p className="mt-2 text-[11px] text-muted">আজ চলছে — নো-স্পেন্ড গোনা হবে কাল থেকে।</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-income/10 px-2.5 py-1 text-income">{c.noSpendCount} দিন নো-স্পেন্ড</span>
        {c.bestStreak > 0 && <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">সেরা টানা: {c.bestStreak} দিন</span>}
        {c.currentStreak >= 2 && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">এখন টানা: {c.currentStreak} দিন</span>}
      </div>
    </Block>
  );
}

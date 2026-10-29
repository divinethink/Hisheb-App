import { useMemo, type ReactNode } from 'react';
import Card from '../../common/Card';
import { categoryColorIndex, formatTaka } from '../../../lib/format';
import {
  leakFinder,
  monthReport,
  noSpendCalendar,
  spendPer100,
  weekdaySpend,
  type TxLite,
} from '../../../lib/overviewCalc';

// Overview → Monthly ধাপ ২ (খরচ-সচেতনতা): রিপোর্ট কার্ড / আমার ১০০ টাকা / ছোট ফাঁক / বার-ভিত্তিক খরচ / নো-স্পেন্ড ক্যালেন্ডার।
// শুধু বিদ্যমান লেনদেন থেকে derive — নতুন schema/write নেই। হিসাব lib/overviewCalc.ts-এ (pure, tested)।

const MONTHS_BN_GEN = ['জানুয়ারির', 'ফেব্রুয়ারির', 'মার্চের', 'এপ্রিলের', 'মে-র', 'জুনের', 'জুলাইয়ের', 'আগস্টের', 'সেপ্টেম্বরের', 'অক্টোবরের', 'নভেম্বরের', 'ডিসেম্বরের'];
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const WEEKDAYS_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']; // শনি = ০
const WEEKDAYS_BN = ['শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার'];
const monthIdx = (yyyymm: string) => Number(yyyymm.slice(5, 7)) - 1;
const chartColor = (name: string) => `rgb(var(--chart-${categoryColorIndex(name, 8) + 1}))`;

const Block = ({ title, sub, children, label }: { title: string; sub?: string; children: ReactNode; label: string }) => (
  <Card as="section" ariaLabel={label} className="mx-4 mt-3 p-4">
    <h2 className="text-sm font-medium text-fg">{title}</h2>
    {sub && <p className="mb-3 mt-0.5 text-xs text-muted">{sub}</p>}
    {children}
  </Card>
);

const Tip = ({ children }: { children: ReactNode }) => <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">{children}</p>;

/** ১. মাসের রিপোর্ট কার্ড — ৩ লাইনের নিয়ম-ভিত্তিক সারাংশ */
export function ReportCard({ month, txs, prevTxs, targetPct }: { month: string; txs: readonly TxLite[]; prevTxs: readonly TxLite[] | null; targetPct: number | null }) {
  const lines = useMemo(() => monthReport(txs, prevTxs, targetPct, formatTaka), [txs, prevTxs, targetPct]);
  if (lines.length === 0) return null;
  return (
    <Block label="Monthly report card" title={`${MONTHS_BN_GEN[monthIdx(month)]} রিপোর্ট কার্ড`} sub="আপনার হিসাব থেকে নিজে-নিজে তৈরি">
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

/** ২. আমার ১০০ টাকা কোথায় যায় */
export function HundredCard({ month, txs }: { month: string; txs: readonly TxLite[] }) {
  const r = useMemo(() => spendPer100(txs), [txs]);
  if (!r || r.segments.length === 0) return null;
  const total = r.segments.reduce((a, s) => a + s.value, 0);
  const colorOf = (s: { kind: string; key: string }) => (s.kind === 'savings' ? 'rgb(var(--color-income))' : s.kind === 'others' ? 'rgb(var(--color-muted))' : chartColor(s.key));
  return (
    <Block label="Where my 100 taka goes" title="আমার ১০০ টাকা কোথায় যায়" sub={`${MONTHS_BN[monthIdx(month)]} মাসে প্রতি ১০০ টাকা আয়ে`}>
      <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label="আয়ের প্রতি ১০০ টাকার ভাগ">
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
        <Tip>এই মাসে খরচ আয়ের চেয়ে {formatTaka(r.overspendMinor)} বেশি — তাই জমা হয়নি।</Tip>
      )}
    </Block>
  );
}

/** ৩. ছোট ফাঁক (Leak finder) */
export function LeakCard({ txs }: { txs: readonly TxLite[] }) {
  const { items, income } = useMemo(() => ({ items: leakFinder(txs), income: txs.reduce((a, t) => (t.type === 'income' ? a + t.amountMinor : a), 0) }), [txs]);
  if (items.length === 0) return null;
  const sum = items.reduce((a, x) => a + x.totalMinor, 0);
  const pctIncome = income > 0 ? Math.round((sum / income) * 1000) / 10 : null;
  return (
    <Block label="Leak finder" title="ছোট ফাঁক (Leak finder)" sub="বেশি বার, ছোট অঙ্ক — সবচেয়ে বেশি অজান্তে যায়">
      <ul>
        {items.map((x) => (
          <li key={x.name} className="flex items-center justify-between gap-3 border-t border-muted/10 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{x.name}</p>
              <p className="text-xs text-muted">{x.count} বার · গড় {formatTaka(x.avgMinor)}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-expense">{formatTaka(x.totalMinor)}</p>
          </li>
        ))}
      </ul>
      <Tip>
        {items.length > 1 ? `${items.length}টি মিলে` : 'এটি'} {formatTaka(sum)}
        {pctIncome != null ? ` = আয়ের ${pctIncome}%` : ''}। ৩০% কমালে মাসে {formatTaka(Math.round(sum * 0.3))} বাঁচে।
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
    <Block label="Spending by weekday" title="বারভিত্তিক খরচ" sub={`গত ৯০ দিনের গড় দৈনিক খরচ${w.daysCovered < 90 ? ` (ডেটা আছে ${w.daysCovered} দিনের)` : ''}`}>
      <div className="flex h-40 items-end gap-2">
        {w.avgMinor.map((v, i) => {
          const isPeak = w.peak?.index === i;
          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-[10px] ${isPeak ? 'font-semibold text-expense' : 'text-muted'}`}>{Math.round(v / 100).toLocaleString('en-US')}</span>
              <div className={`w-full rounded-t ${isPeak ? 'bg-expense' : 'bg-income/50'}`} style={{ height: `${Math.max(2, (v / max) * 100)}px`, maxHeight: '100px' }} />
              <span className="text-[10px] text-muted">{WEEKDAYS_EN[i]}</span>
            </div>
          );
        })}
      </div>
      {w.peak && <Tip>{WEEKDAYS_BN[w.peak.index]}ে গড়ে {formatTaka(w.peak.avgMinor)} — অন্য দিনের {(Math.round(w.peak.ratio * 10) / 10).toString()} গুণ।</Tip>}
    </Block>
  );
}

const LEVEL_CLASS: Record<string, string> = {
  none: 'bg-income text-canvas font-semibold',
  low: 'bg-income/15 text-fg',
  mid: 'bg-warning/25 text-fg',
  high: 'bg-expense/30 text-fg',
  future: 'text-muted/40',
};

/** ৫. নো-স্পেন্ড ক্যালেন্ডার */
export function NoSpendCalendarCard({ month, txs, today }: { month: string; txs: readonly TxLite[]; today: string }) {
  const c = useMemo(() => noSpendCalendar(txs, month, today), [txs, month, today]);
  const lead = c.days[0]?.weekday ?? 0;
  return (
    <Block label="No-spend calendar" title="নো-স্পেন্ড ক্যালেন্ডার" sub="সবুজ = খরচ শূন্য · লাল = বেশি খরচ">
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS_EN.map((d) => (
          <span key={d} className="pb-1 text-[10px] text-muted">{d}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} aria-hidden />
        ))}
        {c.days.map((d) => (
          <span
            key={d.date}
            title={d.level === 'future' ? undefined : `${d.day}: ${formatTaka(d.spendMinor)}`}
            className={`flex aspect-square items-center justify-center rounded-lg text-xs ${LEVEL_CLASS[d.level]} ${d.date === today ? 'ring-2 ring-primary' : ''}`}
          >
            {d.day}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-income/10 px-2.5 py-1 text-income">{c.noSpendCount} দিন নো-স্পেন্ড</span>
        {c.bestStreak > 0 && <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">সেরা টানা: {c.bestStreak} দিন</span>}
        {c.currentStreak >= 2 && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">এখন টানা: {c.currentStreak} দিন</span>}
      </div>
    </Block>
  );
}

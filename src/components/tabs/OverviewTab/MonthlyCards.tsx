import { useMemo, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, CalendarDays, ClipboardList, Droplets, Target, Wallet, Zap, type LucideIcon } from 'lucide-react';
import { Block, Tip } from './OverviewBits';
import BottomSheet from '../../common/BottomSheet';
import { formatDisplayDate, monthLabel, monthLabelBn } from '../../../lib/date';
import { categoryColorIndex, formatSigned, formatTakaWhole, roundWhole as roundMinor } from '../../../lib/format';
import {
  bigOneOffs,
  DEFAULT_SAVINGS_TARGET_PCT,
  leakFinder,
  monthReport,
  noSpendCalendar,
  REPORT_INCREASE_LABEL,
  REPORT_LEAK_LABEL,
  spendPer100,
  targetGap,
  weekdaySpend,
  type TxLite,
} from '../../../lib/overviewCalc';

// Overview → Monthly ধাপ ২ (খরচ-সচেতনতা): রিপোর্ট কার্ড / আমার ১০০ টাকা / ছোট ফাঁক / বার-ভিত্তিক খরচ / নো-স্পেন্ড ক্যালেন্ডার।
// শুধু বিদ্যমান লেনদেন থেকে derive — নতুন schema/write নেই। হিসাব lib/overviewCalc.ts-এ (pure, tested)।

const WEEKDAYS_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']; // শনি = ০
const WEEKDAYS_FULL = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const chartColor = (name: string) => `rgb(var(--chart-${categoryColorIndex(name, 8) + 1}))`;

/** ১. মাসের রিপোর্ট কার্ড — নিয়ম-ভিত্তিক সারাংশ; প্রতি লাইন আইকন + ছোট লেবেল সহ গোছানো সারিতে */
export function ReportCard({ month, txs, prevTxs, targetPct, essential }: { month: string; txs: readonly TxLite[]; prevTxs: readonly TxLite[] | null; targetPct: number | null; essential: readonly string[] }) {
  const lines = useMemo(() => monthReport(txs, prevTxs, targetPct, formatTakaWhole, essential), [txs, prevTxs, targetPct, essential]);
  if (lines.length === 0) return null;
  const rowCls = 'flex items-start gap-2.5 border-t border-muted/10 py-2.5 first:border-t-0 first:pt-0.5 last:pb-0.5';
  const badge = (Icon: LucideIcon, cls: string) => (
    <span aria-hidden className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${cls}`}>
      <Icon size={14} />
    </span>
  );
  return (
    <Block icon={ClipboardList} title={`${monthLabelBn(month).split(' ')[0]}-এর রিপোর্ট কার্ড`} sub="আপনার হিসাব থেকে নিজে-নিজেই তৈরি">
      <ul className="flex flex-col text-sm text-fg">
        {lines.map((line, i) => {
          const head = line[0]?.text;
          if (head === REPORT_INCREASE_LABEL) {
            return (
              <li key={i} className={rowCls}>
                {badge(ArrowUpRight, 'bg-expense/10 text-expense')}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted">সবচেয়ে বেশি বেড়েছে</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{line[1]?.text}</span>
                    <span className="shrink-0 rounded-full bg-expense/10 px-2 py-0.5 text-xs font-semibold text-expense">{line[2]?.text.trim()}</span>
                  </div>
                </div>
              </li>
            );
          }
          if (head === REPORT_LEAK_LABEL) {
            return (
              <li key={i} className={rowCls}>
                {badge(Droplets, 'bg-warning/10 text-warning')}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted">ছোট ফাঁকের শীর্ষে</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{line[1]?.text}</span>
                    <span className="shrink-0 text-xs text-muted">{line[2]?.text.replace(/^\s*—\s*/, '')}</span>
                  </div>
                </div>
              </li>
            );
          }
          return (
            <li key={i} className={rowCls}>
              {badge(Activity, 'bg-primary/10 text-primary')}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted">খরচ ও সঞ্চয়</p>
                <p className="leading-relaxed">
                  {line.map((p, j) => (
                    <span key={j} className={p.tone === 'good' ? 'font-semibold text-income' : p.tone === 'bad' ? 'font-semibold text-expense' : undefined}>{p.text}</span>
                  ))}
                </p>
              </div>
            </li>
          );
        })}
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
    <Block icon={Target} tone="income" title="টার্গেট ছুঁতে কী করা যেত" sub={`সঞ্চয়ের লক্ষ্য (${target}%) ছুঁতে খরচ আরও ${formatTakaWhole(g.needMinor)} কম হতে হতো`}>
      {g.options.length === 0 ? (
        <p className="text-xs text-muted">একটি খাত কেটে এটা সম্ভব হতো না — কয়েকটি খাতে একসাথে কমাতে হতো।</p>
      ) : (
        <ul>
          {g.options.map((o) => {
            const cut = Math.min(100, Math.ceil(o.cutPct));
            return (
              <li key={o.name} className="border-t border-muted/10 py-2 first:border-t-0 first:pt-0.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{o.name}</p>
                    <p className="text-xs text-muted">এই মাসে {formatTakaWhole(o.totalMinor)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-income/10 px-2.5 py-0.5 text-xs font-semibold text-income">{cut}% কমালেই হতো</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface" role="img" aria-label={`${o.name}: ${cut}% কমাতে হতো`}>
                  <div className="h-full rounded-full bg-income" style={{ width: `${cut}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Tip>হিসাবটি শুধু একটি খাত কেটে করা — আয় ও বাকি খরচ আগের মতোই ধরা হয়েছে।</Tip>
    </Block>
  );
}

/** ১খ. বড় একবারের খরচ আলাদা — মোট খরচের ২০%+ একক লেনদেন */
export function BigOneOffCard({ txs }: { txs: readonly TxLite[] }) {
  const b = useMemo(() => bigOneOffs(txs), [txs]);
  if (!b) return null;
  return (
    <Block icon={Zap} tone="warning" title="Big One-Off Expenses" sub="A single transaction of 20% or more of total spending">
      <ul>
        {b.items.map((t, i) => (
          <li key={i} className="flex items-center justify-between gap-3 border-t border-muted/10 py-1.5 first:border-t-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{t.categoryName}</p>
              <p className="truncate text-xs text-muted">{formatDisplayDate(t.date)}{t.note ? ` · ${t.note}` : ''}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-expense">{formatTakaWhole(t.amountMinor)}</p>
          </li>
        ))}
      </ul>
      <Tip>
        Without these, spending is {formatTakaWhole(b.expenseWithoutMinor)} (total {formatTakaWhole(b.expenseMinor)})
        {b.savingsPct != null && b.savingsPctWithout != null ? ` — savings rate ${Math.round(b.savingsPct)}% → ${Math.round(b.savingsPctWithout)}%` : ''}.
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
    <Block icon={Wallet} title="Where My ৳100 Goes" sub={`${monthLabel(month).split(' ')[0]}: every ৳100 of ${r.basis === 'expense' ? 'spending' : 'income'}`}>
      <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={r.basis === 'expense' ? 'Split of every ৳100 spent' : 'Split of every ৳100 earned'}>
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
        <p className="mt-2 rounded-xl bg-income/10 px-3 py-2 text-xs text-income">Out of every ৳100, you kept <b>৳{r.savingsPer100}</b>.</p>
      ) : (
        <Tip>Spending exceeded income by {formatTakaWhole(r.overspendMinor)} this month — nothing was saved.</Tip>
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
    <Block icon={Droplets} tone="expense" title="Leak Finder" sub="Frequent small amounts — the ones that slip away unnoticed">
      <ul>
        {items.map((x) => (
          <li key={x.name} className="flex items-center justify-between gap-3 border-t border-muted/10 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{x.name}</p>
              <p className="text-xs text-muted">{x.count} times · avg {formatTakaWhole(x.avgMinor)}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-expense">{formatTakaWhole(x.totalMinor)}</p>
          </li>
        ))}
      </ul>
      <Tip>
        {items.length > 1 ? `These ${items.length} together` : 'This one'} cost {formatTakaWhole(sum)}
        {pctIncome != null ? ` = ${pctIncome}% of income` : ''}. Cutting 30% would save {formatTakaWhole(Math.round(sum * 0.3))} a month.
        {essential.length > 0 ? ` (${essential.length} essential ${essential.length === 1 ? 'category' : 'categories'} excluded)` : ''}
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
    <Block icon={BarChart3} title="Spending by Weekday" sub={`Avg daily spend, last 90 days${w.daysCovered < 90 ? ` (${w.daysCovered} days of data)` : ''}`}>
      <div className="flex h-36 items-end gap-2">
        {w.avgMinor.map((v, i) => {
          const isPeak = w.peak?.index === i;
          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-[10px] ${isPeak ? 'font-semibold text-expense' : 'text-muted'}`}>{formatTakaWhole(v)}</span>
              <div className={`w-full rounded-t ${isPeak ? 'bg-expense' : 'bg-income/50'}`} style={{ height: `${Math.max(2, (v / max) * 100)}px`, maxHeight: '100px' }} />
              <span className="text-[10px] text-muted">{WEEKDAYS_EN[i]}</span>
            </div>
          );
        })}
      </div>
      {w.peak && <Tip>{WEEKDAYS_FULL[w.peak.index]}s average {formatTakaWhole(w.peak.avgMinor)} — {(Math.round(w.peak.ratio * 10) / 10).toString()}× other days.</Tip>}
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
  { level: 'none', label: 'No-spend' },
  { level: 'low', label: 'Low' },
  { level: 'mid', label: 'Medium' },
  { level: 'high', label: 'High' },
  { level: 'today', label: 'Today' },
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
          Close
        </button>
      }
    >
      <p className="mb-2 text-sm text-muted">
        {isToday && spendMinor === 0 ? 'Today is still going — no spending yet.' : spendMinor === 0 ? 'No-spend day — nothing spent.' : `Total spent: ${formatTakaWhole(spendMinor)}`}
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
    <Block icon={CalendarDays} tone="income" title="No-Spend Calendar" sub="Tap a day to see its transactions">
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_EN.map((d) => (
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
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted" aria-label="Color legend">
        {LEGEND.map((l) => (
          <li key={l.level} className="flex items-center gap-1">
            <span aria-hidden className={`inline-block h-3 w-3 rounded ${LEVEL_CLASS[l.level]}`} />
            {l.label}
          </li>
        ))}
      </ul>
      {c.days.some((d) => d.level === 'today') && <p className="mt-2 text-[11px] text-muted">Today is still going — it counts as a no-spend day from tomorrow.</p>}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-income/10 px-2.5 py-1 text-income">{c.noSpendCount} no-spend days</span>
        {c.bestStreak > 0 && <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">Best streak: {c.bestStreak} days</span>}
        {c.currentStreak >= 2 && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">Current streak: {c.currentStreak} days</span>}
      </div>
    </Block>
  );
}

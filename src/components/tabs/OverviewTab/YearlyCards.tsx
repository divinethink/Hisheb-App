import { useMemo, type ReactNode } from 'react';
import Card from '../../common/Card';
import { formatNetTaka, formatTaka } from '../../../lib/format';
import {
  investmentHonest,
  lifestyleCreep,
  realGrowth,
  savingsRateStats,
  DEFAULT_SAVINGS_TARGET_PCT,
  type InvestmentLite,
  type MonthRow,
  type NetWorthSnapshotLite,
} from '../../../lib/overviewCalc';

// Overview → Yearly ধাপ ৩: মাসিক সঞ্চয়-হার / লাইফস্টাইল ক্রিপ / আসল বৃদ্ধি / বিনিয়োগের সৎ রিপোর্ট।
// বিদ্যমান ডেটা থেকে derive — নতুন schema-write নেই (শুধু Settings-এ ঐচ্ছিক inflationPct)। হিসাব lib/overviewCalc.ts-এ (pure, tested)।

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pct1 = (v: number) => (Math.round(v * 10) / 10).toString();
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${pct1(Math.abs(v))}%`;

const Block = ({ title, sub, children, label }: { title: string; sub?: ReactNode; children: ReactNode; label: string }) => (
  <Card as="section" ariaLabel={label} className="mx-4 mt-3 p-4">
    <h2 className="text-sm font-medium text-fg">{title}</h2>
    {sub && <p className="mb-3 mt-0.5 text-xs text-muted">{sub}</p>}
    {children}
  </Card>
);

const Tip = ({ children }: { children: ReactNode }) => <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">{children}</p>;
const Chip = ({ children, tone }: { children: ReactNode; tone: 'good' | 'bad' | 'warn' }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs ${tone === 'good' ? 'bg-income/10 text-income' : tone === 'bad' ? 'bg-expense/10 text-expense' : 'bg-warning/10 text-warning'}`}>{children}</span>
);

/** ১. মাসিক সঞ্চয়-হার + টার্গেট লাইন + টানা-মাস */
export function SavingsRateCard({ year, rows, targetPct }: { year: number; rows: readonly MonthRow[]; targetPct: number | null }) {
  const target = targetPct ?? DEFAULT_SAVINGS_TARGET_PCT;
  const st = useMemo(() => savingsRateStats(rows, target), [rows, target]);
  const withData = st.points.filter((p) => p.pct != null);
  if (withData.length === 0) return null;

  const W = 300, H = 110, PADX = 14, TOP = 14, BOT = 14;
  const vals = withData.map((p) => p.pct as number);
  const yMax = Math.max(target, ...vals, 10);
  const yMin = Math.min(0, ...vals);
  const span = yMax - yMin || 1;
  const x = (m: number) => PADX + ((W - 2 * PADX) * (m - 1)) / 11;
  const y = (v: number) => TOP + (H - TOP - BOT) * (1 - (v - yMin) / span);
  // ডেটা-শূন্য মাসে লাইন ভাঙে (মিথ্যা ০ নয়)
  const segs: { m: number; v: number }[][] = [];
  for (const p of st.points) {
    if (p.pct == null) continue;
    const last = segs[segs.length - 1];
    if (last && last[last.length - 1].m === p.month - 1) last.push({ m: p.month, v: p.pct });
    else segs.push([{ m: p.month, v: p.pct }]);
  }
  const summary = withData.map((p) => `${MONTH_SHORT[p.month - 1]} ${pct1(p.pct as number)}%`).join(', ');

  return (
    <Block label="Monthly savings rate" title="মাসিক সঞ্চয়-হার" sub={`${year} · প্রতি মাসের (আয় − ব্যয়) ÷ আয়`}>
      <svg viewBox={`0 0 ${W} ${H + 12}`} className="w-full" role="img" aria-label={`Monthly savings rate vs target ${target}%. ${summary}`}>
        <line x1={PADX} x2={W - PADX} y1={y(target)} y2={y(target)} stroke="rgb(var(--color-income))" strokeWidth={1} strokeDasharray="4 3" />
        <text x={W - PADX} y={y(target) - 3} textAnchor="end" fontSize={8} className="fill-income">টার্গেট {target}%</text>
        {yMin < 0 && <line x1={PADX} x2={W - PADX} y1={y(0)} y2={y(0)} stroke="currentColor" className="text-muted/30" strokeWidth={0.5} />}
        {segs.map((seg, i) => (
          <polyline key={i} fill="none" stroke="rgb(var(--color-income))" strokeWidth={1.6} points={seg.map((p) => `${x(p.m)},${y(p.v)}`).join(' ')} />
        ))}
        {withData.map((p) => {
          const v = p.pct as number;
          const below = v < target;
          return (
            <g key={p.yyyymm}>
              <circle cx={x(p.month)} cy={y(v)} r={2.2} fill={below ? 'rgb(var(--color-expense))' : 'rgb(var(--color-income))'} />
              <text x={x(p.month)} y={y(v) - 5} textAnchor="middle" fontSize={7.5} className="fill-muted">{Math.round(v)}</text>
            </g>
          );
        })}
        {MONTH_INITIALS.map((c, i) => (
          <text key={i} x={x(i + 1)} y={H + 8} textAnchor="middle" fontSize={8} className="fill-muted">{c}</text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip tone={st.streakAbove > 0 ? 'good' : 'bad'}>টার্গেটের উপরে টানা: {st.streakAbove} মাস</Chip>
        {st.best && <Chip tone="good">সেরা: {st.best.months.map((m) => MONTH_SHORT[m - 1]).join(' / ')} {st.best.pct}%</Chip>}
      </div>
      {st.extraNeededMinor != null && st.avgIncomeMinor != null && (
        <Tip>টার্গেটে পৌঁছাতে মাসে আরও <b>{formatTaka(st.extraNeededMinor)}</b> জমাতে হবে (আয় {formatTaka(st.avgIncomeMinor)} ধরে)।</Tip>
      )}
    </Block>
  );
}

function CreepRow({ label, a, b, pct, max, color, upGood }: { label: string; a: number; b: number; pct: number | null; max: number; color: string; upGood: boolean }) {
  const good = pct == null ? true : upGood ? pct >= 0 : pct <= 0;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-fg">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted">{formatTaka(a)} → {formatTaka(b)}</span>
          {pct != null && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${good ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>{signed(pct)}</span>}
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface" role="img" aria-label={`${label}: ${formatTaka(a)} থেকে ${formatTaka(b)}`}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, (b / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

const CREEP_TIP: Record<string, string> = {
  income_fell_expense_stuck: 'আয় যতটা কমেছে, খরচ ততটা কমেনি — এটাই সঞ্চয়-হার নামার মূল কারণ।',
  expense_outpaced: 'আয়ের চেয়ে খরচ দ্রুত বেড়েছে — এটাই লাইফস্টাইল ক্রিপ।',
  expense_slower: 'আয় বেড়েছে, খরচ তার চেয়ে কম বেড়েছে — ভালো লক্ষণ।',
  both_down_good: 'আয় কমলেও খরচ তার চেয়ে বেশি কমেছে — ভালো সামাল দিয়েছেন।',
};

/** ২. লাইফস্টাইল ক্রিপ — গড় মাসিক আয় ও ব্যয়, আগের বছরের সাথে */
export function LifestyleCreepCard({ year, prev, cur, monthsCur, monthsPrev = 12, samePeriod = false, prevFromRecord = false }: { year: number; prev: { incomeMinor: number; expenseMinor: number }; cur: { incomeMinor: number; expenseMinor: number }; monthsCur: number; monthsPrev?: number; samePeriod?: boolean; prevFromRecord?: boolean }) {
  const c = useMemo(() => lifestyleCreep(prev, cur, monthsCur, monthsPrev), [prev, cur, monthsCur, monthsPrev]);
  if (!c) return null;
  const maxInc = Math.max(c.incomeAvgPrev, c.incomeAvgCur, 1);
  const maxExp = Math.max(c.expenseAvgPrev, c.expenseAvgCur, 1);
  return (
    <Block label="Lifestyle creep" title="লাইফস্টাইল ক্রিপ" sub={`গড় মাসিক · ${year - 1} → ${year}${samePeriod ? ` (একই সময়: জানু–${MONTH_SHORT[monthsCur - 1]})` : monthsCur < 12 ? ` (${year}: ${monthsCur} মাস)` : ''}`}>
      <CreepRow label="আয়" a={c.incomeAvgPrev} b={c.incomeAvgCur} pct={c.incomeChangePct} max={maxInc} color="rgb(var(--color-income))" upGood />
      <CreepRow label="খরচ" a={c.expenseAvgPrev} b={c.expenseAvgCur} pct={c.expenseChangePct} max={maxExp} color="rgb(var(--color-expense))" upGood={false} />
      {CREEP_TIP[c.verdict] && <Tip>{CREEP_TIP[c.verdict]}</Tip>}
      {!samePeriod && monthsCur < 12 && <p className="mt-2 text-[11px] leading-relaxed text-muted">{year - 1}-এর পুরো বছরের গড়ের সাথে তুলনা — একই মাসগুলোর ডেটা অ্যাপে সম্পূর্ণ নেই।</p>}
      {prevFromRecord && <p className="mt-2 text-[11px] leading-relaxed text-muted">{year - 1}-এর হিসাব অ্যাপের আগের Excel-record থেকে স্থানান্তরিত, লাইভ লেনদেন নয়।</p>}
    </Block>
  );
}

/** ৩. আসল বৃদ্ধি (মূল্যস্ফীতি বাদে) — শেষ ১২ মাস */
export function RealGrowthCard({ snapshots, inflationPct }: { snapshots: readonly NetWorthSnapshotLite[]; inflationPct: number | null }) {
  const g = useMemo(() => (inflationPct != null ? realGrowth(snapshots, inflationPct) : null), [snapshots, inflationPct]);
  if (inflationPct == null) {
    return (
      <Block label="Real growth" title="আসল বৃদ্ধি" sub="মূল্যস্ফীতি বাদ দিয়ে সম্পদ আসলে কতটা বাড়ল">
        <p className="text-xs text-muted">মূল্যস্ফীতি % সেট করুন (Menu → Monthly Target → মূল্যস্ফীতি), তারপর এখানে হিসাব আসবে।</p>
      </Block>
    );
  }
  if (!g) return null;
  const tile = 'flex-1 rounded-xl bg-surface px-2 py-3 text-center';
  return (
    <Block label="Real growth" title="আসল বৃদ্ধি" sub={`মূল্যস্ফীতি বাদে · ${g.baseYyyymm} → ${g.latestYyyymm} · মূল্যস্ফীতি ${pct1(g.inflationPct)}%`}>
      <div className="flex items-center gap-1.5">
        <div className={tile}>
          <p className="text-[11px] text-muted">সম্পদ বেড়েছে</p>
          <p className={`text-base font-semibold ${g.nominalPct >= 0 ? 'text-income' : 'text-expense'}`}>{signed(g.nominalPct)}</p>
        </div>
        <span aria-hidden className="text-muted">−</span>
        <div className={tile}>
          <p className="text-[11px] text-muted">দাম বেড়েছে</p>
          <p className="text-base font-semibold text-expense">{pct1(g.inflationPct)}%</p>
        </div>
        <span aria-hidden className="text-muted">=</span>
        <div className={tile}>
          <p className="text-[11px] text-muted">আসল বৃদ্ধি</p>
          <p className={`text-base font-semibold ${g.realPct >= 0 ? 'text-income' : 'text-expense'}`}>{signed(g.realPct)}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">আজকের {formatTaka(g.latestMinor)} = এক বছর আগের প্রায় {formatTaka(g.purchasingPowerMinor)}-এর সমান ক্রয়ক্ষমতা।</p>
    </Block>
  );
}

/** ৪. বিনিয়োগের সৎ রিপোর্ট */
export function InvestmentHonestCard({ investments }: { investments: readonly InvestmentLite[] }) {
  const r = useMemo(() => investmentHonest(investments), [investments]);
  if (!r || r.totalMinor <= 0) return null;
  const parts = [
    { key: 'running', label: 'চলমান', v: r.runningMinor, color: 'rgb(var(--color-income))' },
    { key: 'returned', label: 'ফেরত এসেছে', v: r.returnedMinor, color: 'rgb(var(--chart-2))' },
    { key: 'doubtful', label: 'Doubtful', v: r.doubtfulMinor, color: 'rgb(var(--color-warning))' },
    { key: 'written', label: 'Written-off', v: r.writtenOffMinor, color: 'rgb(var(--color-expense))' },
  ];
  return (
    <Block label="Investment honest report" title="বিনিয়োগের সৎ রিপোর্ট" sub={`মোট বিনিয়োগ ${formatTaka(r.totalMinor)}`}>
      <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label="বিনিয়োগের আসল কোথায় আছে">
        {parts.map((p) => (p.v > 0 ? <div key={p.key} style={{ width: `${(p.v / r.totalMinor) * 100}%`, background: p.color }} /> : null))}
      </div>
      <ul>
        {parts.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-2 border-t border-muted/10 py-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-fg">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="text-fg"><b>{formatTaka(p.v)}</b> <span className="text-muted">· {pct1((p.v / r.totalMinor) * 100)}%</span></span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 rounded-xl bg-income/10 px-3 py-2">
          <p className="text-[11px] text-muted">লাভ পেয়েছেন</p>
          <p className="text-base font-semibold text-income">{formatNetTaka(r.profitMinor)}</p>
        </div>
        <div className="flex-1 rounded-xl bg-expense/10 px-3 py-2">
          <p className="text-[11px] text-muted">ডুবেছে</p>
          <p className="text-base font-semibold text-expense">{formatNetTaka(-r.lossMinor)}</p>
        </div>
      </div>
      <Tip>
        <b>আসল ফল: {formatNetTaka(r.netMinor)}</b>
        {r.netPctOfTotal != null ? ` (${pct1(r.netPctOfTotal)}%)` : ''}
        {r.atRiskPct != null && r.atRiskPct > 0 ? ` — ঝুঁকিতে আছে আরও ${pct1(r.atRiskPct)}%` : ''}।
      </Tip>
    </Block>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { LineChart, PiggyBank, Scale, TrendingUp } from 'lucide-react';
import { Block, Tip } from './OverviewBits';
import { formatNetTakaWhole, formatTakaWhole } from '../../../lib/format';
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

// Overview → Yearly ধাপ ৩: মাসিক সঞ্চয়-হার / লাইফস্টাইল ক্রিপ / আসল বৃদ্ধি / Investment Report।
// বিদ্যমান ডেটা থেকে derive — নতুন schema-write নেই (শুধু Settings-এ ঐচ্ছিক inflationPct)। হিসাব lib/overviewCalc.ts-এ (pure, tested)।

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pct1 = (v: number) => (Math.round(v * 10) / 10).toString();
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${pct1(Math.abs(v))}%`;

const Chip = ({ children, tone }: { children: ReactNode; tone: 'good' | 'bad' | 'warn' }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs ${tone === 'good' ? 'bg-income/10 text-income' : tone === 'bad' ? 'bg-expense/10 text-expense' : 'bg-warning/10 text-warning'}`}>{children}</span>
);

/** ১. মাসিক সঞ্চয়-হার + টার্গেট লাইন + টানা-মাস */
export function SavingsRateCard({ year, rows, targetPct, partialMonth }: { year: number; rows: readonly MonthRow[]; targetPct: number | null; partialMonth?: number }) {
  const target = targetPct ?? DEFAULT_SAVINGS_TARGET_PCT;
  const st = useMemo(() => savingsRateStats(rows, target), [rows, target]);
  const [sel, setSel] = useState<number | null>(null);
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
  const selPoint = sel != null ? withData.find((p) => p.month === sel) ?? null : null;
  const summary = withData.map((p) => `${MONTH_SHORT[p.month - 1]} ${pct1(p.pct as number)}%`).join(', ');

  return (
    <Block icon={PiggyBank} tone="income" title="Monthly Savings Rate" sub={`${year} · (income − expense) ÷ income, per month`}>
      <svg viewBox={`0 0 ${W} ${H + 12}`} className="w-full" role="img" aria-label={`Monthly savings rate vs target ${target}%. ${summary}`}>
        <line x1={PADX} x2={W - PADX} y1={y(target)} y2={y(target)} stroke="rgb(var(--color-income))" strokeWidth={1} strokeDasharray="4 3" />
        <text x={W - PADX} y={y(target) - 3} textAnchor="end" fontSize={8} className="fill-income">Target {target}%</text>
        {yMin < 0 && <line x1={PADX} x2={W - PADX} y1={y(0)} y2={y(0)} stroke="currentColor" className="text-muted/30" strokeWidth={0.5} />}
        {segs.map((seg, i) => (
          <polyline key={i} fill="none" stroke="rgb(var(--color-income))" strokeWidth={1.6} points={seg.map((p) => `${x(p.m)},${y(p.v)}`).join(' ')} />
        ))}
        {withData.map((p) => {
          const v = p.pct as number;
          const below = v < target;
          const active = sel === p.month;
          return (
            <g key={p.yyyymm}>
              <circle cx={x(p.month)} cy={y(v)} r={active ? 3.6 : 2.2} fill={below ? 'rgb(var(--color-expense))' : 'rgb(var(--color-income))'} />
              <text x={x(p.month)} y={y(v) - 5} textAnchor="middle" fontSize={7.5} className="fill-muted">{Math.round(v)}</text>
              {/* অদৃশ্য কলাম-টার্গেট: ট্যাপ/কীবোর্ডে মাসের হার দেখায় */}
              <rect
                x={x(p.month) - 11}
                y={0}
                width={22}
                height={H + 12}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${MONTH_SHORT[p.month - 1]} ${year}: savings rate ${pct1(v)}%`}
                aria-pressed={active}
                className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => setSel(active ? null : p.month)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(active ? null : p.month); } }}
              />
            </g>
          );
        })}
        {MONTH_SHORT.map((c, i) => (
          <text key={c} x={x(i + 1)} y={H + 8} textAnchor="middle" fontSize={7} className="fill-muted">{c}</text>
        ))}
      </svg>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Chip tone={st.streakAbove > 0 ? 'good' : 'bad'}>Months above target: {st.streakAbove}</Chip>
        {selPoint && (
          <span role="status" className="text-xs text-fg">
            {MONTH_SHORT[selPoint.month - 1]}: <b className={(selPoint.pct as number) < target ? 'text-expense' : 'text-income'}>{pct1(selPoint.pct as number)}%</b>
          </span>
        )}
      </div>
      {partialMonth != null && <p className="mt-1.5 text-[11px] leading-relaxed text-muted">Current month ({MONTH_SHORT[partialMonth - 1]}) is incomplete, so it isn’t counted.</p>}
      {st.extraNeededMinor != null && st.avgIncomeMinor != null && (
        <Tip>To reach the target, save <b>{formatTakaWhole(st.extraNeededMinor)}</b> more per month (assuming {formatTakaWhole(st.avgIncomeMinor)} income).</Tip>
      )}
    </Block>
  );
}

function CreepRow({ label, a, b, pct, max, color, upGood }: { label: string; a: number; b: number; pct: number | null; max: number; color: string; upGood: boolean }) {
  const good = pct == null ? true : upGood ? pct >= 0 : pct <= 0;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-fg">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted">{formatTakaWhole(a)} → {formatTakaWhole(b)}</span>
          {pct != null && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${good ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>{signed(pct)}</span>}
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface" role="img" aria-label={`${label}: ${formatTakaWhole(a)} to ${formatTakaWhole(b)}`}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, (b / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

const CREEP_TIP: Record<string, string> = {
  income_fell_expense_stuck: 'Income fell more than expenses — the main reason the savings rate dropped.',
  expense_outpaced: 'Expenses grew faster than income — that is lifestyle creep.',
  expense_slower: 'Income grew faster than expenses — a good sign.',
  both_down_good: 'Income fell, but expenses fell even more — well managed.',
};

/** ২. লাইফস্টাইল ক্রিপ — গড় মাসিক আয় ও ব্যয়, আগের বছরের সাথে */
export function LifestyleCreepCard({ year, prev, cur, monthsCur, monthsPrev = 12, samePeriod = false, prevFromRecord = false }: { year: number; prev: { incomeMinor: number; expenseMinor: number }; cur: { incomeMinor: number; expenseMinor: number }; monthsCur: number; monthsPrev?: number; samePeriod?: boolean; prevFromRecord?: boolean }) {
  const c = useMemo(() => lifestyleCreep(prev, cur, monthsCur, monthsPrev), [prev, cur, monthsCur, monthsPrev]);
  if (!c) return null;
  const maxInc = Math.max(c.incomeAvgPrev, c.incomeAvgCur, 1);
  const maxExp = Math.max(c.expenseAvgPrev, c.expenseAvgCur, 1);
  return (
    <Block icon={Scale} tone="warning" title="Lifestyle Creep" sub={`Monthly avg · ${year - 1} → ${year}${samePeriod ? ` (same period: Jan–${MONTH_SHORT[monthsCur - 1]})` : monthsCur < 12 ? ` (${year}: ${monthsCur} months)` : ''}`}>
      <CreepRow label="Income" a={c.incomeAvgPrev} b={c.incomeAvgCur} pct={c.incomeChangePct} max={maxInc} color="rgb(var(--color-income))" upGood />
      <CreepRow label="Expense" a={c.expenseAvgPrev} b={c.expenseAvgCur} pct={c.expenseChangePct} max={maxExp} color="rgb(var(--color-expense))" upGood={false} />
      {CREEP_TIP[c.verdict] && <Tip>{CREEP_TIP[c.verdict]}</Tip>}
      {!samePeriod && monthsCur < 12 && <p className="mt-2 text-[11px] leading-relaxed text-muted">Compared with the full-year {year - 1} average — data for the same months isn’t complete in the app.</p>}
      {prevFromRecord && <p className="mt-2 text-[11px] leading-relaxed text-muted">{year - 1} figures are migrated from Excel records, not live transactions.</p>}
    </Block>
  );
}

/** ৩. আসল বৃদ্ধি (মূল্যস্ফীতি বাদে) — শেষ ১২ মাস */
export function RealGrowthCard({ snapshots, inflationPct }: { snapshots: readonly NetWorthSnapshotLite[]; inflationPct: number | null }) {
  const g = useMemo(() => (inflationPct != null ? realGrowth(snapshots, inflationPct) : null), [snapshots, inflationPct]);
  if (inflationPct == null) {
    return (
      <Block icon={LineChart} title="Real Growth" sub="How much wealth really grew after inflation">
        <p className="text-xs text-muted">Set the inflation % (Menu → Monthly Target → Inflation) and the result will appear here.</p>
      </Block>
    );
  }
  if (!g) return null;
  const tile = 'flex-1 rounded-xl bg-surface px-2 py-2.5 text-center';
  return (
    <Block icon={LineChart} title="Real Growth" sub={`After inflation · ${g.baseYyyymm} → ${g.latestYyyymm} · inflation ${pct1(g.inflationPct)}%`}>
      <div className="flex items-center gap-1.5">
        <div className={tile}>
          <p className="text-[11px] text-muted">Net worth growth</p>
          <p className={`text-base font-semibold ${g.nominalPct >= 0 ? 'text-income' : 'text-expense'}`}>{signed(g.nominalPct)}</p>
        </div>
        <span aria-hidden className="text-muted">−</span>
        <div className={tile}>
          <p className="text-[11px] text-muted">Inflation</p>
          <p className="text-base font-semibold text-expense">{pct1(g.inflationPct)}%</p>
        </div>
        <span aria-hidden className="text-muted">=</span>
        <div className={tile}>
          <p className="text-[11px] text-muted">Real growth</p>
          <p className={`text-base font-semibold ${g.realPct >= 0 ? 'text-income' : 'text-expense'}`}>{signed(g.realPct)}</p>
        </div>
      </div>
      {g.spanMonths !== 12 && <Tip>The comparison spans {g.spanMonths} months (not 12) but inflation is annual — so the result is approximate.</Tip>}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">Today’s {formatTakaWhole(g.latestMinor)} buys about what {formatTakaWhole(g.purchasingPowerMinor)} did a year ago.</p>
    </Block>
  );
}

/** ৪. Investment Report */
export function InvestmentHonestCard({ investments, today }: { investments: readonly InvestmentLite[]; today?: string }) {
  const r = useMemo(() => investmentHonest(investments, today), [investments, today]);
  if (!r || r.totalMinor <= 0) return null;
  const parts = [
    { key: 'running', label: 'Running', v: r.runningMinor, color: 'rgb(var(--chart-1))' },
    { key: 'returned', label: 'Returned', v: r.returnedMinor, color: 'rgb(var(--color-income))' },
    { key: 'doubtful', label: 'Doubtful', v: r.doubtfulMinor, color: 'rgb(var(--chart-7))' },
    { key: 'written', label: 'Written-off', v: r.writtenOffMinor, color: 'rgb(var(--color-expense))' },
  ];
  return (
    <Block icon={TrendingUp} tone="income" title="Investment Reality Check" sub={`Total invested ${formatTakaWhole(r.totalMinor)}`}>
      <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label="Where the invested principal is">
        {parts.map((p) => (p.v > 0 ? <div key={p.key} style={{ width: `${(p.v / r.totalMinor) * 100}%`, background: p.color }} /> : null))}
      </div>
      <ul>
        {parts.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-2 border-t border-muted/10 py-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-fg">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="text-fg"><b>{formatTakaWhole(p.v)}</b> <span className="text-muted">· {pct1((p.v / r.totalMinor) * 100)}%</span></span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <div className="flex-1 rounded-xl bg-income/10 px-3 py-1.5">
          <p className="text-[11px] text-muted">Profit</p>
          <p className="text-base font-semibold text-income">{formatNetTakaWhole(r.profitMinor)}</p>
        </div>
        <div className="flex-1 rounded-xl bg-expense/10 px-3 py-1.5">
          <p className="text-[11px] text-muted">Loss</p>
          <p className="text-base font-semibold text-expense">{formatNetTakaWhole(-r.lossMinor)}</p>
        </div>
      </div>
      {r.annualRatePct != null && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">Estimated annual rate: <b className={r.annualRatePct >= 0 ? 'text-income' : 'text-expense'}>{signed(r.annualRatePct)}</b> (based on how long the principal was locked; profit on still-running money isn’t counted).</p>
      )}
      <Tip>
        <b>Net result: {formatNetTakaWhole(r.netMinor)}</b>
        {r.netPctOfTotal != null ? ` (${pct1(r.netPctOfTotal)}%)` : ''}
        {r.atRiskPct != null && r.atRiskPct > 0 ? ` — another ${pct1(r.atRiskPct)}% still at risk` : ''}.
      </Tip>
    </Block>
  );
}

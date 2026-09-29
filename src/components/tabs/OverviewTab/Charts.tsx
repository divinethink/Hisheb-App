import { useId } from 'react';
import { categoryColorIndex, formatAmount } from '../../../lib/format';
import { getCategoryIcon } from '../../../lib/categoryIcons';
import type { CategoryShare } from '../../../lib/overviewCalc';

// SVG url(#id) reference-এ React-এর useId() ফেরানো কোলন (":r0:") কিছু browser-এ ভাঙতে পারে —
// তাই gradient-id বানানোর সময় সবসময় এই helper দিয়ে sanitize করা হবে (alnum+dash-ই থাকবে)।
const svgId = (id: string) => id.replace(/:/g, '');

// হালকা inline SVG/CSS চার্ট — কোনো chart-library dependency নেই (bundle ও package-lock ঝুঁকি এড়াতে)।
// অর্থ শুধু রঙে নয়: প্রতিটা সারিতে নাম, পরিমাণ ও শতাংশ টেক্সটে আছে (accessibility, UI Mockup §৩.১)।

const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-8'];
const chartVar = (name: string) => CHART_VARS[categoryColorIndex(name, CHART_VARS.length)];

export function CategoryBars({ items, onSelect }: { items: readonly CategoryShare[]; onSelect?: (name: string) => void }) {
  if (items.length === 0) return <p className="text-sm text-muted">No expenses in this period.</p>;
  return (
    <ul aria-label="Expense by category" className="flex flex-col gap-2">
      {items.map((c) => {
        const v = chartVar(c.name);
        return (
          <li key={c.name}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(c.name)}
              className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
            <div className="flex justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="shrink-0 text-sm leading-none">{getCategoryIcon(c.name, 'expense')}</span>
                <span className="min-w-0 truncate text-fg">{c.name}</span>
              </span>
              <span className="shrink-0 text-fg">
                {formatAmount(c.totalMinor)} <span className="text-muted">· {Math.round(c.share * 100)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded bg-muted/15" aria-hidden>
              <div className="h-2 rounded" style={{ width: `${Math.max(2, c.share * 100)}%`, background: `rgb(var(${v}))` }} />
            </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** ক্যাটাগরি-ওয়াইজ ব্যয়ের multi-colour donut — Home/Ledger আইকনের সাথে একই রঙ-হ্যাশ (categoryColorIndex)। */
export function CategoryDonut({ items, totalMinor }: { items: readonly CategoryShare[]; totalMinor: number }) {
  if (items.length === 0) return null;
  const r = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const summary = items.map((c) => `${c.name}: ${Math.round(c.share * 100)}%`).join(', ');
  const topShare = Math.round((items[0]?.share ?? 0) * 100);
  return (
    <div className="flex items-center justify-center py-1">
      <svg viewBox="0 0 120 120" width={144} height={144} role="img" aria-label={`Expense breakdown by category: ${summary}`}>
        {items.map((c) => {
          const v = chartVar(c.name);
          const len = c.share * circ;
          const el = (
            <circle
              key={c.name}
              cx={60}
              cy={60}
              r={r}
              fill="none"
              stroke={`rgb(var(${v}))`}
              strokeWidth={16}
              strokeDasharray={`${len.toFixed(2)} ${(circ - len).toFixed(2)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += len;
          return el;
        })}
        <g className="drop-shadow-sm">
          <text x="60" y="56" textAnchor="middle" fontSize="9" className="fill-muted">
            Top
          </text>
          <text x="60" y="70" textAnchor="middle" fontSize="13" fontWeight="600" className="fill-fg">
            {topShare}%
          </text>
        </g>
      </svg>
      <span className="sr-only">Total expense {formatAmount(totalMinor)}</span>
    </div>
  );
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** ১২ মাসের আয় (text-income) বনাম ব্যয় (text-expense) — grouped bars। */
export function IncomeExpenseBars({ rows }: { rows: readonly { yyyymm: string; incomeMinor: number; expenseMinor: number }[] }) {
  const gid = svgId(useId());
  const max = Math.max(1, ...rows.flatMap((r) => [r.incomeMinor, r.expenseMinor]));
  const H = 100;
  const summary = rows.map((r) => `${r.yyyymm}: income ${formatAmount(r.incomeMinor)}, expense ${formatAmount(r.expenseMinor)}`).join('; ');
  return (
    <div>
      <svg viewBox="0 0 240 118" className="w-full" role="img" aria-label={`Monthly income and expense. ${summary}`}>
        <defs>
          <linearGradient id={`${gid}-income`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-income))" stopOpacity={0.95} />
            <stop offset="100%" stopColor="rgb(var(--color-income))" stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id={`${gid}-expense`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-expense))" stopOpacity={0.95} />
            <stop offset="100%" stopColor="rgb(var(--color-expense))" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        {rows.map((r, i) => {
          const x = i * 20 + 2;
          const hi = (r.incomeMinor / max) * H;
          const he = (r.expenseMinor / max) * H;
          return (
            <g key={r.yyyymm}>
              <rect x={x} y={H - hi} width={7} height={hi} rx={1} fill={`url(#${gid}-income)`} />
              <rect x={x + 8} y={H - he} width={7} height={he} rx={1} fill={`url(#${gid}-expense)`} />
              <text x={x + 7.5} y={112} textAnchor="middle" fontSize={8} className="fill-muted">
                {MONTH_INITIALS[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex gap-4 text-xs text-muted">
        <span><span className="text-income">■</span> Income</span>
        <span><span className="text-expense">■</span> Expense</span>
      </p>
    </div>
  );
}

/** বছরভিত্তিক savings rate % — vertical bars, y=0 বেসলাইন (ঋণাত্মক rate নিচে)। Overview Enrichment ধাপ ৩ (All-Time)। */
export function SavingsRateBars({ items }: { items: readonly { year: number; pct: number }[] }) {
  const gid = svgId(useId());
  if (items.length === 0) return <p className="text-sm text-muted">Not enough data yet.</p>;
  const maxAbs = Math.max(1, ...items.map((i) => Math.abs(i.pct)));
  const H = 80;
  const mid = H / 2;
  const w = 32;
  const W = items.length * w;
  const summary = items.map((i) => `${i.year}: ${i.pct.toFixed(1)}%`).join('; ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label={`Savings rate by year. ${summary}`}>
        <defs>
          <linearGradient id={`${gid}-pos`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-income))" stopOpacity={0.95} />
            <stop offset="100%" stopColor="rgb(var(--color-income))" stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id={`${gid}-neg`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgb(var(--color-expense))" stopOpacity={0.95} />
            <stop offset="100%" stopColor="rgb(var(--color-expense))" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <line x1={0} y1={mid} x2={W} y2={mid} className="text-muted/30" stroke="currentColor" strokeWidth={1} />
        {items.map((it, i) => {
          const barH = Math.max(1, (Math.abs(it.pct) / maxAbs) * (mid - 4));
          const x = i * w + w * 0.2;
          const bw = w * 0.6;
          const y = it.pct >= 0 ? mid - barH : mid;
          return (
            <g key={it.year}>
              <rect x={x} y={y} width={bw} height={barH} rx={1} fill={`url(#${gid}-${it.pct >= 0 ? 'pos' : 'neg'})`} />
              <text x={x + bw / 2} y={H + 11} textAnchor="middle" fontSize={8} className="fill-muted">{it.year}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
        {items.map((it) => (
          <span key={it.year}>{it.year} {it.pct.toFixed(1)}%</span>
        ))}
      </p>
    </div>
  );
}

/** Net Worth Trend (G1): netWorthSnapshots-এর মাসিক Total Assets — pure-display line। Overview → All-Time-এ (owner-approved)। */
export function TrendLine({ points }: { points: readonly { yyyymm: string; valueMinor: number }[] }) {
  const gid = svgId(useId());
  if (points.length < 2) return <p className="text-sm text-muted">Trend appears after at least two monthly snapshots.</p>;
  const W = 240;
  const H = 90;
  const vals = points.map((p) => p.valueMinor);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * (W - 8) + 4, H - 6 - ((p.valueMinor - lo) / span) * (H - 16)] as const);
  const areaPath = `M${xy.map(([x, y]) => `${x},${y}`).join(' L')} L${xy[xy.length - 1][0]},${H} L${xy[0][0]},${H} Z`;
  const summary = points.map((p) => `${p.yyyymm}: ${formatAmount(p.valueMinor)}`).join('; ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-primary" role="img" aria-label={`Net worth trend. ${summary}`}>
        <defs>
          <linearGradient id={`${gid}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity={0.28} />
            <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gid}-area)`} />
        <polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        {xy.map(([x, y], i) => (
          <circle key={points[i].yyyymm} cx={x} cy={y} r={2.5} fill="currentColor" />
        ))}
      </svg>
      <p className="flex justify-between text-xs text-muted">
        <span>{points[0].yyyymm} · {formatAmount(points[0].valueMinor)}</span>
        <span>{points[points.length - 1].yyyymm} · {formatAmount(points[points.length - 1].valueMinor)}</span>
      </p>
    </div>
  );
}

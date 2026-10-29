import { useId, useState } from 'react';
import { categoryColorIndex, formatAmount, formatTakaWhole } from '../../../lib/format';
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
                {formatTakaWhole(c.totalMinor)} <span className="text-muted">· {Math.round(c.share * 100)}%</span>
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

// Spendee-স্টাইল donut: রিং-এর চারপাশে খাতের আইকন-বৃত্ত + শতাংশ; স্লাইস ট্যাপ করলে মাঝখানে সেই খাতের বিবরণ।
// ≥৩% ও পরস্পর ≥২০° দূরের স্লাইসেই লেবেল বসে (গাদাগাদি এড়াতে) — বাকি সবই নিচের তালিকায় আছে।
const DONUT = { cx: 150, cy: 116, r: 62, sw: 24 };
const LABEL_MIN_SHARE = 0.03;
const LABEL_MIN_GAP_DEG = 20;

/** ক্যাটাগরি-ওয়াইজ ব্যয়ের multi-colour donut — Home/Ledger আইকনের সাথে একই রঙ-হ্যাশ (categoryColorIndex)। */
export function CategoryDonut({ items, totalMinor }: { items: readonly CategoryShare[]; totalMinor: number }) {
  const [active, setActive] = useState<string | null>(null);
  if (items.length === 0) return null;
  const { cx, cy, r, sw } = DONUT;
  const circ = 2 * Math.PI * r;
  const sum = items.reduce((a, c) => a + c.totalMinor, 0);
  const gap = items.length > 1 ? 0.8 : 0;
  const summary = items.map((c) => `${c.name}: ${Math.round(c.share * 100)}%`).join(', ');

  let offset = 0;
  const slices = items.map((c) => {
    const len = c.share * circ;
    const s = { c, len, start: offset, theta: ((offset + len / 2) / circ) * 2 * Math.PI };
    offset += len;
    return s;
  });

  // বড় স্লাইস আগে — ছোটগুলো জায়গা না পেলে লেবেল ছাড়াই থাকে
  const placed: number[] = [];
  const labelled = new Set<string>();
  [...slices]
    .sort((x, y) => y.c.share - x.c.share)
    .forEach((s) => {
      if (s.c.share < LABEL_MIN_SHARE) return;
      const deg = (s.theta * 180) / Math.PI;
      const ok = placed.every((p) => {
        const d = Math.abs(p - deg) % 360;
        return Math.min(d, 360 - d) >= LABEL_MIN_GAP_DEG;
      });
      if (ok) {
        placed.push(deg);
        labelled.add(s.c.name);
      }
    });

  const R_ICON = r + sw / 2 + 16;
  const sel = active ? slices.find((s) => s.c.name === active) ?? null : null;
  const centerAmt = formatTakaWhole(sel ? sel.c.totalMinor : sum);
  const centerSize = centerAmt.length > 9 ? 12 : 15;
  const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

  return (
    <div className="flex justify-center py-1">
      <svg viewBox="0 0 300 232" className="w-full max-w-[340px]" aria-hidden>
        {slices.map(({ c, len, start }) => (
          <circle
            key={c.name}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`rgb(var(${chartVar(c.name)}))`}
            strokeWidth={active === c.name ? sw + 4 : sw}
            strokeDasharray={`${Math.max(0, len - gap).toFixed(2)} ${(circ - Math.max(0, len - gap)).toFixed(2)}`}
            strokeDashoffset={-start}
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={active && active !== c.name ? 0.3 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 150ms' }}
            onClick={() => setActive(active === c.name ? null : c.name)}
          />
        ))}
        {slices.map(({ c, theta }) => {
          if (!labelled.has(c.name)) return null;
          const sin = Math.sin(theta);
          const cos = Math.cos(theta);
          const ix = cx + R_ICON * sin;
          const iy = cy - R_ICON * cos;
          const side = sin > 0.35 ? 'start' : sin < -0.35 ? 'end' : 'middle';
          const tx = side === 'middle' ? ix : side === 'start' ? ix + 15 : ix - 15;
          const ty = side === 'middle' ? (cos > 0 ? iy - 14 : iy + 20) : iy + 3.5;
          const v = `rgb(var(${chartVar(c.name)}))`;
          const dim = active && active !== c.name ? 0.35 : 1;
          return (
            <g key={c.name} opacity={dim} style={{ cursor: 'pointer', transition: 'opacity 150ms' }} onClick={() => setActive(active === c.name ? null : c.name)}>
              <circle cx={ix} cy={iy} r={11} fill={v} fillOpacity={0.18} stroke={v} strokeWidth={1} />
              <text x={ix} y={iy + 4} textAnchor="middle" fontSize={11}>{getCategoryIcon(c.name, 'expense')}</text>
              <text x={tx} y={ty} textAnchor={side} fontSize={10} fontWeight={600} className="fill-fg">
                {Math.round(c.share * 100)}%
              </text>
            </g>
          );
        })}
        <g style={{ cursor: active ? 'pointer' : 'default' }} onClick={() => setActive(null)}>
          <circle cx={cx} cy={cy} r={r - sw / 2 - 2} fill="transparent" />
          {sel ? (
            <>
              <text x={cx} y={cy - 12} textAnchor="middle" fontSize={9} className="fill-muted">{clip(sel.c.name, 14)}</text>
              <text x={cx} y={cy + 5} textAnchor="middle" fontSize={centerSize} fontWeight={700} className="fill-fg">{centerAmt}</text>
              <text x={cx} y={cy + 19} textAnchor="middle" fontSize={9} className="fill-muted">{Math.round(sel.c.share * 100)}%</text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize={9} className="fill-muted">Total</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize={centerSize} fontWeight={700} className="fill-fg">{centerAmt}</text>
            </>
          )}
        </g>
      </svg>
      <span className="sr-only">Expense breakdown by category: {summary}. Total expense {formatAmount(totalMinor)}</span>
    </div>
  );
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Income/Expense রঙ-চিহ্ন — কার্ডের শিরোনাম-সারির ডানে বসে (চার্টের নিচে আলাদা লাইন লাগে না)। */
export function IncomeExpenseLegend() {
  return (
    <span className="flex gap-3 text-[11px] text-muted" aria-hidden>
      <span><span className="text-income">■</span> Income</span>
      <span><span className="text-expense">■</span> Expense</span>
    </span>
  );
}

/** ১২ মাসের আয় (text-income) বনাম ব্যয় (text-expense) — grouped bars; মাস ট্যাপ করলে নিচে সংখ্যা দেখায়। */
export function IncomeExpenseBars({ rows }: { rows: readonly { yyyymm: string; incomeMinor: number; expenseMinor: number }[] }) {
  const gid = svgId(useId());
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...rows.flatMap((r) => [r.incomeMinor, r.expenseMinor]));
  const H = 44;
  const summary = rows.map((r) => `${r.yyyymm}: income ${formatAmount(r.incomeMinor)}, expense ${formatAmount(r.expenseMinor)}`).join('; ');
  const picked = sel != null ? rows[sel] : null;
  const monthName = (yyyymm: string) => MONTH_SHORT[Number(yyyymm.slice(5, 7)) - 1] ?? yyyymm;
  return (
    <div>
      <svg viewBox="0 0 240 62" className="w-full" role="img" aria-label={`Monthly income and expense. ${summary}`}>
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
        <line x1={0} y1={H + 1} x2={240} y2={H + 1} className="text-muted/30" stroke="currentColor" strokeWidth={0.5} />
        {rows.map((r, i) => {
          const x = i * 20 + 2;
          const hi = (r.incomeMinor / max) * H;
          const he = (r.expenseMinor / max) * H;
          const dim = sel != null && sel !== i ? 0.35 : 1;
          return (
            <g key={r.yyyymm} opacity={dim}>
              {sel === i && <rect x={x - 2} y={0} width={19} height={60} rx={2} className="fill-muted/10" />}
              <rect x={x} y={H - hi} width={7} height={hi} rx={1.5} fill={`url(#${gid}-income)`} />
              <rect x={x + 8} y={H - he} width={7} height={he} rx={1.5} fill={`url(#${gid}-expense)`} />
              <text x={x + 7.5} y={57} textAnchor="middle" fontSize={7} fontWeight={sel === i ? 700 : 400} className="fill-muted">
                {monthName(r.yyyymm)}
              </text>
            </g>
          );
        })}
      </svg>
      {/* ট্যাপ-লক্ষ্য: SVG-র ওপর অদৃশ্য ১২টা বাটন নয়, বরং আলাদা মাস-সারি (≥44px) — কীবোর্ড/স্ক্রিন-রিডারেও চলে */}
      <div role="group" aria-label="Select a month to see its numbers" className="mt-1 grid grid-cols-6 gap-1">
        {rows.map((r, i) => (
          <button
            key={r.yyyymm}
            type="button"
            aria-pressed={sel === i}
            onClick={() => setSel(sel === i ? null : i)}
            className={`min-h-11 rounded-lg text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${sel === i ? 'bg-primary/10 font-semibold text-primary' : 'bg-surface text-muted'}`}
          >
            {monthName(r.yyyymm)}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-5 text-xs text-muted" aria-live="polite">
        {picked ? (
          <>
            <span className="font-semibold text-fg">{monthName(picked.yyyymm)}</span> · <span className="text-income">Income {formatTakaWhole(picked.incomeMinor)}</span> · <span className="text-expense">Expense {formatTakaWhole(picked.expenseMinor)}</span>
          </>
        ) : (
          'Tap a month to see its numbers.'
        )}
      </p>
    </div>
  );
}

/** বছরভিত্তিক savings rate % — vertical bars, y=0 বেসলাইন (ঋণাত্মক rate নিচে); % বারের গায়ে, তাই আলাদা তালিকা নেই। */
export function SavingsRateBars({ items }: { items: readonly { year: number; pct: number }[] }) {
  const gid = svgId(useId());
  if (items.length === 0) return <p className="text-sm text-muted">Not enough data yet.</p>;
  const maxAbs = Math.max(1, ...items.map((i) => Math.abs(i.pct)));
  const W = 240;
  const mid = 32;
  const maxBar = 22;
  const slot = W / Math.max(items.length, 3);
  const x0 = (W - slot * items.length) / 2;
  const bw = Math.min(24, slot * 0.5);
  const summary = items.map((i) => `${i.year}: ${i.pct.toFixed(1)}%`).join('; ');
  return (
    <svg viewBox={`0 0 ${W} 74`} className="w-full" role="img" aria-label={`Savings rate by year. ${summary}`}>
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
      <line x1={0} y1={mid} x2={W} y2={mid} className="text-muted/30" stroke="currentColor" strokeWidth={0.5} />
      {items.map((it, i) => {
        const barH = Math.max(1, (Math.abs(it.pct) / maxAbs) * maxBar);
        const cxm = x0 + i * slot + slot / 2;
        const pos = it.pct >= 0;
        return (
          <g key={it.year}>
            <rect x={cxm - bw / 2} y={pos ? mid - barH : mid} width={bw} height={barH} rx={1.5} fill={`url(#${gid}-${pos ? 'pos' : 'neg'})`} />
            <text x={cxm} y={pos ? mid - barH - 3 : mid + barH + 9} textAnchor="middle" fontSize={8} fontWeight={600} className="fill-fg">
              {it.pct.toFixed(1)}%
            </text>
            <text x={cxm} y={71} textAnchor="middle" fontSize={8} className="fill-muted">{it.year}</text>
          </g>
        );
      })}
    </svg>
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
        <span>{points[0].yyyymm} · {formatTakaWhole(points[0].valueMinor)}</span>
        <span>{points[points.length - 1].yyyymm} · {formatTakaWhole(points[points.length - 1].valueMinor)}</span>
      </p>
    </div>
  );
}

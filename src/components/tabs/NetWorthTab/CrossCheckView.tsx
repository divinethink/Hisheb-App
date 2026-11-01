import { useMemo } from 'react';
import { ChevronRight, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';
import { useNetWorthSnapshots, useRangeTransactions, useSettings } from '../../../hooks/useData';
import { computeCrossCheck, pickCrossCheckPair, addDays, type CrossCheckResult, type FactorKey, type SnapshotLike } from '../../../lib/crossCheck';
import type { NamedBalance } from '../../../lib/snapshotInsight';
import InsightPager from './InsightPager';
import { currentMonth, formatDisplayDate, toDhakaDate } from '../../../lib/date';
import { formatAmount, formatNet } from '../../../lib/format';
import type { Debt } from '../../../validation/debtSchema';
import type { Investment } from '../../../validation/investmentSchema';
import type { AccountBalance, NetWorthSnapshot } from '../../../validation/netWorthSchema';
import type { GpfEntry } from '../../../validation/gpfSchema';

// Cross-check Summary → Details (UI Mockup §৬/§৬.২, progressive disclosure)। ফর্মুলা/লজিক lib/crossCheck.ts-এ।
// শুধু current-vs-previous-snapshot prospective (C7)। `period` = যে মাস দেখা হচ্ছে (Net Worth ‹ মাস ›); চলতি মাসে snapshot না
// থাকলে ও নতুন আপডেট না হলে সর্বশেষ snapshot-এর Cross-check দেখায় (pickCrossCheckPair, owner-request 2026-11-01)।

const FACTOR_LABEL: Record<FactorKey, string> = {
  investmentClosure: 'Closed / written-off investments',
  debtForgiven: 'Forgiven receivables',
  debtExcessRepayment: 'Extra repayment received (debts)',
  iOweChange: 'Borrowed / repaid (I Owe)',
  gpfChange: 'GPF change',
};

interface Props {
  uid: string;
  mode: 'summary' | 'details';
  /** দেখা হচ্ছে যে মাস (yyyymm) */
  period: string;
  /** মাস অনুযায়ী accountBalances-derived account-তালিকা (Insight কার্ডে account-ভিত্তিক তুলনার জন্য) */
  derivedByMonth: ReadonlyMap<string, NamedBalance[]>;
  liveTotalMinor: number;
  /** লাইভ Total Assets-এর as-of তারিখ (সর্বশেষ account-snapshot) — এটা previous snapshot-এর পরে না হলে Cross-check অর্থহীন */
  basisDate: string;
  debts: readonly Debt[];
  investments: readonly Investment[];
  gpfEntries: readonly GpfEntry[];
  balances: readonly AccountBalance[];
  onOpen?: () => void;
  onBack?: () => void;
}

export default function CrossCheckView(props: Props) {
  const snaps = useNetWorthSnapshots(props.uid);
  const { period, basisDate } = props;
  const snapshots = snaps.state.status === 'ready' ? snaps.state.data : null;
  const pair = useMemo(() => (snapshots ? pickCrossCheckPair(snapshots, period, basisDate) : null), [snapshots, period, basisDate]);

  if (!pair) {
    if (props.mode === 'details') {
      return (
        <FullScreenPage title="Cross-check Details" onBack={props.onBack!}>
          <p className="text-sm text-muted">{snaps.state.status === 'error' ? 'Couldn’t load snapshots.' : 'Loading…'}</p>
        </FullScreenPage>
      );
    }
    return snaps.state.status === 'error' ? (
      <p role="alert" className="px-4 pt-4 text-sm text-muted">
        Cross-check unavailable — couldn’t load snapshots.
      </p>
    ) : null;
  }

  if (!pair.previous) {
    return props.mode === 'summary' && period === currentMonth() ? (
      <p className="px-4 pt-4 text-sm text-muted">
        ℹ️ Cross-check starts after your first monthly snapshot (use “Update This Month’s Balance”).
      </p>
    ) : null;
  }

  return <Loaded {...props} snapshots={snapshots!} period={pair.current ? pair.current.yyyymm : period} previous={pair.previous} current={pair.current} />;
}

function Loaded({
  uid,
  mode,
  liveTotalMinor,
  basisDate,
  debts,
  investments,
  gpfEntries,
  balances,
  onOpen,
  onBack,
  derivedByMonth,
  snapshots,
  period,
  previous,
  current,
}: Props & {
  snapshots: readonly NetWorthSnapshot[];
  previous: SnapshotLike;
  current: SnapshotLike | null;
}) {
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  const today = toDhakaDate(new Date());
  const start = addDays(previous.snapshotDate, 1);
  const end = current ? current.snapshotDate : today;
  // window উল্টে গেলে (snapshotDate ভবিষ্যতে/ভুল) খালি রেঞ্জ — query তবু বৈধ, savings ০
  const tx = useRangeTransactions(uid, start, end < start ? start : end);

  const result: CrossCheckResult | null = useMemo(() => {
    if (tx.state.status !== 'ready') return null;
    return computeCrossCheck({
      previous,
      current,
      liveTotalAssetsMinor: liveTotalMinor,
      today,
      transactions: tx.state.data,
      debts,
      investments,
      gpfEntries,
      periodBalances: balances,
      period,
    });
  }, [tx.state, previous, current, liveTotalMinor, today, debts, investments, gpfEntries, balances, period]);

  // চলতি মাসের snapshot নেই এবং Account balance previous snapshot-এর পরে আপডেট হয়নি → তুলনার কিছু নেই
  // (নইলে ভুয়া "Deviation = −সঞ্চয়" দেখাত)। আপডেটের পর Cross-check চলে।
  if (current === null && basisDate <= previous.snapshotDate) {
    const note = `Balances haven’t been updated since ${formatDisplayDate(basisDate, dateFormat)} — Cross-check runs after your next balance update.`;
    return mode === 'details' ? (
      <FullScreenPage title="Cross-check Details" onBack={onBack!}>
        <p className="text-sm text-muted">{note}</p>
      </FullScreenPage>
    ) : (
      <p className="px-4 pt-4 text-sm text-muted">ℹ️ {note}</p>
    );
  }

  if (tx.state.status === 'error') {
    const retry = (
      <div role="alert" className="rounded-lg border border-muted/10 bg-canvas p-3 text-sm text-fg">
        Couldn’t load Cross-check data.{' '}
        <button type="button" onClick={tx.retry} className="min-h-11 font-medium text-primary">
          Retry
        </button>
      </div>
    );
    return mode === 'details' ? (
      <FullScreenPage title="Cross-check Details" onBack={onBack!}>
        {retry}
      </FullScreenPage>
    ) : (
      <div className="px-4 pt-4">{retry}</div>
    );
  }

  if (!result) {
    return mode === 'details' ? (
      <FullScreenPage title="Cross-check Details" onBack={onBack!}>
        <p className="text-sm text-muted">Loading…</p>
      </FullScreenPage>
    ) : (
      <div className="mx-4 mt-4 h-11 animate-pulse rounded-lg border border-muted/10 bg-canvas" aria-hidden />
    );
  }

  if (mode === 'summary') {
    // UI Polish [1_5] §২ item ৪: icon-badge স্টাইল, matched-state-এও সমান visual treatment।
    const matched = result.status === 'matched';
    return (
      <>
      <div className="px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={onOpen}
          className={`flex min-h-11 w-full items-center gap-3 rounded-2xl border bg-canvas p-3.5 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            matched ? 'border-income/25' : 'border-warning/30'
          }`}
        >
          <IconBadge icon={matched ? CircleCheck : TriangleAlert} tone={matched ? 'income' : 'warning'} size={44} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Cross-check</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  matched ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning'
                }`}
              >
                {matched ? 'Matched' : 'Deviation'}
              </span>
            </span>
            <span className="mt-0.5 block text-lg font-semibold leading-tight text-fg">
              {matched ? 'All figures agree' : formatNet(result.deviationMinor)}
            </span>
            {!matched && (
              <span className={`block text-xs ${result.unexplainedMinor === 0 ? 'text-muted' : 'text-expense'}`}>
                {result.unexplainedMinor === 0 ? 'Fully explained by known factors' : `Unexplained: ${formatNet(result.unexplainedMinor)}`}
              </span>
            )}
            <span className="mt-0.5 block text-xs text-muted">
              {result.currentIsLive ? 'Live' : formatDisplayDate(result.windowEnd, dateFormat)} vs {formatDisplayDate(result.previous.snapshotDate, dateFormat)} snapshot
            </span>
          </span>
          <ChevronRight aria-hidden size={20} className="shrink-0 text-muted" />
        </button>
      </div>
      {/* "মাসিক বিশ্লেষণ" — আঙুল টেনে আগের মাসেও যাওয়া যায়; শুরু হয় এই snapshot থেকে (লাইভ তুলনায় কার্ড নেই) */}
      {current && (
        <InsightPager
          key={current.yyyymm}
          startYyyymm={current.yyyymm}
          uid={uid}
          snapshots={snapshots}
          debts={debts}
          investments={investments}
          gpfEntries={gpfEntries}
          balances={balances}
          derivedByMonth={derivedByMonth}
          dateFormat={dateFormat}
        />
      )}
      </>
    );
  }

  return <Details r={result} onBack={onBack!} dateFormat={dateFormat} />;
}

const signCls = (n: number) => (n === 0 ? 'text-muted' : n > 0 ? 'text-income' : 'text-expense');

/** হিসাবের এক ধাপ: বাঁয়ে নাম (+ ছোট উপ-লেখা), ডানে অঙ্ক */
function Line({ label, sub, value, valueCls = 'text-fg', tint }: { label: string; sub?: string; value: string; valueCls?: string; tint?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${tint ?? ''}`}>
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${valueCls}`}>{value}</span>
    </div>
  );
}

function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between px-1 pb-1.5 pt-1">
      <h3 className="text-sm font-semibold text-fg">{children}</h3>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function Details({ r, onBack, dateFormat }: { r: CrossCheckResult; onBack: () => void; dateFormat: 'dmy' | 'mdy' }) {
  const d = (x: string) => formatDisplayDate(x, dateFormat);
  const matched = r.status === 'matched';
  const windowText = r.windowStart > r.windowEnd ? 'No days since the previous snapshot' : `${d(r.windowStart)} – ${d(r.windowEnd)}${r.currentIsLive ? ' (live)' : ''}`;
  const notes: string[] = [];
  if (r.previousUnverified) notes.push('The previous snapshot is marked unverified, so this comparison may be off.');
  if (r.lateSnapshotDates.length > 0) notes.push(`Balances were updated on ${r.lateSnapshotDates.map(d).join(', ')}, so a small deviation is expected.`);
  notes.push('Factors show what may explain the difference; balances you haven’t updated yet can cause timing gaps. Only “Unexplained” needs your attention.');

  return (
    <FullScreenPage title="Cross-check Details" onBack={onBack}>
      <div className="flex flex-col gap-3 pb-8">
        {/* ফলাফল-হিরো */}
        <Card className={`flex items-center gap-3 border p-3.5 ${matched ? 'border-income/25' : 'border-warning/30'}`}>
          <IconBadge icon={matched ? CircleCheck : TriangleAlert} tone={matched ? 'income' : 'warning'} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${matched ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning'}`}>
                {matched ? 'Matched' : 'Deviation'}
              </span>
              <span className="text-xs text-muted">current − expected</span>
            </div>
            <p className="mt-0.5 text-2xl font-semibold leading-tight tabular-nums text-fg">{matched ? 'All figures agree' : formatNet(r.deviationMinor)}</p>
            <p className="mt-0.5 text-xs text-muted">Window: {windowText}</p>
          </div>
        </Card>

        {/* হিসাব কীভাবে হলো */}
        <section>
          <SectionTitle hint="step by step">How it’s calculated</SectionTitle>
          <Card className="divide-y divide-muted/10 overflow-hidden">
            <Line label="Previous snapshot" sub={d(r.previous.snapshotDate)} value={formatAmount(r.previousTotalMinor)} />
            <Line label="+ Savings in window" sub="income − expense" value={formatNet(r.savingsMinor)} valueCls={signCls(r.savingsMinor)} />
            <Line label="= Expected" value={formatAmount(r.expectedMinor)} tint="bg-primary/5" />
            <Line label="Current total assets" sub={r.currentIsLive ? 'live' : `snapshot ${d(r.windowEnd)}`} value={formatAmount(r.currentMinor)} />
            <Line label="Deviation" sub="current − expected" value={formatNet(r.deviationMinor)} valueCls={matched ? 'text-income' : 'text-warning'} tint={matched ? 'bg-income/5' : 'bg-warning/5'} />
          </Card>
        </section>

        {/* কী কী ব্যাখ্যা করতে পারে */}
        {(!matched || r.factors.length > 0) && (
          <section>
            <SectionTitle hint={r.factors.length ? `${r.factors.length} factor${r.factors.length === 1 ? '' : 's'}` : undefined}>What may explain it</SectionTitle>
            <Card className="divide-y divide-muted/10 overflow-hidden">
              {r.factors.map((f) => (
                <div key={f.key} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${f.effectMinor >= 0 ? 'bg-income' : 'bg-expense'}`} />
                      {FACTOR_LABEL[f.key]}
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${signCls(f.effectMinor)}`}>{formatNet(f.effectMinor)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
                    {f.detail.map((n) => (
                      <span key={n} className="rounded-full bg-muted/10 px-2 py-0.5 text-xs text-muted">{n}</span>
                    ))}
                  </div>
                </div>
              ))}
              <Line
                label="Unexplained"
                sub={r.unexplainedMinor === 0 ? 'Fully explained by the factors above' : 'Needs your attention'}
                value={formatNet(r.unexplainedMinor)}
                valueCls={r.unexplainedMinor === 0 ? 'text-income' : 'text-expense'}
                tint={r.unexplainedMinor === 0 ? 'bg-income/5' : 'bg-expense/5'}
              />
            </Card>
          </section>
        )}

        {/* নোট */}
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n} className="flex items-start gap-2 rounded-xl bg-muted/10 px-3 py-2.5 text-[13px] leading-relaxed text-muted">
              <Info aria-hidden size={16} className="mt-0.5 shrink-0" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </FullScreenPage>
  );
}

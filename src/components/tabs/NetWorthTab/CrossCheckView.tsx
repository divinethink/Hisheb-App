import { useMemo } from 'react';
import { ChevronRight, CircleCheck, TriangleAlert } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import IconBadge from '../../common/IconBadge';
import { useNetWorthSnapshots, useRangeTransactions, useSettings } from '../../../hooks/useData';
import { computeCrossCheck, pickCrossCheckPair, addDays, type CrossCheckResult, type FactorKey, type SnapshotLike } from '../../../lib/crossCheck';
import { buildSnapshotInsight, type NamedBalance } from '../../../lib/snapshotInsight';
import { monthName } from '../../../lib/historyCalc';
import SnapshotInsightCard from './SnapshotInsightCard';
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

  // Insight কার্ড: শুধু যখন চলতি দিকে একটা সংরক্ষিত snapshot আছে (লাইভ তুলনায় নয়) — snapshot আপডেট হলে এটাই "বিবরণ কার্ড"
  const insight = useMemo(() => {
    if (!result || !current || tx.state.status !== 'ready') return null;
    const cur = snapshots.find((s) => s.yyyymm === current.yyyymm);
    const prev = snapshots.find((s) => s.yyyymm === previous.yyyymm);
    if (!cur || !prev) return null;
    return buildSnapshotInsight({
      previous: prev,
      current: cur,
      previousDerivedAccounts: derivedByMonth.get(prev.yyyymm) ?? [],
      currentDerivedAccounts: derivedByMonth.get(cur.yyyymm) ?? [],
      transactions: tx.state.data,
      cross: result,
      fmt: formatAmount,
      monthShort: (m) => monthName(m, true),
    });
  }, [result, current, previous, snapshots, derivedByMonth, tx.state]);

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
          className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-muted/10 bg-canvas p-3 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <IconBadge icon={matched ? CircleCheck : TriangleAlert} tone={matched ? 'income' : 'warning'} size={32} />
          <span className="min-w-0 flex-1 text-sm text-fg">
            {matched ? 'Cross-check Matched' : `Deviation: ${formatNet(result.deviationMinor)}`}
            <span className="block text-xs text-muted">
              {result.currentIsLive ? 'Live' : `Snapshot ${formatDisplayDate(result.windowEnd, dateFormat)}`} vs snapshot {formatDisplayDate(result.previous.snapshotDate, dateFormat)}
            </span>
          </span>
          <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
        </button>
      </div>
      {insight && <SnapshotInsightCard insight={insight} />}
      </>
    );
  }

  return <Details r={result} onBack={onBack!} dateFormat={dateFormat} />;
}

function Row({ label, value, strong, indent }: { label: string; value: string; strong?: boolean; indent?: boolean }) {
  return (
    <p className={`flex justify-between gap-3 py-1 text-sm ${indent ? 'pl-4' : ''}`}>
      <span className={strong ? 'font-medium text-fg' : 'text-muted'}>{label}</span>
      <span className={strong ? 'font-semibold text-fg' : 'text-fg'}>{value}</span>
    </p>
  );
}

function Details({ r, onBack, dateFormat }: { r: CrossCheckResult; onBack: () => void; dateFormat: 'dmy' | 'mdy' }) {
  const shortDate = (d: string) => formatDisplayDate(d, dateFormat);
  return (
    <FullScreenPage title="Cross-check Details" onBack={onBack}>
      <p className="pb-2 text-sm text-muted">
        {r.windowStart > r.windowEnd
          ? 'Window: no days since the previous snapshot'
          : `Window: ${shortDate(r.windowStart)} – ${shortDate(r.windowEnd)}`}
        {r.currentIsLive ? ' (live)' : ''}
      </p>

      <Row label={`Previous snapshot (${shortDate(r.previous.snapshotDate)})`} value={formatAmount(r.previousTotalMinor)} />
      <Row label="+ Savings in window" value={formatNet(r.savingsMinor)} />
      <Row label="= Expected" value={formatAmount(r.expectedMinor)} strong />
      <Row label={r.currentIsLive ? 'Current Total Assets (live)' : 'Current Total Assets (snapshot)'} value={formatAmount(r.currentMinor)} />

      <div className="my-2 border-t border-muted/20" />
      <Row label="Deviation (current − expected)" value={formatNet(r.deviationMinor)} strong />
      {r.status === 'matched' && <p className="pt-1 text-sm text-fg">✅ Matched — no deviation.</p>}

      {r.factors.map((f) => (
        <div key={f.key} className="pl-4">
          <Row label={`└ ${FACTOR_LABEL[f.key]}`} value={formatNet(f.effectMinor)} />
          <p className="-mt-1 pl-4 text-xs text-muted">{f.detail.join(', ')}</p>
        </div>
      ))}
      {r.status === 'deviation' && <Row indent label="└ Unexplained" value={formatNet(r.unexplainedMinor)} />}

      <div className="mt-4 flex flex-col gap-2 text-xs text-muted">
        {r.previousUnverified && (
          <p>ℹ️ The previous snapshot is marked unverified, so this comparison may be off.</p>
        )}
        {r.lateSnapshotDates.length > 0 && (
          <p>
            ℹ️ Balances were updated on {r.lateSnapshotDates.map(shortDate).join(', ')}, so a small deviation is expected.
          </p>
        )}
        <p>
          ℹ️ Factors show what may explain the difference; balances you haven’t updated yet can cause timing gaps. Only
          “Unexplained” needs your attention.
        </p>
      </div>
    </FullScreenPage>
  );
}

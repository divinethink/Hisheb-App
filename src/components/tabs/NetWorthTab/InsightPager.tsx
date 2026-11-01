import { useMemo, useRef, useState } from 'react';
import SnapshotInsightCard, { type InsightNav } from './SnapshotInsightCard';
import { useRangeTransactions } from '../../../hooks/useData';
import { addDays, computeCrossCheck, type CrossCheckResult } from '../../../lib/crossCheck';
import { buildSnapshotInsight, listInsightPairs, swipeDirection, type NamedBalance } from '../../../lib/snapshotInsight';
import { monthLabelBn, toDhakaDate } from '../../../lib/date';
import { formatTaka } from '../../../lib/format';
import type { Debt } from '../../../validation/debtSchema';
import type { Investment } from '../../../validation/investmentSchema';
import type { GpfEntry } from '../../../validation/gpfSchema';
import type { AccountBalance, NetWorthSnapshot } from '../../../validation/netWorthSchema';

// "মাসিক বিশ্লেষণ" কার্ডে আঙুল ডানে-বাঁয়ে টেনে (বা ‹ › চেপে) আগের মাসগুলোর বিশ্লেষণ দেখা (owner-request 2026-11-01)।
// শুধু দেখানো — কিছু লেখা/store হয় না। একবারে শুধু দেখানো মাসের লেনদেন-query চলে (lazy); বাকি মাস আঙুল টানলে লোড হয়।

interface Shared {
  uid: string;
  snapshots: readonly NetWorthSnapshot[];
  debts: readonly Debt[];
  investments: readonly Investment[];
  gpfEntries: readonly GpfEntry[];
  balances: readonly AccountBalance[];
  derivedByMonth: ReadonlyMap<string, NamedBalance[]>;
  dateFormat: 'dmy' | 'mdy';
}

/** একটা মাসের Cross-check + বিশ্লেষণ — Cross-check-এর একই computeCrossCheck/window, তাই সংখ্যা সবখানে এক। */
function MonthInsight({ currentYyyymm, previousYyyymm, nav, ...s }: Shared & { currentYyyymm: string; previousYyyymm: string; nav: InsightNav }) {
  const cur = s.snapshots.find((x) => x.yyyymm === currentYyyymm);
  const prev = s.snapshots.find((x) => x.yyyymm === previousYyyymm);
  const start = prev ? addDays(prev.snapshotDate, 1) : '1970-01-01';
  const end = cur ? cur.snapshotDate : start;
  const tx = useRangeTransactions(s.uid, start, end < start ? start : end);

  const insight = useMemo(() => {
    if (!cur || !prev || tx.state.status !== 'ready') return null;
    const result: CrossCheckResult = computeCrossCheck({
      previous: prev,
      current: cur,
      liveTotalAssetsMinor: cur.totalAssetsMinor,
      today: toDhakaDate(new Date()),
      transactions: tx.state.data,
      debts: s.debts,
      investments: s.investments,
      gpfEntries: s.gpfEntries,
      periodBalances: s.balances,
      period: currentYyyymm,
    });
    return buildSnapshotInsight({
      previous: prev,
      current: cur,
      previousDerivedAccounts: s.derivedByMonth.get(previousYyyymm) ?? [],
      currentDerivedAccounts: s.derivedByMonth.get(currentYyyymm) ?? [],
      transactions: tx.state.data,
      cross: result,
      fmt: formatTaka,
      monthName: (m) => monthLabelBn(m).split(' ')[0],
    });
  }, [cur, prev, tx.state, s.debts, s.investments, s.gpfEntries, s.balances, s.derivedByMonth, currentYyyymm, previousYyyymm]);

  return (
    <SnapshotInsightCard
      insight={insight}
      currentYyyymm={currentYyyymm}
      previousYyyymm={previousYyyymm}
      dateFormat={s.dateFormat}
      nav={nav}
      status={tx.state.status === 'error' ? 'error' : insight ? 'ready' : 'loading'}
      onRetry={tx.retry}
    />
  );
}

export default function InsightPager({ startYyyymm, ...s }: Shared & { startYyyymm: string }) {
  const pairs = useMemo(() => listInsightPairs(s.snapshots), [s.snapshots]);
  const startIdx = Math.max(0, pairs.findIndex((p) => p.currentYyyymm === startYyyymm));
  // idx = pairs-তালিকার সূচক (০ = সবচেয়ে নতুন)। page-এর মাস বদলালে কল-সাইট key দিয়ে পুনরায় শুরু করায়।
  const [idx, setIdx] = useState(startIdx);
  const touch = useRef<{ x: number; y: number } | null>(null);

  if (pairs.length === 0) return null;
  const safe = Math.min(idx, pairs.length - 1);
  const pair = pairs[safe];
  const older = () => setIdx((i) => Math.min(pairs.length - 1, i + 1));
  const newer = () => setIdx((i) => Math.max(0, i - 1));
  const nav: InsightNav = {
    canOlder: safe < pairs.length - 1,
    canNewer: safe > 0,
    onOlder: older,
    onNewer: newer,
    position: safe + 1,
    total: pairs.length,
  };

  return (
    <div
      className="touch-pan-y"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const from = touch.current;
        touch.current = null;
        if (!from) return;
        const t = e.changedTouches[0];
        const dir = swipeDirection(t.clientX - from.x, t.clientY - from.y);
        if (dir === 'older' && nav.canOlder) older();
        else if (dir === 'newer' && nav.canNewer) newer();
      }}
    >
      <MonthInsight key={pair.currentYyyymm} currentYyyymm={pair.currentYyyymm} previousYyyymm={pair.previousYyyymm} nav={nav} {...s} />
    </div>
  );
}

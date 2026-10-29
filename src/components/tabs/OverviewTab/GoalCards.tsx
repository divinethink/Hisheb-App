import { useMemo } from 'react';
import { Flag, Gauge, Layers, TrendingUp } from 'lucide-react';
import { Block, Foot, Tip } from './OverviewBits';
import { formatDisplayDate, monthLabel } from '../../../lib/date';
import { formatNetTakaWhole, formatTakaWhole } from '../../../lib/format';
import {
  assetMix,
  emergencyFund,
  goalProjection,
  netWorthBridge,
  runwayMonths,
  type AssetKey,
  type NetWorthPace,
  type SnapshotWithFlow,
  type TxLite,
} from '../../../lib/overviewCalc';
import type { SnapshotBreakdown } from '../../../validation/netWorthSchema';

// Overview → All-Time ধাপ ১: সম্পদ কোথা থেকে বাড়ল / লক্ষ্য ও পূর্বাভাস / সম্পদের মিশ্রণ / Runway।
// শুধু বিদ্যমান snapshot + লেনদেন থেকে derive — নতুন query/write নেই। হিসাব lib/overviewCalc.ts-এ (pure, tested)।

/** সম্পদ লক্ষ্যের ডিফল্ট (Settings-এ না বসালে): ৳10,00,000 (minor)। */
export const DEFAULT_NET_WORTH_GOAL_MINOR = 100_000_000;
/** "মাসে আরও এত জমালে" তুলনার ধাপ: ৳5,000 (minor)। */
const BOOST_MINOR = 500_000;

/** ১. সম্পদ কোথা থেকে বাড়ল */
export function NetWorthBridgeCard({ snapshots, txs }: { snapshots: readonly SnapshotWithFlow[]; txs: readonly TxLite[] }) {
  const b = useMemo(() => netWorthBridge(snapshots, txs), [snapshots, txs]);
  if (!b) return null;
  const up = b.deltaMinor >= 0;
  const split = b.deltaMinor > 0 && b.ownMinor >= 0 && b.otherMinor >= 0;
  const ownPct = split ? Math.round((b.ownMinor / b.deltaMinor) * 100) : null;
  return (
    <Block icon={TrendingUp} tone="income" title="Net Worth Growth" sub={`${b.baseDate ? formatDisplayDate(b.baseDate) : b.baseYyyymm} → ${b.curDate ? formatDisplayDate(b.curDate) : b.curYyyymm} (snapshot) · ${b.monthsSpan} months`}>
      <p className={`text-2xl font-semibold ${up ? 'text-income' : 'text-expense'}`}>{formatNetTakaWhole(b.deltaMinor)}</p>
      <p className="mb-2 text-xs text-muted">From {formatTakaWhole(b.baseMinor)} to {formatTakaWhole(b.curMinor)}</p>
      {split && (
        <div className="mb-1.5 flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={`Own savings ${ownPct}%`}>
          <div className="bg-income" style={{ width: `${(b.ownMinor / b.deltaMinor) * 100}%` }} />
          <div className="bg-chart7" style={{ width: `${(b.otherMinor / b.deltaMinor) * 100}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between border-t border-muted/10 py-1.5 text-sm">
        <span className="text-fg"><span className="text-income">■</span> Own savings (income − expense)</span>
        <span className={`font-semibold ${b.ownMinor >= 0 ? 'text-income' : 'text-expense'}`}>{formatNetTakaWhole(b.ownMinor)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-muted/10 py-1.5 text-sm">
        <span className="text-fg"><span className="text-chart7">■</span> Others</span>
        <span className="font-semibold text-fg">{formatNetTakaWhole(b.otherMinor)}</span>
      </div>
      {ownPct !== null && ownPct > 0 && <Tip tone="income"><b>{ownPct}%</b> of the growth came from your own savings.</Tip>}
      {b.deltaMinor > 0 && b.ownMinor < 0 && <Tip>Spending exceeded income in this period — the growth came from other sources (investments, receivables, etc.).</Tip>}
      {b.uncoveredMonths > 0 && <Foot>Income/expense for {b.uncoveredMonths} of {b.monthsSpan} months isn’t in the app, so “Own savings” is partial.</Foot>}
      <Foot>Others = investment value changes, receivables collected, cross-check differences, etc.</Foot>
    </Block>
  );
}

/** ৩. লক্ষ্য ও পূর্বাভাস — দুই গতি: (ক) আয়-ব্যয়ের জমা অনুযায়ী, (খ) সম্পদ আসলে যতটা বাড়ছে তা অনুযায়ী */
export function GoalCard({ currentMinor, latestYyyymm, goalMinor, avgSavingsMinor, pace }: { currentMinor: number; latestYyyymm: string; goalMinor: number | null; avgSavingsMinor: number | null; pace: NetWorthPace | null }) {
  const goal = goalMinor ?? DEFAULT_NET_WORTH_GOAL_MINOR;
  const p = useMemo(() => goalProjection(currentMinor, goal, avgSavingsMinor, latestYyyymm, BOOST_MINOR), [currentMinor, goal, avgSavingsMinor, latestYyyymm]);
  const g = useMemo(() => (pace ? goalProjection(currentMinor, goal, pace.perMonthMinor, latestYyyymm, BOOST_MINOR) : null), [currentMinor, goal, pace, latestYyyymm]);
  const pct = Math.max(0, Math.min(100, (currentMinor / goal) * 100));
  const tile = 'flex-1 rounded-xl p-2.5';
  const when = (proj: { monthsAtPace: number | null; paceYyyymm: string | null; monthsBoosted: number | null; boostYyyymm: string | null; monthsSaved: number | null }, rate: number | null) =>
    proj.monthsAtPace !== null && proj.paceYyyymm !== null ? (
      <>
        <p className="text-base font-semibold text-fg">{monthLabel(proj.paceYyyymm)}</p>
        <p className="text-xs text-muted">{proj.monthsAtPace} months</p>
        {proj.monthsBoosted !== null && proj.boostYyyymm !== null && proj.monthsSaved !== null && proj.monthsSaved > 0 && (
          <p className="mt-1.5 border-t border-muted/10 pt-1.5 text-[11px] text-income">Save +{formatTakaWhole(BOOST_MINOR)}/month more → {monthLabel(proj.boostYyyymm)} ({proj.monthsSaved} months sooner)</p>
        )}
      </>
    ) : (
      <p className="text-xs text-muted">{rate !== null && rate > 0 ? 'More than 50 years' : 'Not reachable at this pace'}</p>
    );
  return (
    <Block icon={Flag} title="Goal & Forecast" sub={`Goal ${formatTakaWhole(goal)}${goalMinor === null ? ' (default)' : ''} · change in Menu → Monthly Target`}>
      <div className="mb-1.5 flex justify-between text-sm">
        <b className="text-fg">{formatTakaWhole(currentMinor)}</b>
        <span className="text-muted">{Math.floor(pct)}% complete</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={`Goal ${Math.floor(pct)}% complete`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {p.reached ? (
        <Tip tone="income">Goal reached. You can set a new one.</Tip>
      ) : avgSavingsMinor === null && !pace ? (
        <Foot>Not enough data (last 6 months of income/expense or two snapshots) to forecast.</Foot>
      ) : (
        <>
          {avgSavingsMinor !== null && (
            <p className="mb-1 mt-2 text-xs text-muted">Saved per month (income − expense, last 6 months): <b className={avgSavingsMinor >= 0 ? 'text-fg' : 'text-expense'}>{formatNetTakaWhole(Math.round(avgSavingsMinor))}</b></p>
          )}
          {pace && (
            <p className={`mb-1.5 text-xs text-muted ${avgSavingsMinor === null ? 'mt-2' : ''}`}>Net worth grew per month (last {pace.spanMonths} months): <b className={pace.perMonthMinor >= 0 ? 'text-fg' : 'text-expense'}>{formatNetTakaWhole(pace.perMonthMinor)}</b></p>
          )}
          <div className="flex gap-2">
            {avgSavingsMinor !== null && (
              <div className={`${tile} bg-surface`}>
                <p className="text-xs text-muted">Based on savings</p>
                {when(p, avgSavingsMinor)}
              </div>
            )}
            {g && pace && (
              <div className={`${tile} bg-surface`}>
                <p className="text-xs text-muted">Based on net worth growth</p>
                {when(g, pace.perMonthMinor)}
              </div>
            )}
          </div>
          <Foot>Estimate only — it changes if income or spending changes.{avgSavingsMinor !== null && pace ? ` The two paces differ by ${formatTakaWhole(Math.abs(Math.round(avgSavingsMinor) - pace.perMonthMinor))}/month; a big gap means part of your wealth moved for reasons outside income and spending.` : ''}</Foot>
        </>
      )}
    </Block>
  );
}

const MIX_META: Record<AssetKey, { label: string; bar: string; text: string }> = {
  accounts: { label: 'Cash / Accounts', bar: 'bg-chart2', text: 'text-chart2' },
  investment: { label: 'Investment', bar: 'bg-chart7', text: 'text-chart7' },
  receivable: { label: 'Receivable', bar: 'bg-chart4', text: 'text-chart4' },
  homeDeposit: { label: 'Home Deposit', bar: 'bg-chart1', text: 'text-chart1' },
  gpf: { label: 'GPF', bar: 'bg-chart3', text: 'text-chart3' },
};

/** ৫. সম্পদের মিশ্রণ ও ঝুঁকি */
export function AssetMixCard({ yyyymm, breakdown }: { yyyymm: string; breakdown: SnapshotBreakdown | undefined }) {
  const mix = useMemo(() => assetMix(breakdown), [breakdown]);
  if (!mix) return null;
  const pct = (n: number) => Math.round(n * 100);
  return (
    <Block icon={Layers} tone="warning" title="Asset Mix" sub={`${yyyymm} snapshot · total ${formatTakaWhole(mix.totalMinor)}`}>
      <div className="mb-2 flex h-4 overflow-hidden rounded-full bg-surface" role="img" aria-label="Asset share">
        {mix.items.map((i) => (
          <div key={i.key} className={MIX_META[i.key].bar} style={{ width: `${i.share * 100}%` }} />
        ))}
      </div>
      {mix.items.map((i) => (
        <div key={i.key} className="flex items-center justify-between border-t border-muted/10 py-1.5 text-sm">
          <span className="text-fg"><span className={MIX_META[i.key].text}>■</span> {MIX_META[i.key].label}</span>
          <span><b className="text-fg">{formatTakaWhole(i.minor)}</b> <span className="text-xs text-muted">· {(i.share * 100).toFixed(1)}%</span></span>
        </div>
      ))}
      {mix.outsideShare >= 0.5 && (
        <Tip><b>Heads-up:</b> investments + receivables = {pct(mix.outsideShare)}% of your assets — money in other hands. Cash is only {pct(mix.cashShare)}%.</Tip>
      )}
    </Block>
  );
}

/** Runway — কত মাস চলবে */
export function RunwayCard({ yyyymm, cashMinor, totalMinor, avgExpenseMinor }: { yyyymm: string; cashMinor: number | null; totalMinor: number; avgExpenseMinor: number | null }) {
  if (avgExpenseMinor === null || avgExpenseMinor <= 0) return null;
  const total = runwayMonths(totalMinor, avgExpenseMinor);
  const cash = cashMinor !== null ? runwayMonths(Math.max(cashMinor, 0), avgExpenseMinor) : null;
  const fund = cashMinor !== null ? emergencyFund(cashMinor, avgExpenseMinor) : null;
  const w = (m: number | null) => `${Math.max(0, Math.min(100, ((m ?? 0) / 6) * 100))}%`;
  return (
    <Block icon={Gauge} tone="expense" title="Runway" sub={`Based on avg monthly expense ${formatTakaWhole(Math.round(avgExpenseMinor))} (last 6 months) · ${yyyymm} snapshot`}>
      {cash !== null ? (
        <p className="mb-2 text-sm text-fg">
          <b>{cash.toFixed(1)} months on cash alone</b>{total !== null ? <span className="text-muted"> · {total.toFixed(1)} months in total once investments/receivables return</span> : null}.
        </p>
      ) : null}
      {cash !== null && (
        <>
          <div className="flex justify-between text-sm"><span className="text-fg">Cash only</span><b className="text-expense">{cash.toFixed(1)} months</b></div>
          <div className="mb-2 mt-1 h-3 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-expense" style={{ width: w(cash) }} /></div>
        </>
      )}
      {total !== null && (
        <>
          <div className="flex justify-between text-sm"><span className="text-fg">Total assets</span><b className="text-income">{total.toFixed(1)} months</b></div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: w(total) }} /></div>
        </>
      )}
      <Foot>Bar = 6-month emergency-fund goal{fund ? ` · ${Math.floor(fund.pct)}% met with cash` : ''}.</Foot>
      {fund && fund.shortfallMinor > 0 && <Tip>You need <b>{formatTakaWhole(fund.shortfallMinor)}</b> more in cash for a 6-month emergency fund.</Tip>}
    </Block>
  );
}

import { useMemo } from 'react';
import { Flag, Gauge, Layers, TrendingUp } from 'lucide-react';
import { Block, Foot, Tip } from './OverviewBits';
import { formatDisplayDate, monthLabelBn } from '../../../lib/date';
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
    <Block icon={TrendingUp} tone="income" title="Net Worth Growth" sub={`${b.baseDate ? formatDisplayDate(b.baseDate) : b.baseYyyymm} → ${b.curDate ? formatDisplayDate(b.curDate) : b.curYyyymm} (snapshot) · ${b.monthsSpan} মাস`}>
      <p className={`text-2xl font-semibold ${up ? 'text-income' : 'text-expense'}`}>{formatNetTakaWhole(b.deltaMinor)}</p>
      <p className="mb-3 text-xs text-muted">{formatTakaWhole(b.baseMinor)} থেকে {formatTakaWhole(b.curMinor)}</p>
      {split && (
        <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={`নিজের জমা ${ownPct}%`}>
          <div className="bg-income" style={{ width: `${(b.ownMinor / b.deltaMinor) * 100}%` }} />
          <div className="bg-chart7" style={{ width: `${(b.otherMinor / b.deltaMinor) * 100}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between border-t border-muted/10 py-2 text-sm">
        <span className="text-fg"><span className="text-income">■</span> Own savings (income − expense)</span>
        <span className={`font-semibold ${b.ownMinor >= 0 ? 'text-income' : 'text-expense'}`}>{formatNetTakaWhole(b.ownMinor)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-muted/10 py-2 text-sm">
        <span className="text-fg"><span className="text-chart7">■</span> Others</span>
        <span className="font-semibold text-fg">{formatNetTakaWhole(b.otherMinor)}</span>
      </div>
      {ownPct !== null && ownPct > 0 && <Tip tone="income">বৃদ্ধির <b>{ownPct}%</b> এসেছে আপনার নিজের জমা থেকে।</Tip>}
      {b.deltaMinor > 0 && b.ownMinor < 0 && <Tip>এই সময়ে খরচ আয়ের চেয়ে বেশি ছিল — বৃদ্ধি এসেছে অন্য খাত (বিনিয়োগ/পাওনা ইত্যাদি) থেকে।</Tip>}
      {b.uncoveredMonths > 0 && <Foot>{b.monthsSpan} মাসের মধ্যে {b.uncoveredMonths} মাসের আয়-ব্যয় অ্যাপে নেই — "নিজের জমা" আংশিক (Partial data)।</Foot>}
      <Foot>Others = বিনিয়োগ-মান বদল, পাওনা আদায়, Cross-check অমিল ইত্যাদি।</Foot>
    </Block>
  );
}

/** ৩. লক্ষ্য ও পূর্বাভাস — দুই গতি: (ক) আয়-ব্যয়ের জমা অনুযায়ী, (খ) সম্পদ আসলে যতটা বাড়ছে তা অনুযায়ী */
export function GoalCard({ currentMinor, latestYyyymm, goalMinor, avgSavingsMinor, pace }: { currentMinor: number; latestYyyymm: string; goalMinor: number | null; avgSavingsMinor: number | null; pace: NetWorthPace | null }) {
  const goal = goalMinor ?? DEFAULT_NET_WORTH_GOAL_MINOR;
  const p = useMemo(() => goalProjection(currentMinor, goal, avgSavingsMinor, latestYyyymm, BOOST_MINOR), [currentMinor, goal, avgSavingsMinor, latestYyyymm]);
  const g = useMemo(() => (pace ? goalProjection(currentMinor, goal, pace.perMonthMinor, latestYyyymm, BOOST_MINOR) : null), [currentMinor, goal, pace, latestYyyymm]);
  const pct = Math.max(0, Math.min(100, (currentMinor / goal) * 100));
  const tile = 'flex-1 rounded-xl p-3';
  const when = (proj: { monthsAtPace: number | null; paceYyyymm: string | null; monthsBoosted: number | null; boostYyyymm: string | null; monthsSaved: number | null }, rate: number | null) =>
    proj.monthsAtPace !== null && proj.paceYyyymm !== null ? (
      <>
        <p className="text-base font-semibold text-fg">{monthLabelBn(proj.paceYyyymm)}</p>
        <p className="text-xs text-muted">{proj.monthsAtPace} মাস</p>
        {proj.monthsBoosted !== null && proj.boostYyyymm !== null && proj.monthsSaved !== null && proj.monthsSaved > 0 && (
          <p className="mt-1.5 border-t border-muted/10 pt-1.5 text-[11px] text-income">মাসে +{formatTakaWhole(BOOST_MINOR)} হলে {monthLabelBn(proj.boostYyyymm)} ({proj.monthsSaved} মাস আগে)</p>
        )}
      </>
    ) : (
      <p className="text-xs text-muted">{rate !== null && rate > 0 ? '৫০ বছরের বেশি' : 'পৌঁছানো যাচ্ছে না'}</p>
    );
  return (
    <Block icon={Flag} title="Goal & Forecast" sub={`লক্ষ্য ${formatTakaWhole(goal)}${goalMinor === null ? ' (ডিফল্ট)' : ''} · Menu → Monthly Target-এ বদলান`}>
      <div className="mb-1.5 flex justify-between text-sm">
        <b className="text-fg">{formatTakaWhole(currentMinor)}</b>
        <span className="text-muted">{Math.floor(pct)}% পূরণ</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={`লক্ষ্যের ${Math.floor(pct)}% পূরণ`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {p.reached ? (
        <Tip tone="income">লক্ষ্য পূর্ণ হয়েছে। নতুন লক্ষ্য বসাতে পারেন।</Tip>
      ) : avgSavingsMinor === null && !pace ? (
        <Foot>শেষ ৬ মাসের আয়-ব্যয় ও দুটি snapshot অ্যাপে নেই, তাই পূর্বাভাস দেখানো যাচ্ছে না।</Foot>
      ) : (
        <>
          {avgSavingsMinor !== null && (
            <p className="mb-1 mt-3 text-xs text-muted">হিসাব অনুযায়ী জমা (আয় − ব্যয়, শেষ ৬ মাস): <b className={avgSavingsMinor >= 0 ? 'text-fg' : 'text-expense'}>{formatNetTakaWhole(Math.round(avgSavingsMinor))}</b>/মাস</p>
          )}
          {pace && (
            <p className={`mb-2 text-xs text-muted ${avgSavingsMinor === null ? 'mt-3' : ''}`}>সম্পদ আসলে বেড়েছে (শেষ {pace.spanMonths} মাস): <b className={pace.perMonthMinor >= 0 ? 'text-fg' : 'text-expense'}>{formatNetTakaWhole(pace.perMonthMinor)}</b>/মাস</p>
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
          <Foot>শুধু অনুমান — আয়-ব্যয় বদলালে ফল বদলাবে, নিশ্চয়তা নয়।{avgSavingsMinor !== null && pace ? ` দুই গতির ফারাক মাসে ${formatTakaWhole(Math.abs(Math.round(avgSavingsMinor) - pace.perMonthMinor))} — ফারাক বড় হলে বুঝবেন সম্পদের একটা অংশ আয়-ব্যয়ের বাইরের কারণে (বিনিয়োগ-মান, পাওনা ইত্যাদি) বদলেছে।` : ''}</Foot>
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
    <Block icon={Layers} tone="warning" title="Asset Mix" sub={`${yyyymm} snapshot · মোট ${formatTakaWhole(mix.totalMinor)}`}>
      <div className="mb-2 flex h-4 overflow-hidden rounded-full bg-surface" role="img" aria-label="সম্পদের ভাগ">
        {mix.items.map((i) => (
          <div key={i.key} className={MIX_META[i.key].bar} style={{ width: `${i.share * 100}%` }} />
        ))}
      </div>
      {mix.items.map((i) => (
        <div key={i.key} className="flex items-center justify-between border-t border-muted/10 py-2 text-sm">
          <span className="text-fg"><span className={MIX_META[i.key].text}>■</span> {MIX_META[i.key].label}</span>
          <span><b className="text-fg">{formatTakaWhole(i.minor)}</b> <span className="text-xs text-muted">· {(i.share * 100).toFixed(1)}%</span></span>
        </div>
      ))}
      {mix.outsideShare >= 0.5 && (
        <Tip><b>সতর্কতা:</b> বিনিয়োগ + পাওনা = {pct(mix.outsideShare)}% — টাকা অন্যের হাতে। নগদ মাত্র {pct(mix.cashShare)}%।</Tip>
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
    <Block icon={Gauge} tone="expense" title="Runway" sub={`গড় মাসিক খরচ ${formatTakaWhole(Math.round(avgExpenseMinor))} ধরে (শেষ ৬ মাস) · ${yyyymm} snapshot`}>
      {cash !== null ? (
        <p className="mb-3 text-sm text-fg">
          <b>নগদে {cash.toFixed(1)} মাস</b> চলবে{total !== null ? <span className="text-muted"> · বিনিয়োগ/পাওনা ফেরত এলে মোট {total.toFixed(1)} মাস</span> : null}।
        </p>
      ) : null}
      {cash !== null && (
        <>
          <div className="flex justify-between text-sm"><span className="text-fg">Cash only</span><b className="text-expense">{cash.toFixed(1)} মাস</b></div>
          <div className="mb-3 mt-1 h-3 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-expense" style={{ width: w(cash) }} /></div>
        </>
      )}
      {total !== null && (
        <>
          <div className="flex justify-between text-sm"><span className="text-fg">Total assets</span><b className="text-income">{total.toFixed(1)} মাস</b></div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: w(total) }} /></div>
        </>
      )}
      <Foot>বার = ৬ মাসের জরুরি-তহবিল লক্ষ্য{fund ? ` · নগদে ${Math.floor(fund.pct)}% পূরণ` : ''}।</Foot>
      {fund && fund.shortfallMinor > 0 && <Tip>জরুরি-তহবিল ৬ মাসের হতে আরও <b>{formatTakaWhole(fund.shortfallMinor)}</b> নগদ দরকার।</Tip>}
    </Block>
  );
}

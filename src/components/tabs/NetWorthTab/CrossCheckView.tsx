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
import { formatNetTaka, formatTaka } from '../../../lib/format';
import type { Debt } from '../../../validation/debtSchema';
import type { Investment } from '../../../validation/investmentSchema';
import type { AccountBalance, NetWorthSnapshot } from '../../../validation/netWorthSchema';
import type { GpfEntry } from '../../../validation/gpfSchema';

// Cross-check Summary → Details (UI Mockup §৬/§৬.২, progressive disclosure)। ফর্মুলা/লজিক lib/crossCheck.ts-এ।
// শুধু current-vs-previous-snapshot prospective (C7)। `period` = যে মাস দেখা হচ্ছে (Net Worth ‹ মাস ›); চলতি মাসে snapshot না
// থাকলে ও নতুন আপডেট না হলে সর্বশেষ snapshot-এর Cross-check দেখায় (pickCrossCheckPair, owner-request 2026-11-01)।

/** crossCheck.ts-এর ইংরেজি detail-টেক্সট (নাম + সংক্ষিপ্ত স্থিতি) শুধু দেখানোর সময় বাংলায় — lib/টেস্ট অপরিবর্তিত */
const DETAIL_BN: [string, string][] = [
  [' (closed)', ' (শেষ)'],
  [' (written off)', ' (অনাদায়ী)'],
  [' (extra repayment)', ' (অতিরিক্ত ফেরত)'],
];
const GPF_KIND_BN: Record<string, string> = { contribution: 'জমা', interest: 'সুদ', withdrawal: 'উত্তোলন' };
const bnDetail = (d: string) => {
  if (GPF_KIND_BN[d]) return GPF_KIND_BN[d];
  for (const [en, bn] of DETAIL_BN) if (d.endsWith(en)) return d.slice(0, -en.length) + bn;
  return d;
};

const FACTOR_LABEL: Record<FactorKey, string> = {
  investmentClosure: 'শেষ হওয়া বা অনাদায়ী বিনিয়োগ',
  debtForgiven: 'মওকুফ করা পাওনা',
  debtExcessRepayment: 'পাওনার চেয়ে বেশি ফেরত',
  iOweChange: 'আমার ধার (নেওয়া ও শোধ)',
  gpfChange: 'GPF-এর পরিবর্তন',
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
        <FullScreenPage title="ক্রসচেকের বিস্তারিত" onBack={props.onBack!}>
          <p className="text-sm text-muted">{snaps.state.status === 'error' ? 'স্ন্যাপশট লোড করা যায়নি।' : 'লোড হচ্ছে…'}</p>
        </FullScreenPage>
      );
    }
    return snaps.state.status === 'error' ? (
      <p role="alert" className="px-4 pt-4 text-sm text-muted">
        ক্রসচেক এখন দেখানো যাচ্ছে না — স্ন্যাপশট লোড করা যায়নি।
      </p>
    ) : null;
  }

  if (!pair.previous) {
    return props.mode === 'summary' && period === currentMonth() ? (
      <p className="px-4 pt-4 text-sm text-muted">
        ℹ️ প্রথম মাসিক স্ন্যাপশটের পর থেকে ক্রসচেক শুরু হবে (“Update This Month’s Balance” ব্যবহার করুন)।
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
    const note = `${formatDisplayDate(basisDate, dateFormat)} তারিখের পর ব্যালেন্স হালনাগাদ হয়নি — পরের হালনাগাদের পর ক্রসচেক চলবে।`;
    return mode === 'details' ? (
      <FullScreenPage title="ক্রসচেকের বিস্তারিত" onBack={onBack!}>
        <p className="text-sm text-muted">{note}</p>
      </FullScreenPage>
    ) : (
      <p className="px-4 pt-4 text-sm text-muted">ℹ️ {note}</p>
    );
  }

  if (tx.state.status === 'error') {
    const retry = (
      <div role="alert" className="rounded-lg border border-muted/10 bg-canvas p-3 text-sm text-fg">
        ক্রসচেকের তথ্য লোড করা যায়নি।{' '}
        <button type="button" onClick={tx.retry} className="min-h-11 font-medium text-primary">
          আবার চেষ্টা করুন
        </button>
      </div>
    );
    return mode === 'details' ? (
      <FullScreenPage title="ক্রসচেকের বিস্তারিত" onBack={onBack!}>
        {retry}
      </FullScreenPage>
    ) : (
      <div className="px-4 pt-4">{retry}</div>
    );
  }

  if (!result) {
    return mode === 'details' ? (
      <FullScreenPage title="ক্রসচেকের বিস্তারিত" onBack={onBack!}>
        <p className="text-sm text-muted">লোড হচ্ছে…</p>
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
              <span className="text-xs font-semibold text-muted">ক্রসচেক</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  matched ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning'
                }`}
              >
                {matched ? 'মিলেছে' : 'Deviation'}
              </span>
            </span>
            <span className="mt-0.5 block text-lg font-semibold leading-tight text-fg">
              {matched ? 'সব হিসাব মিলেছে' : formatNetTaka(result.deviationMinor)}
            </span>
            {!matched && (
              <span className={`block text-xs ${result.unexplainedMinor === 0 ? 'text-muted' : 'text-expense'}`}>
                {result.unexplainedMinor === 0 ? 'কারণগুলো দিয়েই পুরোটা মেটানো গেছে' : `ব্যাখ্যাহীন: ${formatNetTaka(result.unexplainedMinor)}`}
              </span>
            )}
            <span className="mt-0.5 block text-xs text-muted">
              {result.currentIsLive ? 'লাইভ' : formatDisplayDate(result.windowEnd, dateFormat)} বনাম {formatDisplayDate(result.previous.snapshotDate, dateFormat)}-এর স্ন্যাপশট
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
  const windowText = r.windowStart > r.windowEnd ? 'আগের স্ন্যাপশটের পর এখনো এক দিনও পার হয়নি' : `${d(r.windowStart)} – ${d(r.windowEnd)}${r.currentIsLive ? ' (লাইভ)' : ''}`;
  const notes: string[] = [];
  if (r.previousUnverified) notes.push('আগের স্ন্যাপশটটি “অযাচাইকৃত” চিহ্নিত, তাই এই তুলনায় কিছুটা গরমিল থাকতে পারে।');
  if (r.lateSnapshotDates.length > 0) notes.push(`ব্যালেন্স হালনাগাদ হয়েছে ${r.lateSnapshotDates.map(d).join(', ')} তারিখে (মাসের শেষ থেকে দূরে), তাই সামান্য Deviation স্বাভাবিক।`);
  notes.push('নিচের কারণগুলো Deviation-এর সম্ভাব্য ব্যাখ্যা। ব্যালেন্স সময়মতো হালনাগাদ না হলেও ফারাক দেখা দিতে পারে। শুধু “ব্যাখ্যাহীন” অংশটুকুতে নজর দিন।');

  return (
    <FullScreenPage title="ক্রসচেকের বিস্তারিত" onBack={onBack}>
      <div className="flex flex-col gap-3 pb-8">
        {/* ফলাফল — সংক্ষিপ্ত, এক নজরের কার্ড */}
        <Card className={`flex items-center gap-3 border px-4 py-3 ${matched ? 'border-income/25' : 'border-warning/30'}`}>
          <IconBadge icon={matched ? CircleCheck : TriangleAlert} tone={matched ? 'income' : 'warning'} size={40} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <span className={`rounded-full px-2 py-0.5 font-medium ${matched ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning'}`}>
                {matched ? 'মিলেছে' : 'Deviation'}
              </span>
              বর্তমান − প্রত্যাশিত
            </p>
            <p className="text-2xl font-semibold leading-tight tabular-nums text-fg">{matched ? 'সব হিসাব মিলেছে' : formatNetTaka(r.deviationMinor)}</p>
            <p className="text-xs text-muted">সময়কাল: {windowText}</p>
          </div>
        </Card>

        {/* হিসাব যেভাবে হলো */}
        <section>
          <SectionTitle hint="ধাপে ধাপে">হিসাব যেভাবে হলো</SectionTitle>
          <Card className="divide-y divide-muted/10 overflow-hidden">
            <Line label="আগের স্ন্যাপশট" sub={d(r.previous.snapshotDate)} value={formatTaka(r.previousTotalMinor)} />
            <Line label="+ এ সময়ের সঞ্চয়" sub="আয় − ব্যয়" value={formatNetTaka(r.savingsMinor)} valueCls={signCls(r.savingsMinor)} />
            <Line label="= প্রত্যাশিত মোট" value={formatTaka(r.expectedMinor)} tint="bg-primary/5" />
            <Line label="বর্তমান মোট সম্পদ" sub={r.currentIsLive ? 'লাইভ' : `স্ন্যাপশট ${d(r.windowEnd)}`} value={formatTaka(r.currentMinor)} />
            <Line label="Deviation" sub="বর্তমান − প্রত্যাশিত" value={formatNetTaka(r.deviationMinor)} valueCls={matched ? 'text-income' : 'text-warning'} tint={matched ? 'bg-income/5' : 'bg-warning/5'} />
          </Card>
        </section>

        {/* Deviation-এর সম্ভাব্য কারণ */}
        {(!matched || r.factors.length > 0) && (
          <section>
            <SectionTitle hint={r.factors.length ? `${r.factors.length}টি কারণ` : undefined}>Deviation-এর সম্ভাব্য কারণ</SectionTitle>
            <Card className="divide-y divide-muted/10 overflow-hidden">
              {r.factors.map((f) => (
                <div key={f.key} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${f.effectMinor >= 0 ? 'bg-income' : 'bg-expense'}`} />
                      {FACTOR_LABEL[f.key]}
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${signCls(f.effectMinor)}`}>{formatNetTaka(f.effectMinor)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
                    {f.detail.map((n) => (
                      <span key={n} className="rounded-full bg-muted/10 px-2 py-0.5 text-xs text-muted">{bnDetail(n)}</span>
                    ))}
                  </div>
                </div>
              ))}
              <Line
                label="ব্যাখ্যাহীন"
                sub={r.unexplainedMinor === 0 ? 'কারণগুলো দিয়েই পুরো Deviation মেটানো গেছে' : 'এ অংশে আপনার নজর দরকার'}
                value={formatNetTaka(r.unexplainedMinor)}
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

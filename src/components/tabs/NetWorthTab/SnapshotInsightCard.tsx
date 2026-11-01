import { Banknote, Landmark, Layers, Lightbulb, TrendingDown, TrendingUp, TriangleAlert, CircleCheck, Info, BarChart3, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';
import { formatPlain, formatTaka } from '../../../lib/format';
import { formatDisplayDate, monthLabelBn, monthShortBn } from '../../../lib/date';
import type { NoteTone, SnapshotInsight } from '../../../lib/snapshotInsight';

// Net Worth → "মাসিক বিশ্লেষণ" কার্ড (owner-request 2026-11-01): স্ন্যাপশট বনাম আগের স্ন্যাপশট।
// ক্রম: সারসংক্ষেপ-ব্যানার → সম্পদের ভাগ-টেবিল → অ্যাকাউন্ট-টেবিল → আয়-ব্যয় → খেয়াল রাখার বিষয়।
// শুধু দেখানো; হিসাব lib/snapshotInsight.ts-এ (pure)। কিছু store হয় না।

const NOTE_STYLE: Record<NoteTone, { Icon: LucideIcon; box: string; icon: string }> = {
  warn: { Icon: TriangleAlert, box: 'bg-expense/10', icon: 'text-expense' },
  info: { Icon: Info, box: 'bg-muted/10', icon: 'text-muted' },
  good: { Icon: CircleCheck, box: 'bg-income/10', icon: 'text-income' },
};

const shortMonth = (yyyymm: string) => monthShortBn(Number(yyyymm.slice(5, 7)));
const COLS = 'grid grid-cols-[minmax(0,1fr)_3.9rem_3.9rem_4rem] items-center gap-x-1.5';

const tone = (n: number) => (n === 0 ? 'text-muted' : n > 0 ? 'text-income' : 'text-expense');
const signed = (n: number) => (n === 0 ? '0' : `${n > 0 ? '+' : '−'}${formatPlain(Math.abs(n))}`);

function SectionTitle({ icon: Icon, children, hint }: { icon: LucideIcon; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-2">
      <Icon aria-hidden size={16} className="shrink-0 text-primary" />
      <h3 className="text-sm font-semibold text-fg">{children}</h3>
      {hint && <span className="ml-auto text-xs text-muted">{hint}</span>}
    </div>
  );
}

/** কলামসহ টেবিল — হেডার-সারি হালকা রঙে, সারিগুলো রেখা দিয়ে আলাদা, সংখ্যা ডানে-সারিবদ্ধ ও সমান-প্রস্থ অঙ্কে */
function Table({ title, prev, cur, children }: { title: string; prev: string; cur: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-muted/15">
      <div className={`${COLS} bg-muted/10 px-2.5 py-2 text-xs font-medium text-muted`}>
        <span>{title}</span>
        <span className="text-right">{prev}</span>
        <span className="text-right">{cur}</span>
        <span className="text-right">পার্থক্য</span>
      </div>
      <div className="divide-y divide-muted/10">{children}</div>
    </div>
  );
}

function Row({ label, from, to, diff, strong }: { label: string; from: number; to: number; diff: number; strong?: boolean }) {
  return (
    <div className={`${COLS} px-2.5 py-2.5 text-[12.5px] ${strong ? 'bg-primary/5 font-semibold' : ''}`}>
      <span className="break-words text-[13px] leading-snug text-fg">{label}</span>
      <span className="text-right tabular-nums text-muted">{formatPlain(from)}</span>
      <span className="text-right tabular-nums text-fg">{formatPlain(to)}</span>
      <span className={`text-right font-semibold tabular-nums ${tone(diff)}`}>{signed(diff)}</span>
    </div>
  );
}

function Tile({ label, value, cls = 'text-fg' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl bg-muted/10 px-2 py-2.5 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

/** স্বাইপ/বোতামে মাস-বদলের নিয়ন্ত্রণ (InsightPager দেয়); না দিলে কার্ড একটাই মাস দেখায় */
export interface InsightNav {
  canOlder: boolean;
  canNewer: boolean;
  onOlder: () => void;
  onNewer: () => void;
  /** ১ = সবচেয়ে নতুন */
  position: number;
  total: number;
}

const navBtn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

export default function SnapshotInsightCard({
  insight: i,
  currentYyyymm,
  previousYyyymm,
  dateFormat,
  nav,
  status = 'ready',
  onRetry,
}: {
  insight: SnapshotInsight | null;
  currentYyyymm: string;
  previousYyyymm: string;
  dateFormat: 'dmy' | 'mdy';
  nav?: InsightNav;
  status?: 'loading' | 'error' | 'ready';
  onRetry?: () => void;
}) {
  const header = (
    <header className="flex items-center gap-1">
      {nav ? (
        <button type="button" aria-label="আগের মাসের বিশ্লেষণ" onClick={nav.onOlder} disabled={!nav.canOlder} className={navBtn}>
          <ChevronLeft aria-hidden size={22} />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
        <IconBadge icon={BarChart3} tone="primary" size={40} />
        <h2 className="text-xl font-semibold text-fg">মাসিক বিশ্লেষণ</h2>
        <p className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
          {monthLabelBn(currentYyyymm)} বনাম {monthLabelBn(previousYyyymm)}
        </p>
        {nav && nav.total > 1 && (
          <p className="text-[11px] text-muted" aria-live="polite">
            {nav.position} / {nav.total} · আঙুল ডানে-বাঁয়ে টানুন
          </p>
        )}
      </div>
      {nav ? (
        <button type="button" aria-label="পরের মাসের বিশ্লেষণ" onClick={nav.onNewer} disabled={!nav.canNewer} className={navBtn}>
          <ChevronRight aria-hidden size={22} />
        </button>
      ) : null}
    </header>
  );

  if (!i) {
    return (
      <Card className="mx-4 mb-3 p-4">
        {header}
        {status === 'error' ? (
          <div role="alert" className="mt-4 text-center text-sm text-fg">
            বিশ্লেষণ লোড করা যায়নি।{' '}
            <button type="button" onClick={onRetry} className="min-h-11 font-medium text-primary">আবার চেষ্টা করুন</button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2" aria-hidden>
            <div className="h-20 animate-pulse rounded-xl bg-muted/10" />
            <div className="h-32 animate-pulse rounded-xl bg-muted/10" />
          </div>
        )}
      </Card>
    );
  }

  const pm = shortMonth(i.previousYyyymm);
  const cm = shortMonth(i.currentYyyymm);
  const d = (s: string) => formatDisplayDate(s, dateFormat);
  const down = i.totalDeltaMinor < 0;
  const flat = i.totalDeltaMinor === 0;
  const BannerIcon = down ? TrendingDown : TrendingUp;
  const hasFlow = i.incomeMinor > 0 || i.expenseMinor > 0;

  return (
    <Card className="mx-4 mb-3 p-4">
      {header}

      {/* সারসংক্ষেপ-ব্যানার */}
      <div className={`mt-4 rounded-xl px-3 py-3 text-center ${flat ? 'bg-muted/10' : down ? 'bg-expense/10' : 'bg-income/10'}`}>
        <p className="text-xs text-muted">মোট সম্পদের পরিবর্তন</p>
        <p className={`mt-0.5 flex items-center justify-center gap-1.5 text-2xl font-semibold tabular-nums ${tone(i.totalDeltaMinor)}`}>
          {!flat && <BannerIcon aria-hidden size={22} />}
          {flat ? 'অপরিবর্তিত' : signed(i.totalDeltaMinor).replace(/^([+−])/, '$1৳')}
        </p>
        {i.totalDeltaPct !== null && !flat && (
          <p className="text-xs text-muted">আগের মাসের তুলনায় {i.totalDeltaPct} শতাংশ {down ? 'কম' : 'বেশি'}</p>
        )}
      </div>

      <SectionTitle icon={Layers} hint="টাকায়">সম্পদের ভাগ</SectionTitle>
      <Table title="খাত" prev={pm} cur={cm}>
        <Row strong label="মোট সম্পদ" from={i.previousTotalMinor} to={i.currentTotalMinor} diff={i.totalDeltaMinor} />
        {i.components.map((c) => (
          <Row key={c.key} label={c.label} from={c.fromMinor} to={c.toMinor} diff={c.deltaMinor} />
        ))}
      </Table>

      {i.accountMoves.length > 0 && (
        <>
          <SectionTitle icon={Landmark} hint="যেগুলো বদলেছে">অ্যাকাউন্ট</SectionTitle>
          <Table title="নাম" prev={pm} cur={cm}>
            {i.accountMoves.map((a) => (
              <Row key={a.name} label={a.name} from={a.fromMinor} to={a.toMinor} diff={a.deltaMinor} />
            ))}
          </Table>
          {i.unchangedAccounts.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              অপরিবর্তিত:
              {i.unchangedAccounts.map((n) => (
                <span key={n} className="rounded-full bg-muted/10 px-2 py-0.5 text-fg">{n}</span>
              ))}
            </p>
          )}
        </>
      )}

      {hasFlow && (
        <>
          <SectionTitle icon={Banknote} hint={`${d(i.windowStart)} – ${d(i.windowEnd)}`}>আয়-ব্যয়</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="আয়" value={formatTaka(i.incomeMinor)} cls="text-income" />
            <Tile label="ব্যয়" value={formatTaka(i.expenseMinor)} cls="text-expense" />
            <Tile
              label={i.savingsMinor < 0 ? 'ঘাটতি' : 'সঞ্চয়'}
              value={formatTaka(Math.abs(i.savingsMinor))}
              cls={i.savingsMinor < 0 ? 'text-expense' : 'text-income'}
            />
          </div>
        </>
      )}

      {i.notes.length > 0 && (
        <>
          <SectionTitle icon={Lightbulb} hint={`${i.notes.length}টি`}>যা খেয়াল রাখা দরকার</SectionTitle>
          <ul className="flex flex-col gap-2">
            {i.notes.map((n, idx) => {
              const { Icon, box, icon } = NOTE_STYLE[n.tone];
              return (
                <li key={idx} className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm leading-relaxed text-fg ${box}`}>
                  <Icon aria-hidden size={18} className={`mt-0.5 shrink-0 ${icon}`} />
                  <span>{n.text}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

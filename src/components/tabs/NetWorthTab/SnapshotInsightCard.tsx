import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import Card from '../../common/Card';
import { formatNet, formatPlain, formatTaka } from '../../../lib/format';
import { formatDisplayDate, monthLabelBn } from '../../../lib/date';
import type { NoteTone, SnapshotInsight } from '../../../lib/snapshotInsight';

// Net Worth → "মাসিক বিশ্লেষণ" কার্ড (owner-request 2026-11-01): স্ন্যাপশট বনাম আগের স্ন্যাপশট — তুলনা-টেবিল
// (আগের মাস | এ মাস | পার্থক্য), আয়-ব্যয় ও সচেতনতার নোট। শুধু দেখানো; হিসাব lib/snapshotInsight.ts-এ (pure)। কিছু store হয় না।

const NOTE_ICON: Record<NoteTone, { Icon: typeof Info; cls: string }> = {
  warn: { Icon: CircleAlert, cls: 'text-expense' },
  info: { Icon: Info, cls: 'text-muted' },
  good: { Icon: CircleCheck, cls: 'text-income' },
};

const monthOnly = (yyyymm: string) => monthLabelBn(yyyymm).split(' ')[0];
const COLS = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)] items-center gap-x-2';

/** পার্থক্য-ঘর: + সবুজ, − লাল, ০ ধূসর — কোনো BDT/৳ ছাড়া (জায়গা কম) */
function Diff({ minor, strong }: { minor: number; strong?: boolean }) {
  const cls = minor === 0 ? 'text-muted' : minor > 0 ? 'text-income' : 'text-expense';
  const text = minor === 0 ? '0' : `${minor > 0 ? '+' : '−'}${formatPlain(Math.abs(minor))}`;
  return <span className={`text-right tabular-nums ${strong ? 'font-semibold' : 'font-medium'} ${cls}`}>{text}</span>;
}

function Row({ label, from, to, diff, strong }: { label: string; from: number; to: number; diff: number; strong?: boolean }) {
  return (
    <div className={`${COLS} border-t border-muted/10 py-2 text-[13px] leading-snug first:border-t-0 ${strong ? 'font-semibold' : ''}`}>
      <span className="break-words text-fg">{label}</span>
      <span className="text-right tabular-nums text-muted">{formatPlain(from)}</span>
      <span className="text-right tabular-nums text-fg">{formatPlain(to)}</span>
      <Diff minor={diff} strong={strong} />
    </div>
  );
}

function Head({ title, prev, cur }: { title: string; prev: string; cur: string }) {
  return (
    <div className={`${COLS} pb-1 pt-3 text-xs text-muted`}>
      <span className="font-medium">{title}</span>
      <span className="text-right">{prev}</span>
      <span className="text-right">{cur}</span>
      <span className="text-right">পার্থক্য</span>
    </div>
  );
}

export default function SnapshotInsightCard({ insight: i, dateFormat }: { insight: SnapshotInsight; dateFormat: 'dmy' | 'mdy' }) {
  const prevName = monthOnly(i.previousYyyymm);
  const curName = monthOnly(i.currentYyyymm);
  const d = (s: string) => formatDisplayDate(s, dateFormat);
  return (
    <Card className="mx-4 mb-3 p-4">
      <header className="pb-1 text-center">
        <h2 className="text-lg font-semibold text-fg">মাসিক বিশ্লেষণ</h2>
        <p className="mt-0.5 text-sm text-muted">
          {monthLabelBn(i.currentYyyymm)} বনাম {monthLabelBn(i.previousYyyymm)}
        </p>
      </header>

      <Head title="সম্পদ (টাকা)" prev={prevName} cur={curName} />
      <Row strong label="মোট সম্পদ" from={i.previousTotalMinor} to={i.currentTotalMinor} diff={i.totalDeltaMinor} />
      {i.totalDeltaPct !== null && i.totalDeltaMinor !== 0 && (
        <p className="-mt-1 pb-1 text-right text-xs text-muted">আগের মাসের তুলনায় {i.totalDeltaPct} শতাংশ {i.totalDeltaMinor > 0 ? 'বেশি' : 'কম'}</p>
      )}
      {i.components.map((c) => (
        <Row key={c.key} label={c.label} from={c.fromMinor} to={c.toMinor} diff={c.deltaMinor} />
      ))}

      {i.accountMoves.length > 0 && (
        <>
          <Head title="অ্যাকাউন্ট" prev={prevName} cur={curName} />
          {i.accountMoves.map((a) => (
            <Row key={a.name} label={a.name} from={a.fromMinor} to={a.toMinor} diff={a.deltaMinor} />
          ))}
          {i.unchangedAccounts.length > 0 && <p className="border-t border-muted/10 pt-2 text-xs text-muted">অপরিবর্তিত: {i.unchangedAccounts.join(', ')}</p>}
        </>
      )}

      {(i.incomeMinor > 0 || i.expenseMinor > 0) && (
        <section className="mt-3 border-t border-muted/10 pt-3 text-sm">
          <p className="pb-1 text-xs text-muted">
            আয়-ব্যয় ({d(i.windowStart)} – {d(i.windowEnd)})
          </p>
          <p className="flex justify-between py-0.5"><span className="text-muted">আয়</span><span className="tabular-nums text-fg">{formatTaka(i.incomeMinor)}</span></p>
          <p className="flex justify-between py-0.5"><span className="text-muted">ব্যয়</span><span className="tabular-nums text-fg">{formatTaka(i.expenseMinor)}</span></p>
          <p className="flex justify-between py-0.5 font-medium">
            <span className="text-fg">{i.savingsMinor < 0 ? 'ঘাটতি (আয় − ব্যয়)' : 'সঞ্চয় (আয় − ব্যয়)'}</span>
            <span className={`tabular-nums ${i.savingsMinor < 0 ? 'text-expense' : 'text-income'}`}>{formatNet(i.savingsMinor).replace('BDT ', '৳')}</span>
          </p>
        </section>
      )}

      {i.notes.length > 0 && (
        <section className="mt-3 border-t border-muted/10 pt-3">
          <p className="pb-2 text-xs text-muted">যা খেয়াল রাখা দরকার</p>
          <ul className="flex flex-col gap-2.5">
            {i.notes.map((n, idx) => {
              const { Icon, cls } = NOTE_ICON[n.tone];
              return (
                <li key={idx} className="flex items-start gap-2 text-[15px] leading-relaxed text-fg">
                  <Icon aria-hidden size={18} className={`mt-1 shrink-0 ${cls}`} />
                  <span>{n.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Card>
  );
}

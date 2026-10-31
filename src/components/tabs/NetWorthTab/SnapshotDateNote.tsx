import { CalendarCheck, TriangleAlert } from 'lucide-react';
import IconBadge from '../../common/IconBadge';
import { useSettings } from '../../../hooks/useData';
import { formatDisplayDate } from '../../../lib/date';
import type { SnapshotDateVerdict } from '../../../lib/snapshotDateCheck';

// Snapshot date-এর নিচে inline যাচাই-বার্তা (owner-approved ২০২৬-১০-৩১; পপআপ নয়)।
// differs = সতর্কতা (Save চলে), invalid = ভুল (Save বন্ধ)। ঠিক তারিখে কিছু দেখায় না।
export default function SnapshotDateNote({
  uid,
  snapshotDate,
  verdict,
}: {
  uid: string;
  snapshotDate: string;
  verdict: SnapshotDateVerdict;
}) {
  const settings = useSettings(uid);
  const fmt = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  if (verdict.kind === 'ok') return null;
  const d = (s: string) => formatDisplayDate(s, fmt);

  const invalid = verdict.kind === 'invalid';
  const days = verdict.kind === 'differs' ? Math.abs(verdict.daysOff) : 0;

  return (
    <div
      role={invalid ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-2xl border p-3 ${invalid ? 'border-expense/30 bg-expense/5' : 'border-warning/30 bg-warning/5'}`}
    >
      <IconBadge icon={invalid ? TriangleAlert : CalendarCheck} tone={invalid ? 'expense' : 'warning'} size={32} />
      <div className="min-w-0 text-sm">
        {verdict.kind === 'invalid' ? (
          <>
            <p className="font-semibold text-fg">Snapshot date is too early</p>
            <p className="mt-0.5 text-muted">
              Your previous snapshot is dated {d(verdict.previousDate)}. Pick a date after it so Cross-check can count this month’s savings.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-fg">Snapshot dated {d(snapshotDate)}</p>
            <p className="mt-0.5 text-muted">
              That’s {days} day{days === 1 ? '' : 's'} {verdict.daysOff < 0 ? 'before' : 'after'} the expected {d(verdict.expected)}. Entries
              after this date won’t be included in the snapshot.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

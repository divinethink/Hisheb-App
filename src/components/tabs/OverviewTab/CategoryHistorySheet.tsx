import { useMemo } from 'react';
import BottomSheet from '../../common/BottomSheet';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import type { CategoryShare, TxLite } from '../../../lib/overviewCalc';

// Read-only: Overview-তে ইতিমধ্যে লোড-হওয়া `txs` থেকেই filter — নতুন query/write/schema নেই।
// "Others" সারিতে top-N-এর বাইরের সব ক্যাটেগরি দেখায় (categoryBreakdown-এর সাথে মিল রেখে)।
export default function CategoryHistorySheet({
  name,
  txs,
  cats,
  onClose,
}: {
  name: string;
  txs: readonly TxLite[];
  cats: readonly CategoryShare[];
  onClose: () => void;
}) {
  const { groups, total } = useMemo(() => {
    const topNames = new Set(cats.filter((c) => c.name !== 'Others').map((c) => c.name));
    const rows = txs
      .filter((t) => t.type === 'expense' && (name === 'Others' ? !topNames.has(t.categoryName) : t.categoryName === name))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const byDate = new Map<string, { sum: number; items: TxLite[] }>();
    let sum = 0;
    for (const t of rows) {
      const g = byDate.get(t.date) ?? { sum: 0, items: [] };
      g.sum += t.amountMinor;
      g.items.push(t);
      byDate.set(t.date, g);
      sum += t.amountMinor;
    }
    return { groups: [...byDate.entries()], total: sum };
  }, [name, txs, cats]);

  return (
    <BottomSheet
      title={name}
      onRequestClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="min-h-11 w-full rounded-lg border border-muted/40 text-base">
          Close
        </button>
      }
    >
      <p className="mb-3 text-sm text-muted">Total: {formatAmount(total)}</p>
      {groups.length === 0 && <p className="text-sm text-muted">No transactions.</p>}
      <ul className="flex flex-col gap-3">
        {groups.map(([date, g]) => (
          <li key={date}>
            <div className="flex justify-between text-xs text-muted">
              <span>{formatDisplayDate(date)}</span>
              <span>{formatAmount(g.sum)}</span>
            </div>
            {g.items.map((t, i) => (
              <div key={i} className="mt-1 flex items-start justify-between rounded-lg bg-surface px-3 py-2 text-sm text-fg">
                <span className="min-w-0">
                  <span className="block truncate">{t.categoryName}</span>
                  {t.note && <span className="block truncate text-xs text-muted">{t.note}</span>}
                  {t.labelNames && t.labelNames.length > 0 && (
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {t.labelNames.map((l) => (
                        <span key={l} className="rounded-full border border-muted/40 px-1.5 text-[10px] text-muted">
                          {l}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="ml-2 shrink-0 text-expense">−{formatAmount(t.amountMinor)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

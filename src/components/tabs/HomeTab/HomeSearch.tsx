import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Card from '../../common/Card';
import SkeletonLoader from '../../common/SkeletonLoader';
import CategoryIcon from '../../common/CategoryIcon';
import { useAllTransactions } from '../../../hooks/useData';
import { getCategoryIcon } from '../../../lib/categoryIcons';
import { formatAmount, formatSigned } from '../../../lib/format';
import { searchTransactions } from '../../../lib/txSearch';
import { dateLabel, toDhakaDate } from '../../../lib/date';
import type { Transaction } from '../../../validation/transactionSchema';
import type { Category } from '../../../validation/catalogSchemas';

const RENDER_CAP = 100; // শুধু দেখানোর সীমা (DOM হালকা রাখতে); খোঁজা সব লেনদেনেই হয়, কোনো হিসাব এতে নেই

/**
 * Home সার্চ (সব মাস): ক্যাটাগরি, নোট, লেবেল ও অঙ্ক। শুধু mount থাকলে (সার্চ খোলা) সব লেনদেন subscribe হয়।
 * রো ট্যাপ → HomeTab-এর বিদ্যমান Edit sheet।
 */
export default function HomeSearch({
  uid,
  catById,
  onPick,
}: {
  uid: string;
  catById: Map<string, Category>;
  onPick: (t: Transaction) => void;
}) {
  const all = useAllTransactions(uid);
  const [query, setQuery] = useState('');
  const today = useMemo(() => toDhakaDate(new Date()), []);
  const data = all.state.status === 'ready' ? all.state.data : null;
  const hits = useMemo(() => (data ? searchTransactions(data, query) : []), [data, query]);
  const shown = hits.slice(0, RENDER_CAP);
  const total = useMemo(() => hits.reduce((n, t) => n + (t.type === 'expense' ? -t.amountMinor : t.amountMinor), 0), [hits]);

  return (
    <div className="px-4 pt-2">
      <div className="relative">
        <Search aria-hidden size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search category, note, label or amount"
          aria-label="Search transactions"
          className="min-h-11 w-full rounded-xl border border-muted/20 bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-primary"
        />
      </div>

      {all.state.status === 'loading' && <SkeletonLoader />}
      {all.state.status === 'error' && (
        <Card role="alert" className="mt-3 p-4 text-center">
          <p className="text-sm text-fg">Couldn’t load transactions.</p>
          <button type="button" onClick={all.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
            Retry
          </button>
        </Card>
      )}

      {data && !query.trim() && <p className="mt-6 text-center text-sm text-muted">Type to search all months.</p>}
      {data && query.trim() && hits.length === 0 && <p className="mt-6 text-center text-sm text-muted">No matching transactions.</p>}

      {hits.length > 0 && (
        <>
          <p className="mt-3 text-xs text-muted">
            {hits.length} found · net {total < 0 ? '−' : '+'}
            {formatAmount(Math.abs(total))}
            {hits.length > shown.length ? ` · showing latest ${shown.length}` : ''}
          </p>
          <Card as="section" ariaLabel="Search results" className="mt-2 overflow-hidden">
            <ul>
              {shown.map((t) => (
                <li key={t.id} className="relative border-t border-muted/10 first:border-t-0">
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${t.type === 'expense' ? 'bg-expense' : 'bg-income'}`} />
                  <button
                    type="button"
                    onClick={() => onPick(t)}
                    className="flex min-h-14 w-full items-center gap-3 py-2 pl-5 pr-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <CategoryIcon
                      name={t.categoryName}
                      icon={catById.get(t.categoryId)?.icon ?? getCategoryIcon(t.categoryName, t.type)}
                      color={catById.get(t.categoryId)?.color}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-fg">{t.categoryName}</span>
                      <span className="block truncate text-xs text-muted">
                        {dateLabel(t.date, today)}
                        {t.note ? ` · ${t.note}` : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 font-medium ${t.type === 'expense' ? 'text-expense' : 'text-income'}`}>
                      {formatSigned(t.amountMinor, t.type)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

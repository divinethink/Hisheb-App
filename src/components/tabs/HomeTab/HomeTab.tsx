import { useMemo, useRef, useState, type TouchEvent } from 'react';
import { Bell, Plus } from 'lucide-react';
import Logo from '../../common/Logo';
import SkeletonLoader from '../../common/SkeletonLoader';
import Card from '../../common/Card';
import CategoryIcon, { categoryTint } from '../../common/CategoryIcon';
import TransactionSheet from './TransactionSheet';
import HomeSearch from './HomeSearch';
import MonthSummaryCard from './MonthSummaryCard';
import { SearchToggle } from '../../common/ListSearch';
import { useBackClose } from '../../../hooks/useBackClose';
import { restoreTransaction, softDeleteTransaction } from '../../../data/transactionRepo';
import { useCategories, useLabels, useMonthTransactions, useRangeTransactions, useSettings } from '../../../hooks/useData';
import { getCategoryIcon } from '../../../lib/categoryIcons';
import { currentMonth, dateLabel, monthEndDate, monthLabel, shiftMonth, toDhakaDate } from '../../../lib/date';
import { formatAmount, formatNet, formatSigned } from '../../../lib/format';
import { avgMonthlyExpense } from '../../../lib/overviewCalc';
import { groupByDate, summarize } from '../../../lib/summary';
import type { Transaction } from '../../../validation/transactionSchema';
import type { Category, Label } from '../../../validation/catalogSchemas';

const NO_CATS: Category[] = [];
const NO_LABELS: Label[] = [];

export default function HomeTab({ uid, autoOpenAdd = false }: { uid: string; autoOpenAdd?: boolean }) {
  const now = useMemo(() => currentMonth(), []);
  const [month, setMonth] = useState(now);
  const today = useMemo(() => toDhakaDate(new Date()), []);
  const tx = useMonthTransactions(uid, month);
  // আগের ৩ মাসের গড় ব্যয় — Overview "Avg expense / month"-এর হুবহু একই হিসাব ও query (read-only)
  const avgMonths = useMemo(() => [shiftMonth(month, -1), shiftMonth(month, -2), shiftMonth(month, -3)], [month]);
  const avgTx = useRangeTransactions(uid, `${avgMonths[2]}-01`, monthEndDate(avgMonths[0]));
  const avgExpenseMinor = avgTx.state.status === 'ready' ? avgMonthlyExpense(avgTx.state.data, avgMonths) : null;
  const cats = useCategories(uid);
  const lbls = useLabels(uid);
  const settings = useSettings(uid);
  const [sheet, setSheet] = useState<{ initial: Transaction | null } | null>(autoOpenAdd ? { initial: null } : null); // G5 shortcut
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false); // সব-মাস সার্চ
  useBackClose(() => setSearchOpen(false), searchOpen); // ব্যাক = সার্চ বন্ধ (অ্যাপ নয়)
  const [typeFilter, setTypeFilter] = useState<'income' | 'expense' | null>(null); // Income/Expense tile ট্যাপ
  const [chipFilter, setChipFilter] = useState<string | null>(null); // item ৪: quick-chip ট্যাপে category-filter

  // মাস-strip + swipe (Spendee-স্টাইল, Owner-approved 2026-10-27): চলতি মাসের পরের ১ মাস পর্যন্ত (আগাম এন্ট্রির জন্য)
  const maxMonth = useMemo(() => shiftMonth(now, 1), [now]);
  const goMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    if (next > maxMonth) return;
    setMonth(next);
    setChipFilter(null);
    setTypeFilter(null);
  };
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    const noSwipe = (e.target as HTMLElement).closest('[data-no-swipe]');
    touchStart.current = noSwipe || !t ? null : { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: TouchEvent) {
    const st = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!st || !t || searchOpen) return;
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    goMonth(dx < 0 ? 1 : -1);
  }

  // soft-delete + 5s Undo snackbar (UI Mockup §৩, Gmail-স্টাইল); একবারে একটাই pending undo।
  async function handleDelete(id: string) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await softDeleteTransaction(uid, id);
    setSheet(null);
    setUndoId(id);
    undoTimer.current = setTimeout(() => setUndoId(null), 5000);
  }
  async function handleUndo() {
    if (!undoId) return;
    const id = undoId;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoId(null);
    await restoreTransaction(uid, id);
  }

  const editingId = sheet?.initial?.id ?? null;
  const txs = tx.state.status === 'ready' ? tx.state.data : null;
  const totals = useMemo(() => (txs ? summarize(txs) : null), [txs]);
  const catList = cats.state.status === 'ready' ? cats.state.data : NO_CATS;
  const catById = useMemo(() => new Map(catList.map((c) => [c.id, c])), [catList]);
  const budgetMinor = settings.state.status === 'ready' ? settings.state.data.overallMonthlyBudgetMinor : null;

  // item ৪/৭: এই মাসের top expense-category (quick-chips + নিচের insight card, দুটোতেই reuse)
  const topCategories = useMemo(() => {
    if (!txs) return [];
    const map = new Map<string, { categoryId: string; name: string; icon?: string | null; color?: string | null; amountMinor: number }>();
    for (const t of txs) {
      if (t.type !== 'expense') continue;
      const cur = map.get(t.categoryId);
      if (cur) cur.amountMinor += t.amountMinor;
      else
        map.set(t.categoryId, {
          categoryId: t.categoryId,
          name: t.categoryName,
          icon: catById.get(t.categoryId)?.icon ?? getCategoryIcon(t.categoryName, t.type),
          color: catById.get(t.categoryId)?.color,
          amountMinor: t.amountMinor,
        });
    }
    return [...map.values()].sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 4);
  }, [txs, catById]);

  const filteredTxs = useMemo(
    () => (txs ? txs.filter((t) => (!chipFilter || t.categoryId === chipFilter) && (!typeFilter || t.type === typeFilter)) : txs),
    [txs, chipFilter, typeFilter],
  );
  const groups = useMemo(() => (filteredTxs ? groupByDate(filteredTxs) : []), [filteredTxs]);

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto pb-24" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <header className="flex items-center justify-between px-4 pb-2 pt-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-fg"><Logo size={28} />হিসাব-নিকাশ</h1>
          {/* item ৬ (UI Polish): cloud sync-status icon সরানো হলো — OfflineBanner (AppShell, সব
              ট্যাবে global) ইতিমধ্যে এই একই তথ্য টেক্সটসহ দেখায়, তাই এখানে duplicate ছিল।
              Search এখন আসল (owner-approved 2026-10-27): সব মাসে category/note/label/অঙ্ক। Bell আপাতত visual placement মাত্র। */}
          <div className="flex items-center gap-1">
            <SearchToggle open={searchOpen} onToggle={() => setSearchOpen((o) => !o)} />
            <Bell aria-label="Reminders" size={18} className="text-muted" />
          </div>
        </header>
        {searchOpen && (
          <HomeSearch
            uid={uid}
            catById={catById}
            onPick={(t) => setSheet({ initial: t })}
          />
        )}
        {!searchOpen && (<>
        <nav aria-label="Month" className="flex items-center justify-center gap-1.5 overflow-hidden px-2 py-2">
          {[-1, 0, 1].map((d) => {
            const m = shiftMonth(month, d);
            if (m > maxMonth) return null;
            const active = d === 0;
            return (
              <button
                key={m}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => goMonth(d)}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  active ? 'bg-primary/10 text-sm font-medium text-primary' : 'text-xs text-muted'
                }`}
              >
                {monthLabel(m)}
              </button>
            );
          })}
        </nav>

        {tx.state.status === 'loading' && <SkeletonLoader />}

        {tx.state.status === 'error' && (
          <Card role="alert" className="m-4 p-4 text-center">
            <p className="text-sm text-fg">Couldn’t load transactions.</p>
            <button type="button" onClick={tx.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
              Retry
            </button>
          </Card>
        )}

        {totals && (
          <>
            <MonthSummaryCard
              incomeMinor={totals.incomeMinor}
              expenseMinor={totals.expenseMinor}
              savingsMinor={totals.savingsMinor}
              budgetMinor={budgetMinor != null && budgetMinor > 0 ? budgetMinor : null}
              avgExpenseMinor={avgExpenseMinor}
              month={month}
              today={today}
              typeFilter={typeFilter}
              onTypeFilter={setTypeFilter}
            />

            {topCategories.length > 1 && (
              <div className="mt-3">
                <p className="px-4 text-xs font-medium text-muted">Top categories this month</p>
                <div className="relative mt-1.5">
                  <div data-no-swipe className="flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {topCategories.map((c) => {
                      const active = chipFilter === c.categoryId;
                      const tint = categoryTint(c.name, c.color);
                      return (
                        <button
                          key={c.categoryId}
                          type="button"
                          onClick={() => setChipFilter((cur) => (cur === c.categoryId ? null : c.categoryId))}
                          style={active ? undefined : { background: `var(--chip-bg, ${tint.bg})` }}
                          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                            active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-fg'
                          }`}
                        >
                          <CategoryIcon name={c.name} icon={c.icon} color={c.color} size={20} />
                          <span className="max-w-[6rem] truncate" style={active ? undefined : { color: `var(--chip-fg, ${tint.fg})` }}>
                            {c.name}
                          </span>
                          <span className="font-medium text-fg" style={active ? undefined : { color: 'var(--chip-fg, rgb(var(--color-fg)))' }}>
                            {formatAmount(c.amountMinor)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* ডানে fade scroll-cue — আরও chip আছে বোঝাতে, page-token দিয়েই (dark-mode-safe) */}
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-page to-transparent" />
                </div>
              </div>
            )}

            {(chipFilter || typeFilter) && (
              <div className="mx-4 mt-2 flex items-center justify-between text-xs text-muted">
                <span>
                  Filtered: {[typeFilter && (typeFilter === 'income' ? 'Income' : 'Expense'), chipFilter && topCategories.find((c) => c.categoryId === chipFilter)?.name].filter(Boolean).join(' · ')}
                </span>
                <button type="button" onClick={() => { setChipFilter(null); setTypeFilter(null); }} className="font-medium text-primary">
                  Clear
                </button>
              </div>
            )}

            {tx.invalidCount > 0 && (
              <p className="mx-4 mt-2 text-xs text-muted">{tx.invalidCount} records couldn’t be loaded.</p>
            )}

            {groups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <p className="text-fg">No transactions yet — add your first one.</p>
                <button
                  type="button"
                  onClick={() => setSheet({ initial: null })}
                  className="min-h-11 rounded-lg bg-primary px-6 font-medium text-canvas"
                >
                  Add transaction
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-1 px-4">
                {groups.map((g) => (
                  <section key={g.date} aria-label={dateLabel(g.date, today)} className="mb-2">
                    <h2 className="flex justify-between px-2 pb-1 pt-1 text-xs font-medium text-muted">
                      <span>{dateLabel(g.date, today)}</span>
                      {g.txs.length > 1 && <span>{formatNet(g.netMinor)}</span>}
                    </h2>
                    <Card className="overflow-hidden">
                      <ul>
                        {g.txs.map((t) => (
                          <li key={t.id} className="border-t border-muted/10 first:border-t-0">
                            <button
                              type="button"
                              onClick={() => setSheet({ initial: t })}
                              className="flex min-h-12 w-full items-center gap-3 py-1.5 pl-3 pr-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              <CategoryIcon
                                vivid
                                size={32}
                                name={t.categoryName}
                                icon={catById.get(t.categoryId)?.icon ?? getCategoryIcon(t.categoryName, t.type)}
                                color={catById.get(t.categoryId)?.color}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-base text-fg">{t.categoryName}</span>
                                {t.note && <span className="block truncate text-xs text-muted">{t.note}</span>}
                                {t.labelNames.length > 0 && (
                                  <span className="mt-0.5 flex gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    {t.labelNames.map((name) => (
                                      <span
                                        key={name}
                                        className="shrink-0 rounded-full bg-muted/15 px-2 py-0.5 text-[11px] leading-4 text-muted"
                                      >
                                        {name}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </span>
                              <span className={`shrink-0 self-start text-base font-medium ${t.type === 'expense' ? 'text-expense' : 'text-income'}`}>
                                {formatSigned(t.amountMinor, t.type)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
        </>)}
      </div>

      <button
        type="button"
        aria-label="Add transaction"
        onClick={() => setSheet({ initial: null })}
        className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-canvas shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plus aria-hidden size={28} />
      </button>

      {sheet && (
        <TransactionSheet
          uid={uid}
          initial={sheet.initial}
          categories={cats.state.status === 'ready' ? cats.state.data : NO_CATS}
          labels={lbls.state.status === 'ready' ? lbls.state.data : NO_LABELS}
          onClose={() => setSheet(null)}
          onDelete={editingId ? () => handleDelete(editingId) : undefined}
        />
      )}

      {undoId && (
        <div
          role="status"
          className="absolute inset-x-4 bottom-20 flex items-center justify-between rounded-lg bg-fg px-4 py-3 text-canvas shadow-lg"
        >
          <span className="text-sm">Transaction deleted.</span>
          <button type="button" onClick={() => void handleUndo()} className="min-h-11 px-2 text-sm font-medium text-primary">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

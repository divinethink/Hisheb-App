import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, Plus, Search, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import SkeletonLoader from '../../common/SkeletonLoader';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';
import CategoryIcon, { categoryTint } from '../../common/CategoryIcon';
import BudgetProgressBar from '../../common/BudgetProgressBar';
import TransactionSheet from './TransactionSheet';
import { getTransactionsByMonth, restoreTransaction, softDeleteTransaction } from '../../../data/transactionRepo';
import { useCategories, useLabels, useMonthTransactions, useSettings } from '../../../hooks/useData';
import { getCategoryIcon } from '../../../lib/categoryIcons';
import { currentMonth, dateLabel, monthLabel, shiftMonth, toDhakaDate } from '../../../lib/date';
import { formatAmount, formatNet, formatSigned } from '../../../lib/format';
import { groupByDate, summarize } from '../../../lib/summary';
import type { Transaction } from '../../../validation/transactionSchema';
import type { Category, Label } from '../../../validation/catalogSchemas';

const NO_CATS: Category[] = [];
const NO_LABELS: Label[] = [];

// UI Polish [1_5] §১ item ৩: Budget-progress-bar-এর ৪-স্তর রঙের সাথে মিলিয়ে টেক্সট-টোন
// (BudgetProgressBar.tsx-এর levelColorClass-এর হুবহু থ্রেশহোল্ড, শুধু bg-এর বদলে text-)।
function budgetToneClass(pct: number): string {
  if (pct >= 100) return 'text-expense';
  if (pct >= 90) return 'text-danger';
  if (pct >= 80) return 'text-warning';
  return 'text-muted';
}

// item ১: "vs last month" — শতাংশ পরিবর্তন, আগের মাস ০/অজানা হলে দেখানো হয় না (বিভ্রান্তিকর %-এড়াতে)।
function trendText(current: number, previous: number | null): string | null {
  if (previous == null || previous <= 0) return null;
  if (current === previous) return '= vs last mo';
  const pct = Math.round((Math.abs(current - previous) / previous) * 100);
  return `${current > previous ? '↑' : '↓'}${pct}% vs last mo`;
}

export default function HomeTab({ uid, autoOpenAdd = false }: { uid: string; autoOpenAdd?: boolean }) {
  const now = useMemo(() => currentMonth(), []);
  const [month, setMonth] = useState(now);
  const today = useMemo(() => toDhakaDate(new Date()), []);
  const tx = useMonthTransactions(uid, month);
  const cats = useCategories(uid);
  const lbls = useLabels(uid);
  const settings = useSettings(uid);
  const [sheet, setSheet] = useState<{ initial: Transaction | null } | null>(autoOpenAdd ? { initial: null } : null); // G5 shortcut
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chipFilter, setChipFilter] = useState<string | null>(null); // item ৪: quick-chip ট্যাপে category-filter

  // item ১: আগের মাসের টোটাল — শুধু "vs last month" তুলনার জন্য, one-shot read (existing
  // getTransactionsByMonth reuse, live subscription না — কম-খরচে, রিপোর্ট-স্ক্রিনেও একই ফাংশন ব্যবহৃত)।
  const [prevTotals, setPrevTotals] = useState<{ incomeMinor: number; expenseMinor: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPrevTotals(null);
    getTransactionsByMonth(uid, shiftMonth(month, -1))
      .then((rows) => {
        if (!cancelled) setPrevTotals(summarize(rows));
      })
      .catch(() => {
        if (!cancelled) setPrevTotals(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, month]);

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
  const budgetPct = budgetMinor && budgetMinor > 0 && totals ? (totals.expenseMinor / budgetMinor) * 100 : 0;

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

  const filteredTxs = useMemo(() => (txs && chipFilter ? txs.filter((t) => t.categoryId === chipFilter) : txs), [txs, chipFilter]);
  const groups = useMemo(() => (filteredTxs ? groupByDate(filteredTxs) : []), [filteredTxs]);

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto pb-24">
        <header className="flex items-center justify-between px-4 pb-2 pt-3">
          <h1 className="text-lg font-semibold text-fg">হিসাব-নিকাশ</h1>
          {/* item ৬ (UI Polish): cloud sync-status icon সরানো হলো — OfflineBanner (AppShell, সব
              ট্যাবে global) ইতিমধ্যে এই একই তথ্য টেক্সটসহ দেখায়, তাই এখানে duplicate ছিল।
              Search/Bell আপাতত header-এ visual placement মাত্র (mockup-parity) — কোনো নতুন
              search/notification লজিক এই ধাপে যোগ হয়নি, পরে আলাদা approval-এ। */}
          <div className="flex items-center gap-3">
            <Search aria-label="Search" size={18} className="text-muted" />
            <Bell aria-label="Reminders" size={18} className="text-muted" />
          </div>
        </header>
        <div className="mx-4 flex items-center gap-3 py-2">
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="flex h-9 w-9 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ChevronLeft aria-hidden size={18} />
            </button>
            <span className="text-sm font-medium text-fg">{monthLabel(month)}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month >= now}
              className="flex h-9 w-9 items-center justify-center disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ChevronRight aria-hidden size={18} />
            </button>
          </div>
        </div>

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
            <Card as="section" ariaLabel="Month summary" className="mx-4 grid grid-cols-3 gap-1.5 p-3 text-center">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-income/10 py-2">
                <IconBadge icon={TrendingUp} tone="income" size={28} />
                <p className="text-xs text-muted">Income</p>
                <p className="text-sm font-semibold text-income">{formatAmount(totals.incomeMinor)}</p>
                {prevTotals && (
                  <p className="whitespace-nowrap text-[10px] text-muted">{trendText(totals.incomeMinor, prevTotals.incomeMinor)}</p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-expense/10 py-2">
                <IconBadge icon={TrendingDown} tone="expense" size={28} />
                <p className="text-xs text-muted">Expense</p>
                <p className="text-sm font-semibold text-expense">{formatAmount(totals.expenseMinor)}</p>
                {prevTotals && (
                  <p className="whitespace-nowrap text-[10px] text-muted">{trendText(totals.expenseMinor, prevTotals.expenseMinor)}</p>
                )}
              </div>
              <div className={`flex flex-col items-center gap-1 rounded-xl py-2 ${totals.savingsMinor < 0 ? 'bg-expense/10' : 'bg-income/10'}`}>
                <IconBadge icon={PiggyBank} tone={totals.savingsMinor < 0 ? 'expense' : 'income'} size={28} />
                <p className="text-xs text-muted">Savings</p>
                <p className={`text-sm font-semibold ${totals.savingsMinor < 0 ? 'text-expense' : 'text-income'}`}>
                  {formatNet(totals.savingsMinor)}
                </p>
              </div>
            </Card>

            {budgetMinor != null && budgetMinor > 0 && (
              <Card as="section" ariaLabel="Monthly target" className="mx-4 mt-2 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-muted">Monthly target</span>
                  <span className="text-xs font-medium text-fg">{Math.round(budgetPct)}% used</span>
                </div>
                <BudgetProgressBar spentMinor={totals.expenseMinor} budgetMinor={budgetMinor} />
                <p className={`mt-1 text-xs ${budgetToneClass(budgetPct)}`}>
                  {totals.expenseMinor > budgetMinor
                    ? `${formatAmount(totals.expenseMinor - budgetMinor)} over target`
                    : `${formatAmount(budgetMinor - totals.expenseMinor)} left this month`}
                </p>
              </Card>
            )}

            {topCategories.length > 1 && (
              <div className="mt-3">
                <p className="px-4 text-xs font-medium text-muted">Top categories this month</p>
                <div className="relative mt-1.5">
                  <div className="flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {topCategories.map((c) => {
                      const active = chipFilter === c.categoryId;
                      const tint = categoryTint(c.name, c.color);
                      return (
                        <button
                          key={c.categoryId}
                          type="button"
                          onClick={() => setChipFilter((cur) => (cur === c.categoryId ? null : c.categoryId))}
                          style={active ? undefined : { background: tint.bg }}
                          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                            active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-fg'
                          }`}
                        >
                          <CategoryIcon name={c.name} icon={c.icon} color={c.color} size={20} />
                          <span className="max-w-[6rem] truncate" style={active ? undefined : { color: tint.fg }}>
                            {c.name}
                          </span>
                          <span className="font-medium text-fg">{formatAmount(c.amountMinor)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* ডানে fade scroll-cue — আরও chip আছে বোঝাতে, page-token দিয়েই (dark-mode-safe) */}
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-page to-transparent" />
                </div>
              </div>
            )}

            {chipFilter && (
              <div className="mx-4 mt-2 flex items-center justify-between text-xs text-muted">
                <span>Filtered: {topCategories.find((c) => c.categoryId === chipFilter)?.name}</span>
                <button type="button" onClick={() => setChipFilter(null)} className="font-medium text-primary">
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
              <div className="mt-4 flex flex-col gap-3 px-4">
                {groups.map((g) => (
                  <Card as="section" key={g.date} ariaLabel={dateLabel(g.date, today)} className="overflow-hidden">
                    <h2 className="flex justify-between px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted">
                      <span>{dateLabel(g.date, today)}</span>
                      <span>{formatNet(g.netMinor)}</span>
                    </h2>
                    <ul>
                      {g.txs.map((t) => (
                        <li key={t.id} className="relative border-t border-muted/10 first:border-t-0">
                          <span
                            aria-hidden
                            className={`absolute inset-y-0 left-0 w-[3px] ${t.type === 'expense' ? 'bg-expense' : 'bg-income'}`}
                          />
                          <button
                            type="button"
                            onClick={() => setSheet({ initial: t })}
                            className="flex min-h-16 w-full items-center gap-3 py-2.5 pl-5 pr-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <CategoryIcon
                              name={t.categoryName}
                              icon={catById.get(t.categoryId)?.icon ?? getCategoryIcon(t.categoryName, t.type)}
                              color={catById.get(t.categoryId)?.color}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-fg">{t.categoryName}</span>
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
                            <span className={`shrink-0 self-start font-medium ${t.type === 'expense' ? 'text-expense' : 'text-income'}`}>
                              {formatSigned(t.amountMinor, t.type)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
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

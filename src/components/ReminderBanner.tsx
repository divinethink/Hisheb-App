import { useMemo, useState } from 'react';
import { Info, TriangleAlert, Siren, X } from 'lucide-react';
import { useDebts, useInvestments, useMonthTransactions, useNetWorthSnapshots, useSettings } from '../hooks/useData';
import { updateSettings } from '../data/settingsRepo';
import { currentMonth, toDhakaDate } from '../lib/date';
import { dueItemsFrom, pickReminders, type Reminder } from '../lib/reminder';
import { summarize } from '../lib/summary';

const TONE = {
  info: { cls: 'border-primary bg-primary/10', Icon: Info },
  warning: { cls: 'border-warning bg-warning/15', Icon: TriangleAlert },
  danger: { cls: 'border-danger bg-danger/15', Icon: TriangleAlert },
  critical: { cls: 'border-expense bg-expense/15', Icon: Siren },
} as const;

// In-app reminder ব্যানার (Home-এর উপরে, UI Mockup §৪)। "দেখানো হয়েছে" রেকর্ড হয় dismiss/action-এ (সাথে সাথে না —
// নইলে settings snapshot আপডেটে ব্যানার দেখানোর মুহূর্তেই হারিয়ে যেত)। অ্যাপ বন্ধ থাকলে কিছু হয় না (push নেই)।
export default function ReminderBanner({
  uid,
  onOpenUpdateBalances,
}: {
  uid: string;
  onOpenUpdateBalances: (month: string) => void;
}) {
  const month = useMemo(() => currentMonth(), []);
  const settings = useSettings(uid);
  const snaps = useNetWorthSnapshots(uid);
  const tx = useMonthTransactions(uid, month);
  const debts = useDebts(uid);
  const inv = useInvestments(uid);
  const [busy, setBusy] = useState(false);

  const reminders = useMemo<Reminder[]>(() => {
    // সব ডেটা লোড না হওয়া পর্যন্ত কিছু দেখাই না — নইলে ভুল "missed month"/budget flash হতো
    if (settings.state.status !== 'ready' || snaps.state.status !== 'ready' || tx.state.status !== 'ready') return [];
    return pickReminders({
      now: new Date(),
      settings: settings.state.data,
      snapshots: snaps.state.data,
      monthExpenseMinor: summarize(tx.state.data).expenseMinor,
      // debts/investments লোড না হলে due-reminder এড়ানো (বাকিগুলো স্বাভাবিক)
      dues:
        debts.state.status === 'ready' && inv.state.status === 'ready'
          ? dueItemsFrom(debts.state.data, inv.state.data)
          : [],
    });
  }, [settings.state, snaps.state, tx.state, debts.state, inv.state]);

  async function markShown(r: Reminder) {
    if (busy) return;
    setBusy(true);
    try {
      const today = toDhakaDate(new Date());
      if (r.kind === 'budget') {
        await updateSettings(uid, { lastBudgetThresholdShownDate: today, lastBudgetThresholdShownLevel: r.level });
      } else if (r.kind === 'dueDate') {
        await updateSettings(uid, { lastDueDateReminderShownDate: today });
      } else {
        await updateSettings(uid, { lastReminderShownDate: today });
      }
    } finally {
      setBusy(false);
    }
  }

  if (reminders.length === 0) return null;
  return (
    <div className="shrink-0 space-y-2 px-4 pt-2" aria-label="Reminders">
      {reminders.map((r) => {
        const { cls, Icon } = TONE[r.kind === 'budget' ? r.tone : r.kind === 'dueDate' ? 'warning' : 'info'];
        const actionable = r.kind === 'monthEnd' || r.kind === 'missedMonth';
        return (
          <div key={r.kind} role="status" className={`flex items-center gap-2 rounded-lg border-l-4 py-1 pl-3 pr-1 ${cls}`}>
            <Icon aria-hidden size={18} className="shrink-0 text-fg" />
            {actionable ? (
              <button
                type="button"
                onClick={() => {
                  void markShown(r);
                  onOpenUpdateBalances(r.kind === 'missedMonth' ? r.month : month);
                }}
                className="min-h-11 flex-1 text-left text-sm text-fg"
              >
                {r.message} <span className="underline">Update balances</span>
              </button>
            ) : (
              <p className="flex-1 py-2 text-sm text-fg">{r.message}</p>
            )}
            <button
              type="button"
              aria-label="Dismiss reminder"
              onClick={() => void markShown(r)}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
            >
              <X aria-hidden size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

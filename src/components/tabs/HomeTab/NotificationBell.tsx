import { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Info, Siren, TriangleAlert } from 'lucide-react';
import BottomSheet from '../../common/BottomSheet';
import { updateSettings } from '../../../data/settingsRepo';
import { useDebts, useInvestments, useMonthTransactions, useNetWorthSnapshots, useSettings } from '../../../hooks/useData';
import { buildNotifications, unseenCount, type AppNotification, type NotificationTarget } from '../../../lib/notifications';
import { currentMonth } from '../../../lib/date';
import { dueItemsFrom } from '../../../lib/reminder';
import { summarize } from '../../../lib/summary';
import type { TabId } from '../../BottomNav';

const TONE = {
  info: { cls: 'bg-primary/10 text-primary', Icon: Info },
  warning: { cls: 'bg-warning/15 text-warning', Icon: TriangleAlert },
  danger: { cls: 'bg-danger/15 text-danger', Icon: TriangleAlert },
  critical: { cls: 'bg-expense/15 text-expense', Icon: Siren },
} as const;
const TAB_OF: Record<NotificationTarget, TabId> = { menu: 'menu', ledger: 'ledger', networth: 'networth' };

// Home বেল (owner-approved 2026-11-22): এখন যা সত্যি তার তালিকা + না-দেখা সংখ্যার badge।
// "দেখা হয়েছে" settings.notificationsSeenKeys-এ (সব ডিভাইসে এক)। অ্যাপ বন্ধ থাকলে কিছু আসে না।
export default function NotificationBell({ uid, onNavigate }: { uid: string; onNavigate: (tab: TabId, month?: string) => void }) {
  const month = useMemo(() => currentMonth(), []);
  const settings = useSettings(uid);
  const snaps = useNetWorthSnapshots(uid);
  const tx = useMonthTransactions(uid, month);
  const debts = useDebts(uid);
  const inv = useInvestments(uid);
  const [open, setOpen] = useState(false);
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set()); // খোলার মুহূর্তের না-দেখা

  const ready = settings.state.status === 'ready' && snaps.state.status === 'ready' && tx.state.status === 'ready';
  const list = useMemo<AppNotification[]>(() => {
    if (settings.state.status !== 'ready' || snaps.state.status !== 'ready' || tx.state.status !== 'ready') return [];
    return buildNotifications({
      now: new Date(),
      reminderEnabled: settings.state.data.reminderEnabled,
      budgetMinor: settings.state.data.overallMonthlyBudgetMinor,
      monthExpenseMinor: summarize(tx.state.data).expenseMinor,
      snapshots: snaps.state.data,
      dues: debts.state.status === 'ready' && inv.state.status === 'ready' ? dueItemsFrom(debts.state.data, inv.state.data) : [],
    });
  }, [settings.state, snaps.state, tx.state, debts.state, inv.state]);

  const seen = settings.state.status === 'ready' ? settings.state.data.notificationsSeenKeys : [];
  const count = ready ? unseenCount(list, seen) : 0;
  const remindersOff = settings.state.status === 'ready' && !settings.state.data.reminderEnabled;

  function openSheet() {
    setUnseenIds(new Set(list.filter((n) => !seen.includes(n.id)).map((n) => n.id)));
    setOpen(true);
    // সব এখন দেখা হলো; শুধু বর্তমান আইডি রাখা হয় (পুরনোগুলো নিজে থেকে ঝরে যায়, তালিকা ছোট থাকে)
    if (count > 0) void updateSettings(uid, { notificationsSeenKeys: list.map((n) => n.id).slice(0, 50) }).catch(() => undefined);
  }
  function pick(n: AppNotification) {
    setOpen(false);
    onNavigate(TAB_OF[n.target], n.month);
  }

  return (
    <>
      <button
        type="button"
        aria-label={count > 0 ? `Notifications, ${count} new` : 'Notifications'}
        onClick={openSheet}
        className="relative flex h-11 w-11 items-center justify-center text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Bell aria-hidden size={18} />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-expense px-1 text-[10px] font-semibold leading-none text-canvas">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <BottomSheet
          title="Notifications"
          onRequestClose={() => setOpen(false)}
          footer={
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-canvas">
              Close
            </button>
          }
        >
          {remindersOff ? (
            <p className="py-8 text-center text-sm text-muted">Reminders are turned off. Turn them on from Menu to see notifications here.</p>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted">
              <CheckCircle2 aria-hidden size={28} />
              <p className="text-sm">You&rsquo;re all caught up.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((n) => {
                const { cls, Icon } = TONE[n.tone];
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => pick(n)} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-muted/15 p-3 text-left">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cls}`}>
                        <Icon aria-hidden size={18} />
                      </span>
                      <span className="flex-1 text-sm text-fg">{n.message}</span>
                      {unseenIds.has(n.id) && <span aria-label="New" className="h-2 w-2 shrink-0 rounded-full bg-expense" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </BottomSheet>
      )}
    </>
  );
}

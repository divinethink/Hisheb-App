import { lazy, Suspense, useEffect, useState } from 'react';
import BottomNav, { type TabId } from './BottomNav';
import SkeletonLoader from './common/SkeletonLoader';
import ReminderBanner from './ReminderBanner';
import OfflineBanner from './OfflineBanner';
import { useThemeSync } from '../hooks/useThemeSync';
import type { SessionUser } from '../auth/AuthProvider';

// প্রতিটা ট্যাব আলাদা chunk (Dev Rule ১০, Architecture Plan §৭)
const HomeTab = lazy(() => import('./tabs/HomeTab/HomeTab'));
const LedgerTab = lazy(() => import('./tabs/LedgerTab/LedgerTab'));
const NetWorthTab = lazy(() => import('./tabs/NetWorthTab/NetWorthTab'));
const OverviewTab = lazy(() => import('./tabs/OverviewTab/OverviewTab'));
const SettingsTab = lazy(() => import('./tabs/SettingsTab/SettingsTab')); // UI-লেবেল "Menu"

export default function AppShell({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<TabId>('home');
  // reminder ব্যানার থেকে Update Balances খোলা (আগের মাস preselect হতে পারে)
  const [updateRequest, setUpdateRequest] = useState<{ month: string } | null>(null);
  useThemeSync(user.uid);
  // PWA App-Shortcut (G5): `/?action=add-expense` → Home-এ Add sheet একবার খোলে, তারপর URL পরিষ্কার
  const [autoOpenAdd] = useState(() => new URLSearchParams(window.location.search).get('action') === 'add-expense');
  useEffect(() => {
    if (autoOpenAdd) window.history.replaceState(null, '', window.location.pathname);
  }, [autoOpenAdd]);
  return (
    <div className="flex h-full flex-col bg-page">
      <OfflineBanner />
      {tab === 'home' && (
        <ReminderBanner
          uid={user.uid}
          onOpenUpdateBalances={(month) => {
            setUpdateRequest({ month });
            setTab('networth');
          }}
        />
      )}
      <main className="min-h-0 flex-1">
        <Suspense fallback={<SkeletonLoader />}>
          {tab === 'home' && <HomeTab uid={user.uid} autoOpenAdd={autoOpenAdd} />}
          {tab === 'ledger' && <LedgerTab uid={user.uid} />}
          {tab === 'networth' && <NetWorthTab uid={user.uid} updateRequest={updateRequest} onUpdateRequestHandled={() => setUpdateRequest(null)} />}
          {tab === 'overview' && <OverviewTab uid={user.uid} />}
          {tab === 'menu' && <SettingsTab user={user} />}
        </Suspense>
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

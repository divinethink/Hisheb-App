import { lazy, Suspense, useState } from 'react';
import {
  Palette,
  Smartphone,
  Upload,
  BarChart3,
  Landmark as LandmarkIcon,
  CalendarRange,
  TrendingUp,
  Cloud,
  Trash2,
  ChevronRight,
  ChevronDown,
  Tags,
  Tag,
  Lock,
  Target,
  TriangleAlert,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import Logo from '../../common/Logo';
import { MenuRow, MenuSection, Tile, ToggleRow } from './MenuParts';
import { useAuth, type SessionUser } from '../../../auth/AuthProvider';
import SkeletonLoader from '../../common/SkeletonLoader';
import { useCategories, useLabels, useSettings } from '../../../hooks/useData';
import { useHasPasscode } from '../../../hooks/useAppLock';
import { updateSettings } from '../../../data/settingsRepo';
import { useInstallPrompt } from '../../../pwa/install';
import { formatTaka } from '../../../lib/format';
import { findTheme } from '../../../lib/theme';

// papaparse/xlsx ভারী বলে দরকার হওয়ার আগ পর্যন্ত লোড হয় না (dynamic import, Roadmap §৮ item ১)
const ImportCsv = lazy(() => import('./ImportCsv'));
const ImportExcelInvestments = lazy(() => import('./ImportExcelInvestments'));
const ImportExcelAccountBalances = lazy(() => import('./ImportExcelAccountBalances'));
const ImportExcelHistorical = lazy(() => import('./ImportExcelHistorical'));
const ImportExcelMonthlySnapshots = lazy(() => import('./ImportExcelMonthlySnapshots'));
const ImportExcelBreakdown = lazy(() => import('./ImportExcelBreakdown'));
const ImportExcelMonthlyFlow = lazy(() => import('./ImportExcelMonthlyFlow'));
const ImportGpf = lazy(() => import('./ImportGpf'));
const FixCategoryTypes = lazy(() => import('./FixCategoryTypes'));
const BackupRestore = lazy(() => import('./BackupRestore'));
const BulkDeleteScreen = lazy(() => import('./BulkDeleteScreen'));
const AppearanceScreen = lazy(() => import('./AppearanceScreen'));
const PasscodeScreen = lazy(() => import('./PasscodeScreen'));
const BudgetScreen = lazy(() => import('./BudgetScreen'));
const LargeAmountScreen = lazy(() => import('./LargeAmountScreen'));
const ManageCatalog = lazy(() => import('./ManageCatalog'));


// migration সারি (cutover-টুল) — আগের মতোই সরল Row
function Row({
  icon: Icon,
  label,
  onClick,
  danger = false,
  tone = 'text-muted',
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${danger ? 'text-expense' : 'text-fg'}`}
    >
      <Icon aria-hidden size={19} className={`shrink-0 ${danger ? 'text-expense' : tone}`} />
      <span className="flex-1">{label}</span>
      <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
    </button>
  );
}

const MODE_LABEL = { light: 'Light', dark: 'Dark', sepia: 'Sepia', system: 'System' } as const;

// UI-লেবেল "Menu" (Audit 2026-09-15); ফোল্ডার-নাম ইচ্ছাকৃতভাবে SettingsTab
export default function SettingsTab({ user }: { user: SessionUser }) {
  const { signOut } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [importExcelOpen, setImportExcelOpen] = useState(false);
  const [importExcelBalancesOpen, setImportExcelBalancesOpen] = useState(false);
  const [importHistoricalOpen, setImportHistoricalOpen] = useState(false);
  const [importMonthlySnapshotsOpen, setImportMonthlySnapshotsOpen] = useState(false);
  const [importBreakdownOpen, setImportBreakdownOpen] = useState(false);
  const [importFlowOpen, setImportFlowOpen] = useState(false);
  const [importGpfOpen, setImportGpfOpen] = useState(false);
  const [fixCategoryTypesOpen, setFixCategoryTypesOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [largeOpen, setLargeOpen] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  const passcodeOn = useHasPasscode();
  const settings = useSettings(user.uid);
  const cats = useCategories(user.uid);
  const lbls = useLabels(user.uid);
  const s = settings.state.status === 'ready' ? settings.state.data : null;
  const budget = s?.overallMonthlyBudgetMinor ?? null;
  const threshold = s?.largeAmountWarningThresholdMinor ?? null;
  const remindersOn = s?.reminderEnabled ?? true;
  const modeLabel = findTheme(s?.themeColor)?.label ?? MODE_LABEL[s?.displayMode ?? 'system'];
  const name = user.displayName ?? 'Your Google account';
  const initial = (user.displayName ?? user.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="h-full overflow-y-auto p-4 pb-10">
      <h1 className="sr-only">Menu</h1>

      <section aria-label="Account" className="flex items-center gap-3 rounded-2xl border border-muted/10 bg-canvas p-4 shadow-sm">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-canvas">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-fg">{name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile icon={Palette} tint="c3" title="Appearance" sub={modeLabel} onClick={() => setAppearanceOpen(true)} />
        <Tile icon={Lock} tint="c2" title="Passcode" sub={passcodeOn ? 'On' : 'Off'} onClick={() => setPasscodeOpen(true)} />
        <Tile icon={Cloud} tint="c1" title="Backup" sub="Drive & device" onClick={() => setBackupOpen(true)} />
      </div>

      {canInstall && (
        <MenuSection>
          <MenuRow icon={Smartphone} tint="c1" label="Install app on this device" onClick={() => void install()} />
        </MenuSection>
      )}

      <MenuSection title="Budget & alerts">
        <MenuRow icon={Target} tint="c4" label="Monthly target" value={budget != null ? formatTaka(budget) : 'Not set'} onClick={() => setBudgetOpen(true)} />
        <MenuRow icon={TriangleAlert} tint="c5" label="Large-amount warning" value={threshold != null ? formatTaka(threshold) : 'Off'} onClick={() => setLargeOpen(true)} />
        <ToggleRow icon={Bell} tint="c7" label="Reminders" checked={remindersOn} onChange={(v) => void updateSettings(user.uid, { reminderEnabled: v })} />
      </MenuSection>

      <MenuSection title="Organize">
        <MenuRow icon={Tags} tint="c1" label="Categories" value={cats.state.status === 'ready' ? String(cats.state.data.length) : undefined} onClick={() => setManageCategoriesOpen(true)} />
        <MenuRow icon={Tag} tint="c6" label="Labels" value={lbls.state.status === 'ready' ? String(lbls.state.data.length) : undefined} onClick={() => setManageLabelsOpen(true)} />
      </MenuSection>

      {/* এককালীন cutover-টুল — Gate F-এর পরে অপ্রয়োজনীয় হয়ে যাবে, তাই ডিফল্ট ভাঁজ-করা (native <details>, অতিরিক্ত state ছাড়াই) */}
      <details className="group mt-5 overflow-hidden rounded-2xl border border-muted/10 bg-canvas shadow-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm text-muted [&::-webkit-details-marker]:hidden">
          <Upload aria-hidden size={19} className="shrink-0" />
          <span className="flex-1">Migration (temporary) · 9</span>
          <ChevronDown aria-hidden size={18} className="shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-muted/10">
          <Row icon={Upload} label="Import Spendee CSV" onClick={() => setImportOpen(true)} />
          <div className="border-t border-muted/10">
            <Row icon={BarChart3} label="Migrate Investments from Excel" onClick={() => setImportExcelOpen(true)} />
          </div>
          <div className="border-t border-muted/10">
            <Row icon={LandmarkIcon} label="Migrate Aug 2026 Account Balances from Excel" onClick={() => setImportExcelBalancesOpen(true)} />
          </div>
          <div className="border-t border-muted/10">
            <Row icon={CalendarRange} label="Migrate Historical Yearly Totals (2023–2025)" onClick={() => setImportHistoricalOpen(true)} />
          </div>
          <div className="border-t border-muted/10">
            <Row icon={TrendingUp} label="Migrate Monthly Net Worth History (Jan 2025–Jul 2026)" onClick={() => setImportMonthlySnapshotsOpen(true)} />
            <Row icon={TrendingUp} label="Migrate Monthly History Split (Excel)" onClick={() => setImportBreakdownOpen(true)} />
            <Row icon={CalendarRange} label="Migrate Monthly Income/Expense (Excel)" onClick={() => setImportFlowOpen(true)} />
          </div>
          <div className="border-t border-muted/10">
            <Row icon={LandmarkIcon} label="Import GPF Entries (CSV)" onClick={() => setImportGpfOpen(true)} />
          </div>
          <div className="border-t border-muted/10">
            <Row icon={Upload} label="Fix Category Types (from history)" onClick={() => setFixCategoryTypesOpen(true)} />
          </div>
        </div>
      </details>

      <MenuSection title="Danger zone">
        <MenuRow icon={Trash2} tint="danger" label="Delete data (permanent)" onClick={() => setBulkDeleteOpen(true)} danger />
      </MenuSection>

      <footer className="mt-8 flex flex-col items-center gap-2">
        <button type="button" onClick={() => void signOut()} className="min-h-11 px-4 text-sm text-muted underline">
          Sign out
        </button>
        <Logo size={28} />
        <p className="text-xs text-muted">হিসাব-নিকাশ</p>
      </footer>

      {budgetOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <BudgetScreen uid={user.uid} onClose={() => setBudgetOpen(false)} />
        </Suspense>
      )}
      {largeOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <LargeAmountScreen uid={user.uid} onClose={() => setLargeOpen(false)} />
        </Suspense>
      )}
      {appearanceOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <AppearanceScreen uid={user.uid} onClose={() => setAppearanceOpen(false)} />
        </Suspense>
      )}
      {passcodeOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <PasscodeScreen onClose={() => setPasscodeOpen(false)} />
        </Suspense>
      )}
      {manageCategoriesOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ManageCatalog uid={user.uid} kind="category" onClose={() => setManageCategoriesOpen(false)} />
        </Suspense>
      )}
      {manageLabelsOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ManageCatalog uid={user.uid} kind="label" onClose={() => setManageLabelsOpen(false)} />
        </Suspense>
      )}
      {importOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ImportCsv uid={user.uid} onClose={() => setImportOpen(false)} />
        </Suspense>
      )}
      {importExcelOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ImportExcelInvestments uid={user.uid} onClose={() => setImportExcelOpen(false)} />
        </Suspense>
      )}
      {importExcelBalancesOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ImportExcelAccountBalances uid={user.uid} onClose={() => setImportExcelBalancesOpen(false)} />
        </Suspense>
      )}
      {importHistoricalOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ImportExcelHistorical uid={user.uid} onClose={() => setImportHistoricalOpen(false)} />
        </Suspense>
      )}
      {importMonthlySnapshotsOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ImportExcelMonthlySnapshots uid={user.uid} onClose={() => setImportMonthlySnapshotsOpen(false)} />
        </Suspense>
      )}
      {importBreakdownOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ImportExcelBreakdown uid={user.uid} onClose={() => setImportBreakdownOpen(false)} />
        </Suspense>
      )}
      {importFlowOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ImportExcelMonthlyFlow uid={user.uid} onClose={() => setImportFlowOpen(false)} />
        </Suspense>
      )}
      {importGpfOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <ImportGpf uid={user.uid} onClose={() => setImportGpfOpen(false)} />
        </Suspense>
      )}
      {fixCategoryTypesOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <FixCategoryTypes uid={user.uid} onClose={() => setFixCategoryTypesOpen(false)} />
        </Suspense>
      )}
      {backupOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <BackupRestore user={user} onClose={() => setBackupOpen(false)} />
        </Suspense>
      )}
      {bulkDeleteOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <BulkDeleteScreen user={user} onClose={() => setBulkDeleteOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

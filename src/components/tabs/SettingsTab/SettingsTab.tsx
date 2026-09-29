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
  type LucideIcon,
} from 'lucide-react';
import Card from '../../common/Card';
import { useAuth, type SessionUser } from '../../../auth/AuthProvider';
import SkeletonLoader from '../../common/SkeletonLoader';
import { useSettings } from '../../../hooks/useData';
import { updateSettings } from '../../../data/settingsRepo';
import { useInstallPrompt } from '../../../pwa/install';
import { minorToInput, parseAmountToMinor } from '../../../lib/money';

// papaparse/xlsx ভারী বলে দরকার হওয়ার আগ পর্যন্ত লোড হয় না (dynamic import, Roadmap §৮ item ১)
const ImportCsv = lazy(() => import('./ImportCsv'));
const ImportExcelInvestments = lazy(() => import('./ImportExcelInvestments'));
const ImportExcelAccountBalances = lazy(() => import('./ImportExcelAccountBalances'));
const ImportExcelHistorical = lazy(() => import('./ImportExcelHistorical'));
const ImportExcelMonthlySnapshots = lazy(() => import('./ImportExcelMonthlySnapshots'));
const ImportGpf = lazy(() => import('./ImportGpf'));
const FixCategoryTypes = lazy(() => import('./FixCategoryTypes'));
const BackupRestore = lazy(() => import('./BackupRestore'));
const BulkDeleteScreen = lazy(() => import('./BulkDeleteScreen'));
const AppearanceScreen = lazy(() => import('./AppearanceScreen'));
const ManageCatalog = lazy(() => import('./ManageCatalog'));

// সেকশন-হেডার + row-বাটন — Ledger/Net Worth-এর মতোই একই কার্ড-প্যাটার্ন (UI Polish Step ২)
function SectionLabel({ children }: { children: string }) {
  return <h2 className="mb-2 mt-5 px-1 text-xs font-medium uppercase tracking-wide text-muted first:mt-0">{children}</h2>;
}

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

// UI-লেবেল "Menu" (Audit 2026-09-15); ফোল্ডার-নাম ইচ্ছাকৃতভাবে SettingsTab
export default function SettingsTab({ user }: { user: SessionUser }) {
  const { signOut } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [importExcelOpen, setImportExcelOpen] = useState(false);
  const [importExcelBalancesOpen, setImportExcelBalancesOpen] = useState(false);
  const [importHistoricalOpen, setImportHistoricalOpen] = useState(false);
  const [importMonthlySnapshotsOpen, setImportMonthlySnapshotsOpen] = useState(false);
  const [importGpfOpen, setImportGpfOpen] = useState(false);
  const [fixCategoryTypesOpen, setFixCategoryTypesOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  const settings = useSettings(user.uid);
  const [thresholdInput, setThresholdInput] = useState('');
  const [thresholdBusy, setThresholdBusy] = useState(false);
  const savedThreshold =
    settings.state.status === 'ready' ? settings.state.data.largeAmountWarningThresholdMinor : null;

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetBusy, setBudgetBusy] = useState(false);
  const savedBudget = settings.state.status === 'ready' ? settings.state.data.overallMonthlyBudgetMinor : null;
  const remindersOn = settings.state.status === 'ready' ? settings.state.data.reminderEnabled : true;

  async function saveBudget() {
    if (budgetBusy) return;
    const minor = budgetInput.trim() === '' ? null : parseAmountToMinor(budgetInput);
    if (budgetInput.trim() !== '' && minor === null) return;
    setBudgetBusy(true);
    try {
      await updateSettings(user.uid, { overallMonthlyBudgetMinor: minor });
      setBudgetInput('');
    } finally {
      setBudgetBusy(false);
    }
  }

  async function saveThreshold() {
    if (thresholdBusy) return;
    const minor = thresholdInput.trim() === '' ? null : parseAmountToMinor(thresholdInput);
    if (thresholdInput.trim() !== '' && minor === null) return; // invalid, silently ignore (no blocking UI needed here)
    setThresholdBusy(true);
    try {
      await updateSettings(user.uid, { largeAmountWarningThresholdMinor: minor });
      setThresholdInput('');
    } finally {
      setThresholdBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 pb-10">
      <h1 className="text-lg font-semibold text-fg">Menu</h1>
      <p className="mt-1 text-sm text-muted">{user.displayName ?? 'Your Google account'}</p>
      <p className="text-sm text-muted">{user.email}</p>

      <SectionLabel>Preferences</SectionLabel>
      <Card className="overflow-hidden">
        <Row icon={Palette} label="Appearance (Accent + Dark Mode)" onClick={() => setAppearanceOpen(true)} />
        {canInstall && (
          <div className="border-t border-muted/10">
            <Row icon={Smartphone} label="Install app on this device" onClick={() => void install()} tone="text-primary" />
          </div>
        )}
      </Card>

      <Card className="mt-3 overflow-hidden">
        <button
          type="button"
          onClick={() => setBudgetOpen((v) => !v)}
          aria-expanded={budgetOpen}
          className="flex w-full items-start gap-2 p-4 text-left"
        >
          <div className="flex-1">
            <h3 className="text-sm font-medium text-fg">Monthly Target (Overall budget)</h3>
            <p className="mt-1 text-xs text-muted">
              {savedBudget != null
                ? `Currently BDT ${minorToInput(savedBudget)} — reminders at 70% / 80% / 90% / 100%.`
                : 'Not set — set a target to get budget reminders.'}
            </p>
          </div>
          <ChevronDown
            aria-hidden
            size={18}
            className={`mt-0.5 shrink-0 text-muted transition-transform ${budgetOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {budgetOpen && (
          <div className="border-t border-muted/10 p-4 pt-3">
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                aria-label="Monthly target"
                placeholder="e.g. 30000"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="min-h-11 flex-1 rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
              />
              <button
                type="button"
                onClick={() => void saveBudget()}
                disabled={budgetBusy}
                className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60"
              >
                Save
              </button>
            </div>
            {savedBudget != null && (
              <button
                type="button"
                onClick={() => void updateSettings(user.uid, { overallMonthlyBudgetMinor: null })}
                className="mt-2 text-sm text-muted underline"
              >
                Clear target
              </button>
            )}
            <label className="mt-4 flex min-h-11 items-center gap-3 border-t border-muted/10 pt-3 text-sm text-fg">
              <input
                type="checkbox"
                checked={remindersOn}
                onChange={(e) => void updateSettings(user.uid, { reminderEnabled: e.target.checked })}
                className="h-5 w-5"
              />
              In-app reminders (month-end, budget)
            </label>
          </div>
        )}
      </Card>

      <Card className="mt-3 overflow-hidden">
        <button
          type="button"
          onClick={() => setThresholdOpen((v) => !v)}
          aria-expanded={thresholdOpen}
          className="flex w-full items-start gap-2 p-4 text-left"
        >
          <div className="flex-1">
            <h3 className="text-sm font-medium text-fg">Large-amount warning</h3>
            <p className="mt-1 text-xs text-muted">
              {savedThreshold != null
                ? `Currently on — warns above BDT ${minorToInput(savedThreshold)}.`
                : 'Off by default — set a threshold to enable.'}
            </p>
          </div>
          <ChevronDown
            aria-hidden
            size={18}
            className={`mt-0.5 shrink-0 text-muted transition-transform ${thresholdOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {thresholdOpen && (
          <div className="border-t border-muted/10 p-4 pt-3">
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                aria-label="Large-amount warning threshold"
                placeholder="e.g. 20000 (blank = off)"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="min-h-11 flex-1 rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
              />
              <button
                type="button"
                onClick={() => void saveThreshold()}
                disabled={thresholdBusy}
                className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60"
              >
                Save
              </button>
            </div>
            {savedThreshold != null && (
              <button
                type="button"
                onClick={() => void updateSettings(user.uid, { largeAmountWarningThresholdMinor: null })}
                className="mt-2 text-sm text-muted underline"
              >
                Turn off
              </button>
            )}
          </div>
        )}
      </Card>

      <SectionLabel>Categories & Labels</SectionLabel>
      <Card className="overflow-hidden">
        <Row icon={Tags} label="Manage Categories" onClick={() => setManageCategoriesOpen(true)} />
        <div className="border-t border-muted/10">
          <Row icon={Tag} label="Manage Labels" onClick={() => setManageLabelsOpen(true)} />
        </div>
      </Card>

      <SectionLabel>Data</SectionLabel>
      <Card className="overflow-hidden">
        <Row icon={Cloud} label="Backup / Restore" onClick={() => setBackupOpen(true)} />
        <div className="border-t border-muted/10">
          <Row icon={Trash2} label="Delete Data (Permanent)" onClick={() => setBulkDeleteOpen(true)} danger />
        </div>
      </Card>

      {/* এককালীন cutover-টুল — Gate F-এর পরে অপ্রয়োজনীয় হয়ে যাবে, তাই ডিফল্ট ভাঁজ-করা (native <details>, অতিরিক্ত state ছাড়াই) */}
      <details className="group mt-3 overflow-hidden rounded-2xl border border-muted/10 bg-canvas shadow-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm text-muted [&::-webkit-details-marker]:hidden">
          <Upload aria-hidden size={19} className="shrink-0" />
          <span className="flex-1">Migration (temporary) · 7</span>
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
          </div>
          <div className="border-t border-muted/10">
            <Row icon={LandmarkIcon} label="Import GPF Entries (CSV)" onClick={() => setImportGpfOpen(true)} />
          </div>
          <div className="border-t border-muted/10">
            <Row icon={Upload} label="Fix Category Types (from history)" onClick={() => setFixCategoryTypesOpen(true)} />
          </div>
        </div>
      </details>

      <button type="button" onClick={() => void signOut()} className="mt-6 min-h-11 w-full text-center text-sm text-muted underline">
        Sign out
      </button>

      {appearanceOpen && (
        <Suspense fallback={<SkeletonLoader />}>
          <AppearanceScreen uid={user.uid} onClose={() => setAppearanceOpen(false)} />
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

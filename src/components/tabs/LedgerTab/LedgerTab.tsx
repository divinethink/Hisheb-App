import { useState } from 'react';
import {
  HandCoins,
  TrendingUp,
  PiggyBank,
  Landmark,
  Layers,
  Clock,
  ChevronRight,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';
import DebtsScreen from './DebtsScreen';
import InvestmentsScreen from './InvestmentsScreen';
import HomeDepositScreen from './HomeDepositScreen';
import GpfScreen from './GpfScreen';
import CustomDepositLedgerScreen from './CustomDepositLedgerScreen';
import CustomLedgerSheet from './CustomLedgerSheet';
import { useCustomLedgers, useDebts, useGpfEntries, useHomeDeposits, useInvestments } from '../../../hooks/useData';
import { repaymentStatus } from '../../../lib/debtCalc';
import { investmentStatus, sumRepayments as sumInvestmentRepayments } from '../../../lib/investmentCalc';
import { receivableTotalMinor, runningInvestmentTotalMinor } from '../../../lib/netWorthCalc';
import { netBalanceMinor } from '../../../lib/homeDepositCalc';
import { gpfBalanceAsOfMinor } from '../../../lib/gpfCalc';
import { dueItemsFrom, nearestDueItem } from '../../../lib/reminder';
import { toDhakaDate } from '../../../lib/date';
import { formatAmount } from '../../../lib/format';
import type { CustomLedger } from '../../../validation/customLedgerSchema';
import type { Debt } from '../../../validation/debtSchema';
import type { Investment } from '../../../validation/investmentSchema';
import type { HomeDepositEntry } from '../../../validation/homeDepositSchema';
import type { GpfEntry } from '../../../validation/gpfSchema';

type Module = 'debts' | 'investments' | 'homeDeposit' | 'gpf' | null;

const NO_DEBTS: Debt[] = [];
const NO_INV: Investment[] = [];
const NO_HD: HomeDepositEntry[] = [];
const NO_GPF: GpfEntry[] = [];

// P3-5: চারটা fixed মডিউল + owner-created custom ledger — সব নেট-ওয়ার্থে যোগ হয় (Mockup §৫)।
// UI Polish [1_5] ধাপ ৩: প্রতিটা মডিউল আলাদা bordered card, amount-subtitle, count-badge,
// due-soon chip (Debts), repayment progress (Investments), ও উপরে/নিচে total — pure presentation,
// কোনো নতুন Firestore query না (existing calc-ফাংশন ও reminder.ts due-date লজিক reuse)।
export default function LedgerTab({ uid }: { uid: string }) {
  const [open, setOpen] = useState<Module>(null);
  const [openCustom, setOpenCustom] = useState<CustomLedger | null>(null);
  const [addLedgerOpen, setAddLedgerOpen] = useState(false);
  const debts = useDebts(uid);
  const investments = useInvestments(uid);
  const homeDeposits = useHomeDeposits(uid);
  const gpf = useGpfEntries(uid);
  const customLedgers = useCustomLedgers(uid);
  const customList = customLedgers.state.status === 'ready' ? customLedgers.state.data : [];

  if (open === 'debts') return <DebtsScreen uid={uid} onBack={() => setOpen(null)} />;
  if (open === 'investments') return <InvestmentsScreen uid={uid} onBack={() => setOpen(null)} />;
  if (open === 'homeDeposit') return <HomeDepositScreen uid={uid} onBack={() => setOpen(null)} />;
  if (open === 'gpf') return <GpfScreen uid={uid} onBack={() => setOpen(null)} />;

  if (openCustom) {
    if (openCustom.kind === 'deposit' && openCustom.fundId) {
      return (
        <CustomDepositLedgerScreen
          uid={uid}
          fundId={openCustom.fundId}
          title={openCustom.name}
          onBack={() => setOpenCustom(null)}
        />
      );
    }
    return (
      <InvestmentsScreen uid={uid} onBack={() => setOpenCustom(null)} ledgerId={openCustom.id} title={openCustom.name} />
    );
  }

  const debtList = debts.state.status === 'ready' ? debts.state.data : NO_DEBTS;
  const invList = investments.state.status === 'ready' ? investments.state.data : NO_INV;
  const hdList = homeDeposits.state.status === 'ready' ? homeDeposits.state.data : NO_HD;
  const gpfList = gpf.state.status === 'ready' ? gpf.state.data : NO_GPF;
  const today = toDhakaDate(new Date());

  // "Ledger contributes to net worth" — Net Worth ট্যাবের একই চারটা লাইনের যোগফল (Accounts বাদে),
  // existing lib/*Calc ফাংশন reuse — নতুন query/aggregate না (§৩ item ১)।
  const receivable = receivableTotalMinor(debtList);
  const runningInv = runningInvestmentTotalMinor(invList);
  const homeNet = netBalanceMinor(hdList);
  const gpfBalance = gpfBalanceAsOfMinor(gpfList, today);
  const ledgerTotal = receivable + runningInv + homeNet + gpfBalance;

  // Debts: count-badge ("N active" = repaymentStatus≠paid) + due-soon chip (G2 reminder-লজিক reuse, §৩ item ৩)
  const debtActiveCount = debtList.filter((d) => repaymentStatus(d.totalAmountMinor, d.repayments) !== 'paid').length;
  const debtDue = nearestDueItem(dueItemsFrom(debtList, []), today);
  const debtChip = debtDue
    ? {
        danger: debtDue.days < 0,
        text:
          debtDue.days < 0
            ? `${debtDue.name} overdue ${Math.abs(debtDue.days)}d`
            : debtDue.days === 0
              ? `${debtDue.name} due today`
              : `${debtDue.name} due in ${debtDue.days}d`,
      }
    : null;

  // Investments: count-badge (running-এর সংখ্যা) + running investment-গুলোর aggregate repaid/principal % (§৩ item ৪)
  const runningInvestments = invList.filter((i) => investmentStatus(i.principalMinor, i.repayments) === 'running');
  const invRepaidSum = runningInvestments.reduce((s, i) => s + sumInvestmentRepayments(i.repayments), 0);
  const invPrincipalSum = runningInvestments.reduce((s, i) => s + i.principalMinor, 0);
  const invProgressPct = invPrincipalSum > 0 ? Math.min(100, Math.round((invRepaidSum / invPrincipalSum) * 100)) : null;

  return (
    <div className="h-full overflow-y-auto pb-24">
      <header className="flex items-center justify-between px-4 pb-2 pt-3">
        <h1 className="text-lg font-semibold text-fg">Ledger</h1>
        <button
          type="button"
          onClick={() => setAddLedgerOpen(true)}
          className="flex min-h-8 items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
        >
          <Plus aria-hidden size={14} />
          Add
        </button>
      </header>

      <ModuleCard
        icon={HandCoins}
        chart="--chart-4"
        label="Debts & Receivables"
        subtitle={`Outstanding: ${formatAmount(receivable)}`}
        badge={`${debtActiveCount} active`}
        chip={debtChip}
        onClick={() => setOpen('debts')}
      />
      <ModuleCard
        icon={TrendingUp}
        chart="--chart-2"
        label="Investments"
        subtitle={`Running: ${formatAmount(runningInv)}`}
        badge={`${runningInvestments.length} active`}
        progressPct={invProgressPct}
        onClick={() => setOpen('investments')}
      />
      <ModuleCard
        icon={PiggyBank}
        chart="--chart-6"
        label="Home Deposit"
        subtitle={`Current Net Balance: ${formatAmount(homeNet)}`}
        onClick={() => setOpen('homeDeposit')}
      />
      <ModuleCard
        icon={Landmark}
        chart="--chart-1"
        label="GPF"
        subtitle={`Current Balance: ${formatAmount(gpfBalance)}`}
        onClick={() => setOpen('gpf')}
      />

      {customList.map((l) => {
        const subtitle =
          l.kind === 'deposit'
            ? `Current Net Balance: ${formatAmount(netBalanceMinor(hdList.filter((e) => e.fundId === l.fundId)))}`
            : `Running: ${formatAmount(runningInvestmentTotalMinor(invList.filter((i) => i.ledgerId === l.id)))}`;
        return (
          <ModuleCard
            key={l.id}
            icon={l.kind === 'deposit' ? PiggyBank : TrendingUp}
            chart="--chart-3"
            label={l.name}
            subtitle={subtitle}
            onClick={() => setOpenCustom(l)}
          />
        );
      })}

      <Card className="mx-4 mb-3 flex items-center gap-3 p-4">
        <IconBadge icon={Layers} tone="primary" size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Ledger contributes to net worth</p>
          <p className="text-xl font-semibold text-fg">{formatAmount(ledgerTotal)}</p>
        </div>
      </Card>

      {addLedgerOpen && <CustomLedgerSheet uid={uid} onClose={() => setAddLedgerOpen(false)} />}
    </div>
  );
}

// একটা bordered module-card — hard-divider-list প্রতিস্থাপন করে (§৩ item ২)। icon-circle এখনো
// প্রতি-মডিউল `--chart-*` টোকেন ব্যবহার করে (আগে থেকেই বিদ্যমান, বৈচিত্র্যময় রঙ বজায় রাখতে IconBadge-এর
// সীমিত tone-list দিয়ে প্রতিস্থাপন করা হয়নি — শুধু সরাসরি "Ledger contributes" strip-এ IconBadge)।
function ModuleCard({
  icon: Icon,
  chart,
  label,
  subtitle,
  badge,
  chip,
  progressPct,
  onClick,
}: {
  icon: LucideIcon;
  chart: string;
  label: string;
  subtitle: string;
  badge?: string;
  chip?: { text: string; danger: boolean } | null;
  progressPct?: number | null;
  onClick: () => void;
}) {
  return (
    <Card className="mx-4 mb-3 overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `rgb(var(${chart}) / 0.16)`, color: `rgb(var(${chart}))` }}
        >
          <Icon aria-hidden size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-fg">{label}</span>
            {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{badge}</span>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
          {progressPct !== null && progressPct !== undefined && (
            <span aria-hidden className="mt-1.5 block h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted/15">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
            </span>
          )}
          {chip && (
            <span
              className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                chip.danger ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
              }`}
            >
              <Clock aria-hidden size={11} /> {chip.text}
            </span>
          )}
        </span>
        <ChevronRight aria-hidden size={18} className="mt-1 shrink-0 text-muted" />
      </button>
    </Card>
  );
}

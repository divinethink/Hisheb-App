import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import CollapsibleSection from '../../common/CollapsibleSection';
import CompanyLogo from '../../common/CompanyLogo';
import { SearchToggle, SearchPanel } from '../../common/ListSearch';
import InvestmentSheet from './InvestmentSheet';
import InvestmentDetailScreen from './InvestmentDetailScreen';
import CompanyDetailScreen from './CompanyDetailScreen';
import CompanyPickerScreen from './CompanyPickerScreen';
import { Building2 } from 'lucide-react';
import { formatAmount, formatTaka } from '../../../lib/format';
import { formatDisplayDate, isOverdue } from '../../../lib/date';
import {
  runningMinor,
  investmentStatus,
  profitMinor,
  sumRepayments,
  partitionInvestmentsForList,
  INVESTMENT_STATUS_LABEL,
} from '../../../lib/investmentCalc';
import { useInvestmentCompanies, useInvestments, useSettings } from '../../../hooks/useData';
import { stripRoundTag } from '../../../lib/investmentName';
import type { Investment } from '../../../validation/investmentSchema';

type InvFilter = 'all' | 'running' | 'doubtful';
const FILTER_CHIPS = [
  ['all', 'All'],
  ['running', 'Running'],
  ['doubtful', 'Doubtful'],
] as const;

export default function InvestmentsScreen({
  uid,
  onBack,
  ledgerId,
  title = 'Investments',
}: {
  uid: string;
  onBack: () => void;
  // owner-created customLedgers/{id} (kind='investment') দিয়ে filter — না দিলে সব দেখাবে (fixed module, অপরিবর্তিত)
  ledgerId?: string;
  title?: string;
}) {
  const investments = useInvestments(uid);
  const companies = useInvestmentCompanies(uid);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Investment | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [browseCompanies, setBrowseCompanies] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InvFilter>('all');
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  if (companyId) {
    return (
      <CompanyDetailScreen
        uid={uid}
        companyId={companyId}
        onBack={() => setCompanyId(null)}
        onOpenInvestment={(i) => {
          setCompanyId(null);
          setSelected(i);
        }}
      />
    );
  }
  if (browseCompanies) {
    return (
      <CompanyPickerScreen
        uid={uid}
        selectedId={null}
        onSelect={(c) => {
          setBrowseCompanies(false);
          setCompanyId(c.id);
        }}
        onClose={() => setBrowseCompanies(false)}
      />
    );
  }
  if (investments.state.status === 'ready' && selected) {
    const fresh = investments.state.data.find((i) => i.id === selected.id) ?? selected;
    return (
      <InvestmentDetailScreen
        uid={uid}
        investment={fresh}
        onBack={() => setSelected(null)}
        onOpenCompany={(id) => {
          setSelected(null);
          setCompanyId(id);
        }}
      />
    );
  }

  const all = investments.state.status === 'ready' ? investments.state.data : [];
  const scoped = ledgerId === undefined ? all : all.filter((i) => i.ledgerId === ledgerId);
  // সার্চ/ফিল্টার শুধু তালিকা ছাঁকে; Running Investment/Profit মোট পুরো scoped তালিকা থেকেই (হিসাব অপরিবর্তিত)
  const q = query.trim().toLowerCase();
  const searching = searchOpen && (q !== '' || filter !== 'all');
  const list = !searching
    ? scoped
    : scoped.filter(
        (i) => (!q || i.investedTo.toLowerCase().includes(q)) && (filter === 'all' || (i.investmentOutcome ?? 'running') === filter),
      );
  // Total Assets aggregate — শুধু written_off বাদ (Audit 2026-09-17, C9)
  const totalRunning = scoped
    .filter((i) => i.investmentOutcome !== 'written_off')
    .reduce((s, i) => s + runningMinor(i.principalMinor, i.repayments), 0);
  // ক্রম: Running ওপরে, Closed (রিপেমেন্ট শেষ) নিচে ভাঁজযোগ্য; দুই দলেই সর্বশেষ ইনভেস্টমেন্টের তারিখে নতুন আগে
  const { open, closed } = partitionInvestmentsForList(list);
  const totalProfit = scoped
    .filter((i) => investmentStatus(i.principalMinor, i.repayments) === 'closed')
    .reduce((s, i) => s + profitMinor(i.principalMinor, i.repayments), 0);

  const companyById = new Map((companies.state.status === 'ready' ? companies.state.data : []).map((c) => [c.id, c] as const));

  const renderRow = (i: Investment) => {
    const co = i.companyId ? companyById.get(i.companyId) : undefined;
    const status = investmentStatus(i.principalMinor, i.repayments);
    const running = runningMinor(i.principalMinor, i.repayments);
    const repaid = sumRepayments(i.repayments);
    const pct = i.principalMinor > 0 ? Math.min(100, Math.round((repaid / i.principalMinor) * 100)) : 0;
    // মেয়াদ পেরোনো + বাকি আছে → লাল "Due" (owner-approved ২০২৬-১০-২৫)
    const overdue = running > 0 && i.investmentOutcome !== 'written_off' && isOverdue(i.expectedRepaymentDate);
    const chipCls = status === 'closed' ? 'bg-income/10 text-income' : 'bg-primary/10 text-primary';
    return (
      <li key={i.id}>
        <button
          type="button"
          onClick={() => setSelected(i)}
          className="relative flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-2xl border border-muted/15 bg-surface px-3 py-2 text-left active:bg-muted/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <CompanyLogo name={stripRoundTag(co?.name ?? i.investedTo)} logo={co?.logo} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-fg">{i.investedTo}</span>
              <span className="shrink-0 text-sm font-semibold text-fg">{formatAmount(running)}</span>
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
              <span className="truncate">
                Principal {formatAmount(i.principalMinor)} · Repaid {formatAmount(repaid)}
                {overdue && i.expectedRepaymentDate && (
                  <span className="text-expense"> · Due {formatDisplayDate(i.expectedRepaymentDate, dateFormat)}</span>
                )}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-px ${chipCls}`}>{INVESTMENT_STATUS_LABEL[status]}</span>
            </span>
          </span>
          <span aria-hidden className="absolute inset-x-0 bottom-0 block h-[3px] bg-muted/15">
            <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
          </span>
        </button>
      </li>
    );
  };

  const footer =
    investments.state.status === 'ready' ? (
      <button type="button" onClick={() => setAddOpen(true)} className="min-h-12 flex-1 rounded-xl bg-primary text-sm font-medium text-canvas">
        + Add New
      </button>
    ) : undefined;

  return (
    <FullScreenPage
      title={title}
      onBack={onBack}
      footer={footer}
      actions={
        <>
          <button type="button" aria-label="Companies" onClick={() => setBrowseCompanies(true)} className="flex h-11 w-11 items-center justify-center text-muted">
            <Building2 aria-hidden size={18} />
          </button>
          <SearchToggle open={searchOpen} onToggle={() => setSearchOpen((o) => !o)} />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {searchOpen && (
          <SearchPanel query={query} onQuery={setQuery} placeholder="Search name" chips={FILTER_CHIPS} active={filter} onChip={setFilter} />
        )}

        {investments.state.status === 'loading' && <SkeletonLoader />}

        {investments.state.status === 'error' && (
          <div role="alert" className="rounded-lg bg-surface p-4 text-center">
            <p className="text-sm text-fg">Couldn’t load entries.</p>
            <button type="button" onClick={investments.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
              Retry
            </button>
          </div>
        )}

        {investments.state.status === 'ready' && (
          <>
            <div className="rounded-2xl bg-primary/10 p-4">
              <p className="text-xs text-muted">Running Investment</p>
              <p className="mt-1 text-2xl font-semibold text-fg">{formatAmount(totalRunning)}</p>
            </div>

            {list.length === 0 ? (
              <p className="py-10 text-center text-muted">{searching ? 'No match.' : 'No entries yet.'}</p>
            ) : (
              <>
                {open.length > 0 && <ul className="flex flex-col gap-2">{open.map(renderRow)}</ul>}
                {closed.length > 0 && (
                  <CollapsibleSection key={`c${searching}`} title="Closed (repaid)" count={closed.length} summary={`Profit ${formatTaka(totalProfit)}`} defaultOpen={searching}>
                    <ul className="flex flex-col gap-2">{closed.map(renderRow)}</ul>
                  </CollapsibleSection>
                )}
              </>
            )}
          </>
        )}
      </div>

      {addOpen && (
        <InvestmentSheet uid={uid} initial={null} ledgerId={ledgerId ?? null} onClose={() => setAddOpen(false)} />
      )}
    </FullScreenPage>
  );
}

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import StatStrip from '../../common/StatStrip';
import CompanyLogo from '../../common/CompanyLogo';
import CompanyFormScreen from './CompanyFormScreen';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { investmentStatus, profitMinor, INVESTMENT_STATUS_LABEL } from '../../../lib/investmentCalc';
import { companyTotals, entriesOfCompany, linkSuggestions } from '../../../lib/companyStats';
import { updateInvestment } from '../../../data/investmentRepo';
import { settleOrPending } from '../../../lib/async';
import { useInvestmentCompanies, useInvestments, useSettings } from '../../../hooks/useData';
import type { Investment } from '../../../validation/investmentSchema';

/** কোম্পানি = মাদার হেড: মোট Invested/Repaid/Profit(closed) + সব রাউন্ডের টাইমলাইন + পুরনো এন্ট্রি Link। রিনেম করলে এন্ট্রির investedTo বদলায় না। */
export default function CompanyDetailScreen({
  uid,
  companyId,
  onBack,
  onOpenInvestment,
}: {
  uid: string;
  companyId: string;
  onBack: () => void;
  onOpenInvestment: (i: Investment) => void;
}) {
  const companies = useInvestmentCompanies(uid);
  const investments = useInvestments(uid);
  const settings = useSettings(uid);
  const [editOpen, setEditOpen] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  const ready = companies.state.status === 'ready' && investments.state.status === 'ready';
  const company = companies.state.status === 'ready' ? companies.state.data.find((c) => c.id === companyId) : undefined;

  if (companies.state.status === 'error' || investments.state.status === 'error') {
    return (
      <FullScreenPage title="Company" onBack={onBack}>
        <div role="alert" className="rounded-lg bg-surface p-4 text-center">
          <p className="text-sm text-fg">Couldn’t load.</p>
          <button
            type="button"
            onClick={() => {
              companies.retry();
              investments.retry();
            }}
            className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas"
          >
            Retry
          </button>
        </div>
      </FullScreenPage>
    );
  }
  if (!ready) return <FullScreenPage title="Company" onBack={onBack}><p className="py-10 text-center text-muted">Loading…</p></FullScreenPage>;
  if (!company) {
    return (
      <FullScreenPage title="Company" onBack={onBack}>
        <p className="py-10 text-center text-muted">Company not found.</p>
      </FullScreenPage>
    );
  }

  if (editOpen && companies.state.status === 'ready') {
    return (
      <CompanyFormScreen
        uid={uid}
        initial={company}
        companies={companies.state.data}
        onClose={() => setEditOpen(false)}
        onSaved={() => setEditOpen(false)}
      />
    );
  }

  const all = investments.state.status === 'ready' ? investments.state.data : [];
  const entries = entriesOfCompany(all, company.id);
  const totals = companyTotals(entries);
  const suggestions = linkSuggestions(all, company.name);

  async function link(i: Investment) {
    if (linking) return;
    setLinking(i.id);
    setLinkError('');
    try {
      // শুধু companyId — নাম/Round/অন্য কিছু ছোঁয়া হয় না (zero data loss)
      await settleOrPending(updateInvestment(uid, i.id, { companyId }), 3000);
    } catch {
      setLinkError('Could not link. Check your connection and try again.');
    } finally {
      setLinking(null);
    }
  }

  return (
    <FullScreenPage
      title={company.name}
      onBack={onBack}
      actions={
        <button type="button" aria-label="Edit company" onClick={() => setEditOpen(true)} className="flex h-11 w-11 items-center justify-center text-muted">
          <Pencil aria-hidden size={18} />
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <CompanyLogo name={company.name} logo={company.logo} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold text-fg">{company.name}</p>
            <p className="text-sm text-muted">
              {[company.medium ? `Medium: ${company.medium}` : '', `${totals.rounds} ${totals.rounds === 1 ? 'round' : 'rounds'}`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <StatStrip
          items={[
            { label: 'Invested', value: formatAmount(totals.investedMinor) },
            { label: 'Repaid', value: formatAmount(totals.repaidMinor) },
            { label: 'Profit (closed)', value: `${totals.profitClosedMinor > 0 ? '+' : ''}${formatAmount(totals.profitClosedMinor)}` },
          ]}
        />

        <div>
          <p className="mb-2 text-sm text-muted">History</p>
          {entries.length === 0 ? (
            <p className="text-sm text-muted">No linked entries yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((i) => {
                const status = investmentStatus(i.principalMinor, i.repayments);
                const profit = profitMinor(i.principalMinor, i.repayments);
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => onOpenInvestment(i)}
                      className="flex min-h-14 w-full items-center justify-between gap-2 rounded-2xl border border-muted/15 bg-surface px-3 py-2 text-left active:bg-muted/10"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">{i.investedTo}</span>
                        <span className="block truncate text-xs text-muted">
                          {[formatDisplayDate(i.date, dateFormat), i.platformNo ? `#${i.platformNo}` : ''].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-fg">{formatAmount(i.principalMinor)}</span>
                        <span className={`mt-0.5 inline-block rounded-full px-2 py-px text-[11px] ${status === 'closed' ? 'bg-income/10 text-income' : 'bg-primary/10 text-primary'}`}>
                          {INVESTMENT_STATUS_LABEL[status]}
                          {status === 'closed' ? ` ${profit > 0 ? '+' : ''}${formatAmount(profit)}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {suggestions.length > 0 && (
          <div>
            <p className="mb-1 text-sm text-muted">Possible old entries</p>
            <p className="mb-2 text-xs text-muted">Same name start, not linked yet. Linking only adds the company tag — the name stays as is.</p>
            <ul className="flex flex-col gap-2">
              {suggestions.map((i) => (
                <li key={i.id} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-dashed border-muted/40 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-fg">{i.investedTo}</span>
                    <span className="block text-xs text-muted">
                      {formatDisplayDate(i.date, dateFormat)} · {formatAmount(i.principalMinor)}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={linking !== null}
                    onClick={() => void link(i)}
                    className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60"
                  >
                    {linking === i.id ? 'Linking…' : 'Link'}
                  </button>
                </li>
              ))}
            </ul>
            {linkError && (
              <p role="alert" className="mt-2 text-sm text-expense">
                {linkError}
              </p>
            )}
          </div>
        )}
      </div>
    </FullScreenPage>
  );
}

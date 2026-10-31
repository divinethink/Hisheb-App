import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import StatStrip from '../../common/StatStrip';
import CompanyLogo from '../../common/CompanyLogo';
import ContractLink from '../../common/ContractLink';
import DeleteEntryButton from '../../common/DeleteEntryButton';
import InvestmentRepaymentSheet from './InvestmentRepaymentSheet';
import InvestmentSheet from './InvestmentSheet';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate, isOverdue } from '../../../lib/date';
import { useInvestmentCompanies, useSettings } from '../../../hooks/useData';
import { stripRoundTag } from '../../../lib/investmentName';
import { runningMinor, investmentStatus, profitMinor, INVESTMENT_STATUS_LABEL } from '../../../lib/investmentCalc';
import { deleteInvestment, setInvestmentOutcome, setInvestmentRepayments, updateInvestment } from '../../../data/investmentRepo';
import { settleOrPending } from '../../../lib/async';
import { InvestmentOutcomeSchema, type Investment } from '../../../validation/investmentSchema';
import type { z } from 'zod';

type InvestmentOutcome = z.infer<typeof InvestmentOutcomeSchema>;
const OUTCOME_OPTIONS: readonly InvestmentOutcome[] = ['running', 'doubtful', 'written_off'];
const OUTCOME_LABEL: Record<InvestmentOutcome, string> = { running: 'Running', doubtful: 'Doubtful', written_off: 'Written-off' };

export default function InvestmentDetailScreen({
  uid,
  investment,
  onBack,
  onOpenCompany,
}: {
  uid: string;
  investment: Investment;
  onBack: () => void;
  onOpenCompany?: (companyId: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [editRepaymentIdx, setEditRepaymentIdx] = useState<number | null>(null);
  const settings = useSettings(uid);
  const companies = useInvestmentCompanies(uid);
  const company =
    investment.companyId && companies.state.status === 'ready' ? companies.state.data.find((c) => c.id === investment.companyId) : undefined;
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  const status = investmentStatus(investment.principalMinor, investment.repayments);
  const running = runningMinor(investment.principalMinor, investment.repayments);
  const profit = profitMinor(investment.principalMinor, investment.repayments);

  async function removeRepayment(idx: number) {
    const next = investment.repayments.filter((_, i) => i !== idx);
    await settleOrPending(setInvestmentRepayments(uid, investment.id, next), 3000).catch(() => {});
    setDeleteIdx(null);
  }

  if (editOpen) return <InvestmentSheet uid={uid} initial={investment} onClose={() => setEditOpen(false)} />;

  const repaid = investment.repayments.reduce((s, r) => s + r.amountMinor, 0);
  const written = investment.investmentOutcome === 'written_off';

  const footer = (
    <button type="button" onClick={() => setAddOpen(true)} className="min-h-12 flex-1 rounded-xl border border-dashed border-muted/60 text-sm text-fg">
      + Add Repayment
    </button>
  );

  return (
    <FullScreenPage
      title={investment.investedTo}
      onBack={onBack}
      footer={footer}
      actions={
        <DeleteEntryButton
          title="Delete this entry?"
          detail={`${investment.investedTo} · ${formatAmount(investment.principalMinor)}${investment.repayments.length ? ` — its ${investment.repayments.length} repayment(s) will be deleted too.` : ''}`}
          onDelete={async () => {
            await settleOrPending(deleteInvestment(uid, investment.id), 3000);
            onBack();
          }}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {company && onOpenCompany ? (
              <button type="button" aria-label={`Open ${company.name}`} onClick={() => onOpenCompany(company.id)} className="shrink-0 rounded-xl active:opacity-70">
                <CompanyLogo name={stripRoundTag(company.name)} logo={company.logo} size="md" />
              </button>
            ) : (
              <CompanyLogo name={stripRoundTag(company?.name ?? investment.investedTo)} logo={company?.logo} size="md" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-muted">Principal{investment.duration ? ` · ${investment.duration}` : ''}</p>
              <p className="text-lg font-semibold text-fg">{formatAmount(investment.principalMinor)}</p>
              {company && onOpenCompany && (
                <button type="button" onClick={() => onOpenCompany(company.id)} className="min-h-8 truncate text-xs font-medium text-primary underline">
                  {company.name} →
                </button>
              )}
              {(investment.medium || investment.platformNo) && (
                <p className="truncate text-xs text-muted">
                  {[investment.medium, investment.platformNo ? `#${investment.platformNo}` : ''].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          <button type="button" aria-label="Edit" onClick={() => setEditOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-muted/40 text-muted">
            <Pencil aria-hidden size={18} />
          </button>
        </div>

        {/* এক সারির কার্ড (owner-approved ২০২৬-১০-২৫) */}
        <StatStrip
          items={[
            { label: 'Status', value: INVESTMENT_STATUS_LABEL[status] },
            {
              label: 'Expected date',
              value: (
                <>
                  <span className={isOverdue(investment.expectedRepaymentDate) && running > 0 && !written ? 'text-expense' : ''}>
                    {investment.expectedRepaymentDate ? formatDisplayDate(investment.expectedRepaymentDate, dateFormat) : '— 📅'}
                  </span>
                  <input
                    type="date"
                    lang="en-GB"
                    aria-label="Expected Repayment Date (optional)"
                    value={investment.expectedRepaymentDate ?? ''}
                    onChange={(e) => void updateInvestment(uid, investment.id, { expectedRepaymentDate: e.target.value || null })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </>
              ),
            },
          ]}
        />

        {investment.contractFileId && (
          <div>
            <p className="mb-1 text-sm text-muted">Contract (PDF)</p>
            <ContractLink fileId={investment.contractFileId} name={investment.contractName} />
          </div>
        )}

        <div>
          <p className="mb-1 text-sm text-muted">Outcome</p>
          <div className="flex gap-2">
            {OUTCOME_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => void setInvestmentOutcome(uid, investment.id, o)}
                aria-pressed={investment.investmentOutcome === o}
                className={`min-h-11 flex-1 rounded-lg border text-sm ${investment.investmentOutcome === o ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`}
              >
                {OUTCOME_LABEL[o]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted">Repayment History</p>
            <button type="button" onClick={() => setAddOpen(true)} className="min-h-8 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary">
              + Add
            </button>
          </div>
          {investment.repayments.length === 0 ? (
            <p className="text-sm text-muted">No repayments yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {investment.repayments.map((r, i) => (
                <li key={`${r.date}-${i}`} className="flex min-h-12 items-center justify-between rounded-xl border border-muted/15 bg-surface px-3 py-1.5">
                  <span className="flex flex-col text-sm text-fg">
                    {formatDisplayDate(r.date, dateFormat)}
                    {r.note && <span className="text-xs text-muted">{r.note}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-fg">{formatAmount(r.amountMinor)}</span>
                    {deleteIdx === i ? (
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => void removeRepayment(i)} className="min-h-8 rounded border border-expense px-2 text-xs text-expense">
                          Delete
                        </button>
                        <button type="button" onClick={() => setDeleteIdx(null)} className="min-h-8 rounded border border-muted/40 px-2 text-xs text-muted">
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <button type="button" aria-label="Edit repayment" onClick={() => setEditRepaymentIdx(i)} className="flex h-8 w-8 items-center justify-center text-muted">
                          <Pencil aria-hidden size={16} />
                        </button>
                        <button type="button" aria-label="Delete repayment" onClick={() => setDeleteIdx(i)} className="flex h-8 w-8 items-center justify-center text-muted">
                          <X aria-hidden size={16} />
                        </button>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* এক সারির সারাংশ: Principal · Repaid · Running (closed হলে Running-এর জায়গায় Profit) */}
        <StatStrip
          items={[
            { label: 'Principal', value: formatAmount(investment.principalMinor) },
            { label: 'Repaid', value: formatAmount(repaid) },
            !written && status === 'closed'
              ? { label: 'Profit', value: formatAmount(profit) }
              : { label: 'Running', value: formatAmount(running) },
          ]}
        />
        {written && running > 0 && (
          <p className="flex justify-between text-sm">
            <span className="text-muted">Realized Loss (personal record)</span>
            <span className="font-medium text-fg">{formatAmount(running)}</span>
          </p>
        )}
      </div>

      {addOpen && <InvestmentRepaymentSheet uid={uid} investment={investment} onClose={() => setAddOpen(false)} />}
      {editRepaymentIdx !== null && (
        <InvestmentRepaymentSheet uid={uid} investment={investment} editIndex={editRepaymentIdx} onClose={() => setEditRepaymentIdx(null)} />
      )}
    </FullScreenPage>
  );
}

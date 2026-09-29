import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import InvestmentRepaymentSheet from './InvestmentRepaymentSheet';
import InvestmentSheet from './InvestmentSheet';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { useSettings } from '../../../hooks/useData';
import { runningMinor, investmentStatus, profitMinor, INVESTMENT_STATUS_LABEL } from '../../../lib/investmentCalc';
import { setInvestmentOutcome, setInvestmentRepayments, updateInvestment } from '../../../data/investmentRepo';
import { settleOrPending } from '../../../lib/async';
import { InvestmentOutcomeSchema, type Investment } from '../../../validation/investmentSchema';
import type { z } from 'zod';

type InvestmentOutcome = z.infer<typeof InvestmentOutcomeSchema>;
const OUTCOME_OPTIONS: readonly InvestmentOutcome[] = ['running', 'doubtful', 'written_off'];
const OUTCOME_LABEL: Record<InvestmentOutcome, string> = { running: 'Running', doubtful: 'Doubtful', written_off: 'Written-off' };

export default function InvestmentDetailScreen({ uid, investment, onBack }: { uid: string; investment: Investment; onBack: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [editRepaymentIdx, setEditRepaymentIdx] = useState<number | null>(null);
  const settings = useSettings(uid);
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

  return (
    <FullScreenPage title={investment.investedTo} onBack={onBack}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Principal{investment.duration ? ` · ${investment.duration}` : ''}</p>
            <p className="text-lg font-semibold text-fg">{formatAmount(investment.principalMinor)}</p>
          </div>
          <button type="button" onClick={() => setEditOpen(true)} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm">
            Edit
          </button>
        </div>

        <p className="text-sm text-muted">
          Status: <span className="text-fg">{INVESTMENT_STATUS_LABEL[status]}</span>
        </p>

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
          <label htmlFor="inv-exp-date" className="mb-1 block text-sm text-muted">
            Expected Repayment Date (optional)
          </label>
          <input
            id="inv-exp-date"
            type="date"
            lang="en-GB"
            value={investment.expectedRepaymentDate ?? ''}
            onChange={(e) => void updateInvestment(uid, investment.id, { expectedRepaymentDate: e.target.value || null })}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-muted">Repayment History</p>
          {investment.repayments.length === 0 ? (
            <p className="text-sm text-muted">No repayments yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {investment.repayments.map((r, i) => (
                <li key={`${r.date}-${i}`} className="flex items-center justify-between border-b border-muted/20 py-2">
                  <span className="flex flex-col text-sm text-fg">
                    {formatDisplayDate(r.date, dateFormat)}
                    {r.note && <span className="text-xs text-muted">{r.note}</span>}
                  </span>
                  <span className="flex items-center gap-3">
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
          <p className="mt-3 flex justify-between text-sm">
            <span className="text-muted">Running (Remaining Principal)</span>
            <span className="font-medium text-fg">{formatAmount(running)}</span>
          </p>
          {investment.investmentOutcome === 'written_off' ? (
            running > 0 && (
              <p className="mt-1 flex justify-between text-sm">
                <span className="text-muted">Realized Loss (personal record)</span>
                <span className="font-medium text-fg">{formatAmount(running)}</span>
              </p>
            )
          ) : (
            status === 'closed' && (
              <p className="mt-1 flex justify-between text-sm">
                <span className="text-muted">Profit</span>
                <span className="font-medium text-fg">{formatAmount(profit)}</span>
              </p>
            )
          )}
        </div>

        <button type="button" onClick={() => setAddOpen(true)} className="min-h-11 rounded-lg border border-dashed border-muted/60 text-sm text-muted">
          + Add Repayment
        </button>
      </div>

      {addOpen && <InvestmentRepaymentSheet uid={uid} investment={investment} onClose={() => setAddOpen(false)} />}
      {editRepaymentIdx !== null && (
        <InvestmentRepaymentSheet uid={uid} investment={investment} editIndex={editRepaymentIdx} onClose={() => setEditRepaymentIdx(null)} />
      )}
    </FullScreenPage>
  );
}

import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import InvestmentSheet from './InvestmentSheet';
import InvestmentDetailScreen from './InvestmentDetailScreen';
import { formatAmount } from '../../../lib/format';
import { runningMinor, investmentStatus, profitMinor, sumRepayments, INVESTMENT_STATUS_LABEL } from '../../../lib/investmentCalc';
import { useInvestments } from '../../../hooks/useData';
import type { Investment } from '../../../validation/investmentSchema';

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
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Investment | null>(null);

  if (investments.state.status === 'ready' && selected) {
    const fresh = investments.state.data.find((i) => i.id === selected.id) ?? selected;
    return <InvestmentDetailScreen uid={uid} investment={fresh} onBack={() => setSelected(null)} />;
  }

  const all = investments.state.status === 'ready' ? investments.state.data : [];
  const list = ledgerId === undefined ? all : all.filter((i) => i.ledgerId === ledgerId);
  // Total Assets aggregate — শুধু written_off বাদ (Audit 2026-09-17, C9)
  const totalRunning = list
    .filter((i) => i.investmentOutcome !== 'written_off')
    .reduce((s, i) => s + runningMinor(i.principalMinor, i.repayments), 0);
  const totalProfit = list
    .filter((i) => investmentStatus(i.principalMinor, i.repayments) === 'closed')
    .reduce((s, i) => s + profitMinor(i.principalMinor, i.repayments), 0);

  return (
    <FullScreenPage title={title} onBack={onBack}>
      <div className="flex flex-col gap-4">
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
            {list.length === 0 ? (
              <p className="py-10 text-center text-muted">No entries yet.</p>
            ) : (
              <ul>
                {list.map((i) => {
                  const status = investmentStatus(i.principalMinor, i.repayments);
                  const running = runningMinor(i.principalMinor, i.repayments);
                  return (
                    <li key={i.id} className="border-b border-muted/20">
                      <button
                        type="button"
                        onClick={() => setSelected(i)}
                        className="flex min-h-16 w-full flex-col gap-0.5 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="flex items-center justify-between">
                          <span className="text-fg">{i.investedTo}</span>
                          <span className="font-medium text-fg">{formatAmount(running)}</span>
                        </span>
                        <span className="text-xs text-muted">
                          Principal: {formatAmount(i.principalMinor)}
                        </span>
                        <span className="text-xs text-muted">
                          Repaid so far: {formatAmount(sumRepayments(i.repayments))} · {INVESTMENT_STATUS_LABEL[status]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="flex justify-between border-t border-muted/20 pt-3 text-sm">
              <span className="text-muted">Running Investment</span>
              <span className="font-medium text-fg">{formatAmount(totalRunning)}</span>
            </p>
            <p className="flex justify-between text-sm">
              <span className="text-muted">Total Profit (from closed, personal record)</span>
              <span className="font-medium text-fg">{formatAmount(totalProfit)}</span>
            </p>

            <button type="button" onClick={() => setAddOpen(true)} className="min-h-11 rounded-lg bg-primary text-sm font-medium text-canvas">
              + Add New
            </button>
          </>
        )}
      </div>

      {addOpen && (
        <InvestmentSheet uid={uid} initial={null} ledgerId={ledgerId ?? null} onClose={() => setAddOpen(false)} />
      )}
    </FullScreenPage>
  );
}

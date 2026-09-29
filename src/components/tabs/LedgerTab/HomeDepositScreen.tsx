import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import FundSheet from './FundSheet';
import FundDetailScreen from './FundDetailScreen';
import { formatAmount } from '../../../lib/format';
import { netBalanceMinor } from '../../../lib/homeDepositCalc';
import { useFunds, useHomeDeposits } from '../../../hooks/useData';
import type { Fund } from '../../../validation/homeDepositSchema';

export default function HomeDepositScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const funds = useFunds(uid);
  const entries = useHomeDeposits(uid);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Fund | null>(null);

  const loading = funds.state.status === 'loading' || entries.state.status === 'loading';
  const errored = funds.state.status === 'error' || entries.state.status === 'error';
  const fundList = funds.state.status === 'ready' ? funds.state.data : [];
  const entryList = entries.state.status === 'ready' ? entries.state.data : [];

  if (selected) {
    const fresh = fundList.find((f) => f.id === selected.id) ?? selected;
    return (
      <FundDetailScreen
        uid={uid}
        fund={fresh}
        entries={entryList.filter((e) => e.fundId === fresh.id)}
        onBack={() => setSelected(null)}
      />
    );
  }

  const combined = netBalanceMinor(entryList);

  return (
    <FullScreenPage title="Home Deposit" onBack={onBack}>
      <div className="flex flex-col gap-4">
        {loading && <SkeletonLoader />}

        {errored && (
          <div role="alert" className="rounded-lg bg-surface p-4 text-center">
            <p className="text-sm text-fg">Couldn’t load entries.</p>
            <button type="button" onClick={() => { funds.retry(); entries.retry(); }} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
              Retry
            </button>
          </div>
        )}

        {!loading && !errored && (
          <>
            {fundList.length === 0 ? (
              <p className="py-10 text-center text-muted">No funds yet — add your first one.</p>
            ) : (
              <ul>
                {fundList.map((f) => {
                  const net = netBalanceMinor(entryList.filter((e) => e.fundId === f.id));
                  return (
                    <li key={f.id} className="border-b border-muted/20">
                      <button
                        type="button"
                        onClick={() => setSelected(f)}
                        className="flex min-h-16 w-full items-center justify-between py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="text-fg">{f.name}</span>
                        <span className="font-medium text-fg">{formatAmount(net)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="flex justify-between border-t border-muted/20 pt-3 text-sm">
              <span className="text-muted">Combined Current Net Balance</span>
              <span className="font-medium text-fg">{formatAmount(combined)}</span>
            </p>

            <button type="button" onClick={() => setAddOpen(true)} className="min-h-11 rounded-lg bg-primary text-sm font-medium text-canvas">
              + Add New Fund
            </button>
          </>
        )}
      </div>

      {addOpen && <FundSheet uid={uid} initial={null} onClose={() => setAddOpen(false)} />}
    </FullScreenPage>
  );
}

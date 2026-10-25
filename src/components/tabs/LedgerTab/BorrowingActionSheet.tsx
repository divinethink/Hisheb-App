// প্রতিটা Borrowing-কার্ডে ট্যাপ করলে খোলা অপশন-শিট (owner-approved ২০২৬-১০-২৫):
// Mark fully repaid (একবার confirm) · Add repayment · Status · Edit · Delete।
// কার্ডের ভেতরের বাটন সরে আসায় ধার বাড়লেও বিস্তারিত স্ক্রিন ছোট থাকে। হিসাব/data-layer অপরিবর্তিত।
import { useState, type ReactNode } from 'react';
import { ChevronRight, CheckCircle2, Plus, CircleDot, Pencil, Trash2 } from 'lucide-react';
import BottomSheet from '../../common/BottomSheet';
import { formatAmount } from '../../../lib/format';
import { type LineStatus, type LineView } from '../../../lib/debtCalc';
import { setBorrowingStatus } from '../../../data/debtRepo';
import { settleOrPending } from '../../../lib/async';
import type { Debt } from '../../../validation/debtSchema';

export const LINE_STATUS_LABEL: Record<LineStatus, string> = { active: 'Active', doubtful: 'Doubtful', written_off: 'Written-off' };
const STATUS_OPTIONS: readonly LineStatus[] = ['active', 'doubtful', 'written_off'];

type Mode = 'menu' | 'status' | 'confirmRepaid' | 'confirmDelete';

function Option({ icon, label, hint, tone, onClick }: { icon: ReactNode; label: string; hint?: string; tone?: 'primary' | 'danger'; onClick: () => void }) {
  const color = tone === 'primary' ? 'text-primary' : tone === 'danger' ? 'text-expense' : 'text-fg';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl border border-muted/20 bg-surface px-3 text-left text-sm ${color}`}
    >
      <span aria-hidden className="flex w-5 justify-center">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      <ChevronRight aria-hidden size={16} className="text-muted" />
    </button>
  );
}

export default function BorrowingActionSheet({
  uid,
  debt,
  view,
  onClose,
  onMarkRepaid,
  onAddRepayment,
  onEdit,
  onDelete,
}: {
  uid: string;
  debt: Debt;
  view: LineView;
  onClose: () => void;
  /** পুরো বাকি শোধ সেভ; ব্যর্থ হলে throw */
  onMarkRepaid: () => Promise<void>;
  onAddRepayment: () => void;
  onEdit: () => void;
  /** undefined = শেষ borrowing, মোছা যাবে না */
  onDelete?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owe = debt.direction === 'owe_me';
  const canRepay = view.outstandingMinor > 0;

  async function run(op: () => Promise<void>) {
    if (busy) return; // double-tap-এ duplicate নয়
    setBusy(true);
    setError('');
    try {
      await op();
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setBusy(false);
    }
  }

  const footer =
    mode === 'menu' ? (
      <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-muted/40 px-4 text-sm">
        Close
      </button>
    ) : (
      <button type="button" disabled={busy} onClick={() => setMode('menu')} className="min-h-11 flex-1 rounded-lg border border-muted/40 px-4 text-sm disabled:opacity-60">
        Back
      </button>
    );

  return (
    <BottomSheet title={`${formatAmount(view.line.amountMinor)} borrowing`} onRequestClose={onClose} footer={footer}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Paid {formatAmount(view.paidMinor)} · Outstanding {formatAmount(view.outstandingMinor)}
        </p>

        {mode === 'menu' && (
          <div className="flex flex-col gap-2">
            {canRepay && <Option icon={<CheckCircle2 size={18} />} label="Mark fully repaid" tone="primary" onClick={() => setMode('confirmRepaid')} />}
            {canRepay && <Option icon={<Plus size={18} />} label="Add repayment" onClick={onAddRepayment} />}
            {owe && <Option icon={<CircleDot size={18} />} label="Status" hint={LINE_STATUS_LABEL[view.status]} onClick={() => setMode('status')} />}
            <Option icon={<Pencil size={16} />} label="Edit borrowing" onClick={onEdit} />
            {onDelete && <Option icon={<Trash2 size={16} />} label="Delete" tone="danger" onClick={() => setMode('confirmDelete')} />}
          </div>
        )}

        {mode === 'status' && owe && (
          <div>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  aria-pressed={view.status === s}
                  onClick={() => void run(async () => {
                      await settleOrPending(setBorrowingStatus(uid, debt, view.index, s), 3000);
                    })}
                  className={`min-h-11 flex-1 rounded-lg border text-sm ${view.status === s ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`}
                >
                  {LINE_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Written-off: the unpaid part is excluded from Net Worth. Payment history stays.</p>
          </div>
        )}

        {mode === 'confirmRepaid' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-fg">The remaining {formatAmount(view.outstandingMinor)} will be saved as fully repaid.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(onMarkRepaid)}
              className="min-h-11 rounded-lg bg-primary px-3 text-sm font-medium text-canvas disabled:opacity-60"
            >
              {busy ? 'Saving…' : `Confirm · ${formatAmount(view.outstandingMinor)} repaid`}
            </button>
          </div>
        )}

        {mode === 'confirmDelete' && onDelete && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-fg">Delete this borrowing? This cannot be undone.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(onDelete)}
              className="min-h-11 rounded-lg border border-expense px-3 text-sm font-medium text-expense disabled:opacity-60"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

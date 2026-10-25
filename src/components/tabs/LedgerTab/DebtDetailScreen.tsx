import { useState } from 'react';
import { X, Pencil, ChevronRight } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import StatStrip from '../../common/StatStrip';
import RepaymentSheet from './RepaymentSheet';
import BorrowingSheet from './BorrowingSheet';
import DebtSheet from './DebtSheet';
import BorrowingActionSheet, { LINE_STATUS_LABEL } from './BorrowingActionSheet';
import { formatAmount } from '../../../lib/format';
import { formatDisplayDate, toDhakaDate } from '../../../lib/date';
import { useSettings } from '../../../hooks/useData';
import { lineViews, repaymentStatus, sumRepayments, REPAYMENT_STATUS_LABEL, type LineView } from '../../../lib/debtCalc';
import { setRepayments, setBorrowings, updateDebt } from '../../../data/debtRepo';
import { settleOrPending } from '../../../lib/async';
import type { Debt } from '../../../validation/debtSchema';

export default function DebtDetailScreen({ uid, debt, onBack }: { uid: string; debt: Debt; onBack: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [editRepaymentIdx, setEditRepaymentIdx] = useState<number | null>(null);
  const [addBorrowOpen, setAddBorrowOpen] = useState(false);
  const [editBorrowIdx, setEditBorrowIdx] = useState<number | null>(null);
  const [actionIdx, setActionIdx] = useState<number | null>(null);
  const [repayPreset, setRepayPreset] = useState<string | undefined>(undefined);
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  const status = repaymentStatus(debt.totalAmountMinor, debt.repayments);
  const views = lineViews(debt);
  const owe = debt.direction === 'owe_me';
  const outstanding = views.reduce((s, v) => s + v.outstandingMinor, 0);
  const writtenOff = views.filter((v) => v.excluded).reduce((s, v) => s + v.outstandingMinor, 0);
  const statusSummary = (['doubtful', 'written_off'] as const)
    .map((k) => [k, views.filter((v) => v.status === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${LINE_STATUS_LABEL[k]} ${n}`)
    .join(' · ');

  async function removeRepayment(idx: number) {
    const next = debt.repayments.filter((_, i) => i !== idx);
    await settleOrPending(setRepayments(uid, debt.id, next), 3000).catch(() => {});
    setDeleteIdx(null);
  }

  // অন্তত একটা borrowing থাকা বাধ্যতামূলক — নাহলে totalAmountMinor 0 হয়ে rules-এর posInt() reject করবে
  async function removeBorrowing(idx: number) {
    if (debt.borrowings.length <= 1) return;
    const next = debt.borrowings.filter((_, i) => i !== idx);
    await settleOrPending(setBorrowings(uid, debt.id, next), 3000);
  }

  // পুরো বাকি শোধ; confirm ও busy-গার্ড অপশন-শিটে। ব্যর্থ হলে throw → শিট error দেখায়
  async function markRepaid(v: LineView) {
    if (v.outstandingMinor <= 0) return;
    const link = v.line.id ? { borrowingId: v.line.id } : {};
    await settleOrPending(
      setRepayments(uid, debt.id, [...debt.repayments, { date: toDhakaDate(new Date()), amountMinor: v.outstandingMinor, note: '', ...link }]),
      3000,
    );
  }

  if (editOpen) return <DebtSheet uid={uid} initial={debt} onClose={() => setEditOpen(false)} />;

  const pctOf = (v: LineView) => (v.line.amountMinor > 0 ? Math.min(100, Math.round((v.paidMinor / v.line.amountMinor) * 100)) : 0);

  return (
    <FullScreenPage title={debt.person} onBack={onBack}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Total</p>
            <p className="text-lg font-semibold text-fg">{formatAmount(debt.totalAmountMinor)}</p>
          </div>
          <button type="button" onClick={() => setEditOpen(true)} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm">
            Edit
          </button>
        </div>

        {/* এক সারির কার্ড (owner-approved ২০২৬-১০-২৫): Status · Receivable · Expected date */}
        <StatStrip
          items={[
            { label: 'Repayment', value: REPAYMENT_STATUS_LABEL[status] },
            ...(owe ? [{ label: 'Receivable', value: statusSummary || 'All Active', tone: writtenOff > 0 ? ('danger' as const) : ('default' as const) }] : []),
            {
              label: 'Expected date',
              value: (
                <>
                  <span>{debt.expectedRepaymentDate ? formatDisplayDate(debt.expectedRepaymentDate, dateFormat) : '— 📅'}</span>
                  {/* স্বচ্ছ native date-input কোষ জুড়ে: ট্যাপে picker খোলে, Clear-ও picker থেকেই */}
                  <input
                    type="date"
                    lang="en-GB"
                    aria-label="Expected Repayment Date (optional)"
                    value={debt.expectedRepaymentDate ?? ''}
                    onChange={(e) => void updateDebt(uid, debt.id, { expectedRepaymentDate: e.target.value || null })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </>
              ),
            },
          ]}
        />

        <div>
          <p className="mb-2 text-sm text-muted">Borrowing History</p>
          <ul className="flex flex-col gap-2">
            {debt.borrowings.map((b, i) => {
              const v = views[i];
              if (!v) return null;
              return (
                <li key={`${b.id ?? b.date}-${i}`}>
                  <button
                    type="button"
                    onClick={() => setActionIdx(i)}
                    aria-label={`Borrowing ${formatDisplayDate(b.date, dateFormat)} options`}
                    className={`relative flex min-h-14 w-full items-center gap-2 overflow-hidden rounded-2xl border border-muted/15 bg-surface px-3 py-2 text-left active:bg-muted/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${v.excluded ? 'opacity-80' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2 text-sm text-fg">
                        <span>{formatDisplayDate(b.date, dateFormat)}</span>
                        <span className="font-medium">{formatAmount(b.amountMinor)}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="rounded-full bg-muted/10 px-2 py-px text-muted">{REPAYMENT_STATUS_LABEL[v.payStatus]}</span>
                        {owe && v.status !== 'active' && (
                          <span className="rounded-full bg-expense/10 px-2 py-px text-expense">{LINE_STATUS_LABEL[v.status]}</span>
                        )}
                        <span className="text-muted">
                          {formatAmount(v.paidMinor)} / {formatAmount(b.amountMinor)}
                        </span>
                        {b.note && <span className="truncate text-muted">· {b.note}</span>}
                      </span>
                    </span>
                    <ChevronRight aria-hidden size={16} className="shrink-0 text-muted" />
                    <span aria-hidden className="absolute inset-x-0 bottom-0 block h-[3px] bg-muted/15">
                      <span className="block h-full bg-primary" style={{ width: `${pctOf(v)}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setAddBorrowOpen(true)} className="mt-2 min-h-11 w-full rounded-lg border border-dashed border-muted/60 text-sm text-muted">
            + Add Borrowing
          </button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted">Repayment History</p>
            <button
              type="button"
              onClick={() => {
                setRepayPreset(undefined);
                setAddOpen(true);
              }}
              className="min-h-8 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary"
            >
              + Add
            </button>
          </div>
          {debt.repayments.length === 0 ? (
            <p className="text-sm text-muted">No repayments yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {debt.repayments.map((r, i) => (
                <li key={`${r.date}-${i}`} className="flex min-h-12 items-center justify-between rounded-xl border border-muted/15 bg-surface px-3 py-1.5">
                  <span className="flex flex-col text-sm text-fg">
                    {formatDisplayDate(r.date, dateFormat)}
                    {r.borrowingId && debt.borrowings.length > 1 && (
                      <span className="text-xs text-muted">
                        → {formatDisplayDate(debt.borrowings.find((b) => b.id === r.borrowingId)?.date ?? debt.date, dateFormat)} borrowing
                      </span>
                    )}
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

        {/* এক সারির সারাংশ কার্ড: Outstanding · Written-off · Receivable (Net Worth) */}
        <StatStrip
          items={[
            { label: 'Outstanding', value: formatAmount(outstanding) },
            ...(owe && writtenOff > 0
              ? [
                  { label: 'Written-off', value: `− ${formatAmount(writtenOff)}` },
                  { label: 'Receivable (NW)', value: formatAmount(outstanding - writtenOff) },
                ]
              : []),
          ]}
        />
        {sumRepayments(debt.repayments) > debt.totalAmountMinor && (
          <p className="text-sm text-muted">Total paid exceeds the original amount — please confirm.</p>
        )}
      </div>

      {addOpen && (
        <RepaymentSheet
          uid={uid}
          debt={debt}
          presetBorrowingId={repayPreset}
          onClose={() => {
            setAddOpen(false);
            setRepayPreset(undefined);
          }}
        />
      )}
      {actionIdx !== null && views[actionIdx] && (
        <BorrowingActionSheet
          uid={uid}
          debt={debt}
          view={views[actionIdx]}
          onClose={() => setActionIdx(null)}
          onMarkRepaid={() => markRepaid(views[actionIdx])}
          onAddRepayment={() => {
            setRepayPreset(debt.borrowings[actionIdx]?.id);
            setActionIdx(null);
            setAddOpen(true);
          }}
          onEdit={() => {
            setEditBorrowIdx(actionIdx);
            setActionIdx(null);
          }}
          onDelete={debt.borrowings.length > 1 ? () => removeBorrowing(actionIdx) : undefined}
        />
      )}
      {editRepaymentIdx !== null && (
        <RepaymentSheet uid={uid} debt={debt} editIndex={editRepaymentIdx} onClose={() => setEditRepaymentIdx(null)} />
      )}
      {addBorrowOpen && <BorrowingSheet uid={uid} debt={debt} onClose={() => setAddBorrowOpen(false)} />}
      {editBorrowIdx !== null && (
        <BorrowingSheet uid={uid} debt={debt} editIndex={editBorrowIdx} onClose={() => setEditBorrowIdx(null)} />
      )}
    </FullScreenPage>
  );
}

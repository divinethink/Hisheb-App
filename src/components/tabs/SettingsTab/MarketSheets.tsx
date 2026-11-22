// বাজার দরের ফর্ম-শিট: দাম বসানো (+ শেষ ৫ ইতিহাস), আইটেম যোগ/এডিট, গ্রুপ যোগ/এডিট।
import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Pencil } from 'lucide-react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput from '../../common/AmountInput';
import DateInput from '../../common/DateInput';
import { resolveAmountMinor } from '../../../lib/money';
import { formatDisplayDate, toDhakaDate } from '../../../lib/date';
import { formatTaka } from '../../../lib/format';
import { nextOrder, perUnitMinor, priceRange, sortByOrder, swapTarget } from '../../../lib/marketCalc';
import { settleOrPending } from '../../../lib/async';
import {
  addMarketGroup,
  addMarketItem,
  recordMarketPrice,
  swapMarketOrder,
  updateMarketGroup,
  updateMarketItem,
} from '../../../data/marketRepo';
import type { MarketGroup, MarketItem } from '../../../validation/marketSchema';

const inputCls = 'min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none focus:border-primary';
const UNITS = ['কেজি', 'ডজন', 'লিটার', 'পিস', 'প্যাক', 'গ্রাম'];
const EMOJIS = ['🌶️', '🥩', '🐟', '🥦', '🧴', '👶', '🍎', '🥛', '🧼', '🛒'];

function Footer({ onClose, onSave, saving, label = 'Save' }: { onClose: () => void; onSave: () => void; saving: boolean; label?: string }) {
  return (
    <>
      <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm disabled:opacity-60">
        Cancel
      </button>
      <button type="button" onClick={onSave} disabled={saving} className="min-h-11 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60">
        {saving ? 'Saving…' : label}
      </button>
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return text ? (
    <p role="alert" className="text-sm text-expense">
      {text}
    </p>
  ) : null;
}

/** ↑ দাম বেড়েছে (লাল), ↓ কমেছে (সবুজ) — রঙের পাশে চিহ্নও। */
export function Delta({ diffMinor, compact = false }: { diffMinor: number; compact?: boolean }) {
  if (diffMinor === 0) return <span className="text-xs text-muted">no change</span>;
  const up = diffMinor > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${up ? 'text-expense' : 'text-income'}`}>
      <Icon aria-hidden size={12} />
      {compact ? formatTaka(Math.abs(diffMinor)) : `${up ? '+' : '−'}${formatTaka(Math.abs(diffMinor))}`}
    </span>
  );
}

/** দাম বসানো — নিচে শেষ ৫টা দামের তুলনা। */
export function PriceSheet({
  uid,
  item,
  dateFormat,
  onEdit,
  onClose,
}: {
  uid: string;
  item: MarketItem;
  dateFormat: 'dmy' | 'mdy';
  onEdit: () => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toDhakaDate(new Date()));
  const [note, setNote] = useState(item.history[0]?.note ?? '');
  const last = item.history[0];
  const [qty, setQty] = useState(last?.qty != null ? String(last.qty) : '');
  const [unit, setUnit] = useState(last?.unit || item.unit);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const parsed = resolveAmountMinor(amount);
  const range = priceRange(item.history);
  const qtyNum = qty.trim() === '' ? null : Number(qty.replace(/,/g, '.'));
  const qtyBad = qtyNum !== null && !(Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum <= 1_000_000);

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (!date || parsed === null || qtyBad) return;
    setSaving(true);
    setError('');
    try {
      await settleOrPending(
        recordMarketPrice(uid, item, { date, priceMinor: parsed, note: note.trim(), qty: qtyNum, unit: unit.trim() }),
        3000,
      );
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  return (
    <BottomSheet title={item.name} onRequestClose={onClose} footer={<Footer onClose={onClose} onSave={() => void save()} saving={saving} label="Save price" />}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-primary/5 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">Current price</p>
            {last ? (
              <>
                <p className="text-xl font-semibold tabular-nums text-fg">{formatTaka(last.priceMinor)}</p>
                <p className="text-xs text-muted">
                  {last.qty != null ? `${last.qty} ${last.unit} · ` : ''}
                  {formatDisplayDate(last.date, dateFormat)}
                </p>
              </>
            ) : (
              <p className="text-base text-muted">No price yet</p>
            )}
          </div>
          <button type="button" onClick={onEdit} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-primary/30 px-3 text-sm text-primary">
            <Pencil aria-hidden size={14} /> Edit item
          </button>
        </div>
        <AmountInput value={amount} onChange={setAmount} showError={submitted} card autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Quantity (optional)" htmlFor="mk-qty">
            <input
              id="mk-qty"
              inputMode="decimal"
              value={qty}
              maxLength={10}
              placeholder="e.g. 0.5 or 500"
              aria-invalid={submitted && qtyBad}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9.,]/g, ''))}
              className={inputCls}
            />
          </Field>
          <Field label="Unit" htmlFor="mk-pu">
            <input id="mk-pu" value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="-mx-1 -mt-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {UNITS.map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm ${unit === u ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-transparent bg-muted/10 text-muted'}`}>
              {u}
            </button>
          ))}
        </div>
        {submitted && qtyBad && <ErrorLine text="Quantity must be a positive number." />}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date" htmlFor="mk-date">
            <DateInput uid={uid} id="mk-date" value={date} onChange={setDate} invalid={submitted && !date} variant="tall" />
          </Field>
          <Field label="Note (optional)" htmlFor="mk-note">
            <input id="mk-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <ErrorLine text={error} />

        <section aria-label="Last 5 prices" className="rounded-2xl border border-muted/10 bg-surface p-3">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-medium text-fg">Last {Math.max(item.history.length, 1)} price{item.history.length === 1 ? '' : 's'}</h3>
            {range && (
              <span className="text-xs text-muted">
                Low {formatTaka(range.lowMinor)} · High {formatTaka(range.highMinor)}
              </span>
            )}
          </div>
          {item.history.length === 0 ? (
            <p className="py-2 text-sm text-muted">Save a price to start the history.</p>
          ) : (
            <ul className="divide-y divide-muted/10">
              {item.history.map((h, i) => {
                const prev = item.history[i + 1];
                return (
                  <li key={h.date} className="flex min-h-11 items-center gap-3 py-1.5">
                    <span className="w-[4.5rem] shrink-0 text-xs text-muted">{formatDisplayDate(h.date, dateFormat)}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block tabular-nums ${i === 0 ? 'font-semibold text-fg' : 'text-fg'}`}>{formatTaka(h.priceMinor)}</span>
                      {h.qty != null && (
                        <span className="block text-[11px] text-muted">
                          {h.qty} {h.unit}
                          {h.qty !== 1 && ` · ${formatTaka(perUnitMinor(h))}/${h.unit || 'unit'}`}
                        </span>
                      )}
                    </span>
                    {prev ? <Delta diffMinor={h.priceMinor - prev.priceMinor} /> : <span className="text-xs text-muted">first</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </BottomSheet>
  );
}

function MoveArchive({
  onMove,
  canUp,
  canDown,
  onArchive,
  busy,
  archiveLabel,
}: {
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
  onArchive: () => void;
  busy: boolean;
  archiveLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-muted/10 pt-4">
      <div className="flex gap-2">
        <button type="button" disabled={!canUp || busy} onClick={() => onMove(-1)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-muted/40 text-sm disabled:opacity-40">
          <ArrowUp aria-hidden size={16} /> Move up
        </button>
        <button type="button" disabled={!canDown || busy} onClick={() => onMove(1)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-muted/40 text-sm disabled:opacity-40">
          <ArrowDown aria-hidden size={16} /> Move down
        </button>
      </div>
      <button type="button" disabled={busy} onClick={onArchive} className="min-h-11 rounded-lg border border-expense/40 text-sm text-expense disabled:opacity-40">
        {archiveLabel}
      </button>
      <p className="text-xs text-muted">Nothing is deleted — archived entries keep their price history and can be restored.</p>
    </div>
  );
}

/** আইটেম যোগ বা নাম/একক/গ্রুপ বদল। */
export function ItemSheet({
  uid,
  item,
  groupId,
  groups,
  siblings,
  onClose,
}: {
  uid: string;
  item?: MarketItem;
  groupId: string;
  groups: MarketGroup[];
  /** একই গ্রুপের সক্রিয় আইটেম (ক্রম/নতুন-order-এর জন্য) */
  siblings: MarketItem[];
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'কেজি');
  const [gid, setGid] = useState(item?.groupId ?? groupId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sorted = sortByOrder(siblings);

  async function save() {
    if (saving) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (item) {
        await settleOrPending(updateMarketItem(uid, item.id, { name, unit, groupId: gid }), 3000);
      } else {
        await settleOrPending(addMarketItem(uid, { groupId: gid, name, unit, order: nextOrder(siblings) }), 3000);
      }
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  async function run(fn: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await settleOrPending(fn(), 3000);
      onClose();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <BottomSheet title={item ? 'Edit item' : 'Add item'} onRequestClose={onClose} footer={<Footer onClose={onClose} onSave={() => void save()} saving={saving} />}>
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="mk-name">
          <input id="mk-name" value={name} maxLength={60} autoFocus={!item} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Default unit" htmlFor="mk-unit">
          <input id="mk-unit" value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
          <div className="mt-2 flex flex-wrap gap-2">
            {UNITS.map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm ${unit === u ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-transparent bg-muted/10 text-muted'}`}>
                {u}
              </button>
            ))}
          </div>
        </Field>
        {item && (
          <Field label="Group" htmlFor="mk-group">
            <select id="mk-group" value={gid} onChange={(e) => setGid(e.target.value)} className={inputCls}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <ErrorLine text={error} />
        {item && (
          <MoveArchive
            busy={saving}
            canUp={!!swapTarget(sorted, item.id, -1)}
            canDown={!!swapTarget(sorted, item.id, 1)}
            onMove={(dir) => {
              const t = swapTarget(sorted, item.id, dir);
              if (t) void run(() => swapMarketOrder(uid, 'item', t[0], t[1]));
            }}
            onArchive={() => void run(() => updateMarketItem(uid, item.id, { archived: true }))}
            archiveLabel="Archive this item"
          />
        )}
      </div>
    </BottomSheet>
  );
}

/** গ্রুপ যোগ বা নাম/আইকন বদল। */
export function GroupSheet({ uid, group, groups, onClose }: { uid: string; group?: MarketGroup; groups: MarketGroup[]; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? '');
  const [icon, setIcon] = useState(group?.icon ?? '🛒');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sorted = sortByOrder(groups);

  async function save() {
    if (saving) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (group) await settleOrPending(updateMarketGroup(uid, group.id, { name, icon: icon.trim() || null }), 3000);
      else await settleOrPending(addMarketGroup(uid, { name, icon: icon.trim() || null, order: nextOrder(groups) }), 3000);
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  async function run(fn: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await settleOrPending(fn(), 3000);
      onClose();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <BottomSheet title={group ? 'Edit group' : 'Add group'} onRequestClose={onClose} footer={<Footer onClose={onClose} onSave={() => void save()} saving={saving} />}>
      <div className="flex flex-col gap-4">
        <Field label="Group name" htmlFor="mk-gname">
          <input id="mk-gname" value={name} maxLength={60} autoFocus={!group} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Icon (emoji)" htmlFor="mk-gicon">
          <input id="mk-gicon" value={icon} maxLength={12} onChange={(e) => setIcon(e.target.value)} className={inputCls} />
          <div className="mt-2 flex flex-wrap gap-2">
            {EMOJIS.map((em) => (
              <button key={em} type="button" aria-pressed={icon === em} onClick={() => setIcon(em)} className={`flex h-10 w-10 items-center justify-center rounded-full border text-xl ${icon === em ? 'border-primary bg-primary/10' : 'border-muted/40'}`}>
                {em}
              </button>
            ))}
          </div>
        </Field>
        <ErrorLine text={error} />
        {group && (
          <MoveArchive
            busy={saving}
            canUp={!!swapTarget(sorted, group.id, -1)}
            canDown={!!swapTarget(sorted, group.id, 1)}
            onMove={(dir) => {
              const t = swapTarget(sorted, group.id, dir);
              if (t) void run(() => swapMarketOrder(uid, 'group', t[0], t[1]));
            }}
            onArchive={() => void run(() => updateMarketGroup(uid, group.id, { archived: true }))}
            archiveLabel="Archive this group"
          />
        )}
      </div>
    </BottomSheet>
  );
}

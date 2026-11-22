import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import BottomSheet from '../../common/BottomSheet';
import DateInput from '../../common/DateInput';
import { addTransactionsBatch, BASKET_MAX, newTransactionId } from '../../../data/transactionRepo';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { evaluateExpression, hasOperator } from '../../../lib/calculator';
import { formatTaka } from '../../../lib/format';
import { resolveAmountMinor } from '../../../lib/money';
import { isValidDate, occurredAtFor } from '../../../lib/date';
import { settleOrPending } from '../../../lib/async';
import { getCategoryIcon } from '../../../lib/categoryIcons';
import type { Category, Label } from '../../../validation/catalogSchemas';

type Type = 'income' | 'expense';
export interface BasketCat {
  id: string;
  name: string;
}
interface Row {
  key: string; // transaction doc-id (আগে থেকেই ঠিক — retry-তে duplicate হয় না)
  cat: BasketCat;
  amount: string;
  note: string;
  labelIds: string[];
  open: boolean;
}

const mk = (uid: string, cat: BasketCat): Row => ({ key: newTransactionId(uid), cat, amount: '', note: '', labelIds: [], open: false });

/** একাধিক category বেছে একসাথে দাম বসিয়ে "Save all"। প্রতিটা সারি আলাদা, স্বাধীন transaction হিসেবে সেভ হয়
 *  (schema/rules/Budget/Overview/CSV অপরিবর্তিত)। */
export default function BasketSheet({
  uid,
  type,
  initialCats,
  categories,
  labels,
  initialDate,
  onBack,
  onSaved,
}: {
  uid: string;
  type: Type;
  initialCats: BasketCat[];
  categories: Category[];
  labels: Label[];
  initialDate: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => initialCats.map((c) => mk(uid, c)));
  const [date, setDate] = useState(initialDate);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const dirty = rows.some((r) => r.amount !== '' || r.note !== '' || r.labelIds.length > 0);
  useEffect(() => {
    if (!dirty) return;
    markDirty();
    return () => markClean();
  }, [dirty]);

  // শুরুতে প্রথম সারিতে ফোকাস — কীবোর্ড সাথে সাথে খোলে
  useEffect(() => {
    const first = rows[0];
    if (first) inputs.current[first.key]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = useMemo(() => rows.map((r) => resolveAmountMinor(r.amount)), [rows]);
  const total = parsed.reduce<number>((s, v) => s + (v ?? 0), 0);
  const filled = parsed.filter((v) => v !== null).length;
  const sign = type === 'income' ? '+' : '−';
  const tone = type === 'income' ? 'text-income' : 'text-expense';

  const remaining = categories.filter(
    (c) => (!c.type || c.type === type) && !rows.some((r) => r.cat.id === c.id),
  );

  function patch(key: string, p: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }
  function remove(key: string) {
    setRows((cur) => cur.filter((r) => r.key !== key));
  }
  function addCat(c: Category) {
    if (rows.length >= BASKET_MAX) return;
    const row = mk(uid, { id: c.id, name: c.name });
    setRows((cur) => [...cur, row]);
    setAdding(false);
    setTimeout(() => inputs.current[row.key]?.focus(), 50);
  }
  function requestBack() {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onBack();
  }

  async function saveAll() {
    if (saving) return;
    setSubmitted(true);
    setError('');
    if (rows.length === 0 || !isValidDate(date)) return;
    // কোনো সারিতে amount অবৈধ/ফাঁকা থাকলে সেভ আটকায়, সেই সারি লাল দেখায়
    if (parsed.some((v) => v === null)) return;
    setSaving(true);
    try {
      const base = new Date(occurredAtFor(date)).getTime();
      const items = rows.map((r, i) => {
        const labelObjs = labels.filter((l) => r.labelIds.includes(l.id));
        return {
          id: r.key,
          input: {
            date,
            type,
            amountMinor: parsed[i] as number,
            currency: 'BDT',
            categoryId: r.cat.id,
            categoryName: r.cat.name,
            labelIds: labelObjs.map((l) => l.id),
            labelNames: labelObjs.map((l) => l.name),
            note: r.note.trim(),
            occurredAt: new Date(base + i), // সারির ক্রম বজায় রাখতে ১ms ব্যবধান
            importKey: null,
          },
        };
      });
      await settleOrPending(addTransactionsBatch(uid, items), 3000); // অফলাইনে লোকাল ক্যাশে জমা হয়
      onSaved();
    } catch {
      setError('Could not save. Check your connection and try again — nothing was saved.');
      setSaving(false);
    }
  }

  const footer = confirmDiscard ? (
    <>
      <p className="flex-1 self-center text-sm">Discard these amounts?</p>
      <button type="button" onClick={() => setConfirmDiscard(false)} className="min-h-11 rounded-xl border border-muted/40 px-4 text-sm">
        Keep editing
      </button>
      <button type="button" onClick={onBack} className="min-h-11 rounded-xl bg-expense px-4 text-sm font-medium text-canvas">
        Discard
      </button>
    </>
  ) : (
    <>
      <div className="min-w-0 shrink-0 self-center">
        <p className="text-[11px] uppercase tracking-wide text-muted">Total</p>
        <p className={`text-lg font-semibold tabular-nums ${tone}`}>
          {sign}
          {formatTaka(total)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void saveAll()}
        disabled={saving || rows.length === 0}
        className="min-h-12 flex-1 rounded-2xl bg-primary px-4 text-base font-semibold text-canvas shadow-md shadow-primary/25 active:scale-[0.99] disabled:opacity-60"
      >
        {saving ? 'Saving…' : `Save all (${rows.length})`}
      </button>
    </>
  );

  return (
    <BottomSheet title="Add multiple" onRequestClose={requestBack} footer={footer}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={requestBack}
            className="min-h-11 rounded-full border border-muted/40 bg-surface px-3 text-sm text-fg"
          >
            ← Categories
          </button>
          <div className="w-40">
            <DateInput uid={uid} id="basket-date" value={date} onChange={setDate} invalid={submitted && !isValidDate(date)} />
          </div>
        </div>

        {/* সারাংশ কার্ড */}
        <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
          <div>
            <p className="text-xs text-muted">
              {filled} of {rows.length} priced
            </p>
            <p className={`text-2xl font-semibold tabular-nums ${tone}`}>
              {sign}
              {formatTaka(total)}
            </p>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${rows.length ? (filled / rows.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <ul className="flex flex-col gap-2.5">
          {rows.map((r, i) => {
            const cat = categories.find((c) => c.id === r.cat.id);
            const icon = cat?.icon ?? getCategoryIcon(r.cat.name, type);
            const bad = submitted && parsed[i] === null;
            const expr = hasOperator(r.amount);
            const evald = expr ? evaluateExpression(r.amount) : null;
            return (
              <li
                key={r.key}
                className={`rounded-2xl border bg-surface p-3 shadow-sm ${bad ? 'border-expense' : 'border-muted/20'}`}
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.cat.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg ${tone}`} aria-hidden="true">
                        {sign}
                      </span>
                      <input
                        ref={(el) => {
                          inputs.current[r.key] = el;
                        }}
                        aria-label={`Amount for ${r.cat.name}`}
                        inputMode="decimal"
                        enterKeyHint={i === rows.length - 1 ? 'done' : 'next'}
                        autoComplete="off"
                        placeholder="0"
                        value={r.amount}
                        onChange={(e) =>
                          patch(r.key, { amount: e.target.value.replace(/,/g, '.').replace(/[^0-9.+]/g, '') })
                        }
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          const next = rows[i + 1];
                          if (next) inputs.current[next.key]?.focus();
                          else (e.target as HTMLInputElement).blur();
                        }}
                        className="w-full min-w-0 bg-transparent text-xl font-semibold tabular-nums outline-none placeholder:text-muted/50"
                      />
                      <button
                        type="button"
                        aria-label={`Add another amount to ${r.cat.name}`}
                        onPointerDown={(e) => e.preventDefault()} // কীবোর্ড বন্ধ হওয়া ঠেকায়
                        onClick={() => {
                          if (r.amount === '' || r.amount.endsWith('+')) return;
                          patch(r.key, { amount: `${r.amount}+` });
                          inputs.current[r.key]?.focus();
                        }}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-lg font-semibold text-primary active:bg-primary/20"
                      >
                        +
                      </button>
                      <span className="text-xs text-muted">BDT</span>
                    </div>
                    {expr && evald && <p className="text-xs text-muted">= {evald}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-center">
                    <button
                      type="button"
                      aria-label={`Remove ${r.cat.name}`}
                      onClick={() => remove(r.key)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-muted/15"
                    >
                      <X size={18} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={r.open ? 'Hide details' : 'Show details'}
                      aria-expanded={r.open}
                      onClick={() => patch(r.key, { open: !r.open })}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-muted/15"
                    >
                      <ChevronDown size={18} aria-hidden className={r.open ? 'rotate-180 transition' : 'transition'} />
                    </button>
                  </div>
                </div>
                {bad && (
                  <p role="alert" className="mt-1 text-sm text-expense">
                    Enter an amount greater than 0.
                  </p>
                )}
                {r.open && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-muted/15 pt-3">
                    <input
                      aria-label={`Note for ${r.cat.name}`}
                      placeholder="Note (optional)"
                      value={r.note}
                      maxLength={200}
                      onChange={(e) => patch(r.key, { note: e.target.value })}
                      className="min-h-11 w-full rounded-xl border border-muted/30 bg-canvas px-3 text-sm"
                    />
                    {labels.length > 0 && (
                      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                        {labels.map((l) => {
                          const on = r.labelIds.includes(l.id);
                          return (
                            <button
                              key={l.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                patch(r.key, { labelIds: on ? r.labelIds.filter((x) => x !== l.id) : [...r.labelIds, l.id] })
                              }
                              className={`min-h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs ${
                                on ? 'border-primary bg-primary text-canvas' : 'border-muted/40 bg-canvas text-fg'
                              }`}
                            >
                              {l.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {rows.length === 0 && <p className="py-6 text-center text-sm text-muted">No categories left. Add one below.</p>}

        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          disabled={rows.length >= BASKET_MAX || remaining.length === 0}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 text-sm font-medium text-primary disabled:opacity-50"
        >
          <Plus size={18} aria-hidden /> Add another category
        </button>

        {adding && (
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 rounded-2xl bg-surface p-3">
            {remaining.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addCat(c)}
                className="flex min-h-11 flex-col items-center gap-1"
              >
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full border border-muted/30 bg-canvas text-xl">
                  {c.icon ?? getCategoryIcon(c.name, type)}
                </span>
                <span className="line-clamp-2 max-w-[4.5rem] text-center text-xs">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
        {submitted && !isValidDate(date) && (
          <p role="alert" className="text-sm text-expense">
            Pick a valid date.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

// সিলেকশন-মোডের টাইল-চেক (TransactionSheet-এ ব্যবহৃত)
export function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-canvas shadow"
    >
      <Check size={12} />
    </span>
  );
}

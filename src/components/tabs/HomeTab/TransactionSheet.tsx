import { useEffect, useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput, { AmountKeypad } from '../../common/AmountInput';
import DateInput from '../../common/DateInput';
import CatalogEntryForm from '../../common/CatalogEntryForm';
import { addTransaction, newTransactionId, updateTransaction } from '../../../data/transactionRepo';
import { addCategory, addLabel } from '../../../data/catalogRepo';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { minorToInput, parseAmountToMinor } from '../../../lib/money';
import { evaluateExpression, hasOperator } from '../../../lib/calculator';
import { isValidDate, occurredAtFor, toDhakaDate } from '../../../lib/date';
import { settleOrPending } from '../../../lib/async';
import { getCategoryIcon } from '../../../lib/categoryIcons';
import { useSettings } from '../../../hooks/useData';
import type { Transaction } from '../../../validation/transactionSchema';
import type { Category, Label } from '../../../validation/catalogSchemas';

type Type = 'income' | 'expense';
interface Ref {
  id: string;
  name: string;
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-7 shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        selected ? 'border-primary bg-primary text-canvas' : 'border-muted/40 bg-surface text-fg'
      }`}
    >
      {children}
    </button>
  );
}

// Spendee-স্টাইল আইকন-সার্কেল গ্রিড টাইল (Category-র জন্য; Labels আগের pill-style-ই থাকে)
function CategoryTile({
  icon,
  name,
  selected,
  onClick,
}: {
  icon: string;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex min-h-11 flex-col items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span
        aria-hidden="true"
        className={`flex h-14 w-14 items-center justify-center rounded-full border text-2xl ${
          selected ? 'border-primary bg-primary/10' : 'border-muted/40 bg-surface'
        }`}
      >
        {icon}
      </span>
      <span className="line-clamp-2 max-w-[4.5rem] text-center text-xs text-fg">{name}</span>
    </button>
  );
}

/** "+ New X" বাটন — ট্যাপে shared CatalogEntryForm (name+color+icon) খোলে, Manage Categories/
 * Labels-এর "+ Create New"-এর সাথে হুবহু একই component/UX (owner-request, ২০২৬-০৯-২৬)। */
function QuickAddButton({ label, onOpen, compact = false }: { label: string; onOpen: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-full border border-dashed border-muted/60 text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        compact ? 'min-h-7 whitespace-nowrap px-2.5 py-0.5 text-[11px]' : 'min-h-11 px-4 text-sm'
      }`}
    >
      + New {label}
    </button>
  );
}

export default function TransactionSheet({
  uid,
  initial,
  categories,
  labels,
  onClose,
  onDelete,
}: {
  uid: string;
  initial: Transaction | null;
  categories: Category[];
  labels: Label[];
  onClose: () => void;
  /** থাকলে edit mode-এ একটা Delete অপশন দেখায় (soft-delete, §৩)। */
  onDelete?: () => Promise<void>;
}) {
  const [newId] = useState(() => (initial ? initial.id : newTransactionId(uid)));
  const [type, setType] = useState<Type>(initial?.type ?? 'expense');
  const [amountStr, setAmountStr] = useState(initial ? minorToInput(initial.amountMinor) : '');
  const [date, setDate] = useState(initial?.date ?? toDhakaDate(new Date()));
  const [category, setCategory] = useState<Ref | null>(
    initial ? { id: initial.categoryId, name: initial.categoryName } : null,
  );
  const [selLabels, setSelLabels] = useState<Ref[]>(
    initial ? initial.labelIds.map((id, i) => ({ id, name: initial.labelNames[i] ?? '' })) : [],
  );
  const [note, setNote] = useState(initial?.note ?? '');
  // Spendee-স্টাইল category-first flow (owner-request, ২০২৬-০৯-২৬): নতুন transaction-এ প্রথমে
  // category বাছতে হয়, তারপর amount+keypad ধাপ আসে। Edit mode-এ category আগে থেকেই সেট থাকে
  // বলে সরাসরি 'details' ধাপ থেকে শুরু হয়, existing flow ভাঙে না।
  const [step, setStep] = useState<'category' | 'details'>(category ? 'details' : 'category');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingLabel, setAddingLabel] = useState(false);
  const settings = useSettings(uid);
  const largeThreshold = settings.state.status === 'ready' ? settings.state.data.largeAmountWarningThresholdMinor : null;
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';

  const dirty = initial
    ? type !== initial.type ||
      amountStr !== minorToInput(initial.amountMinor) ||
      date !== initial.date ||
      category?.id !== initial.categoryId ||
      note !== initial.note ||
      selLabels.map((l) => l.id).join() !== initial.labelIds.join()
    : amountStr !== '' || note !== '' || category !== null || selLabels.length > 0;

  // আন-সেভড ফর্ম থাকলে PWA auto-reload স্কিপ হয়
  useEffect(() => {
    if (!dirty) return;
    markDirty();
    return () => markClean();
  }, [dirty]);

  const visibleCats = categories.filter((c) => !c.type || c.type === type);
  const catChips: Array<Ref & { icon: string | null }> = visibleCats.map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  if (category && !catChips.some((c) => c.id === category.id)) catChips.unshift({ ...category, icon: null });
  const lblChips: Ref[] = labels.map((l) => ({ id: l.id, name: l.name }));
  for (const l of selLabels) if (!lblChips.some((x) => x.id === l.id)) lblChips.push(l);

  function changeType(t: Type) {
    setType(t);
    const cur = categories.find((c) => c.id === category?.id);
    if (cur?.type && cur.type !== t) setCategory(null);
  }
  function requestClose() {
    if (saving || deleting) return;
    if (confirmDelete) {
      setConfirmDelete(false);
      return;
    }
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  async function save() {
    if (saving) return; // double-tap guard (id-ও stable, তাই duplicate হয় না)
    setSubmitted(true);
    setError('');
    // Keypad আর নিজে থেকে "commit" হয় না (সবসময় নিচে খোলা থাকে) — তাই Save-এর সময়ই এখানে
    // এক্সপ্রেশন (থাকলে) চূড়ান্ত সংখ্যায় রূপান্তরিত হয়, owner আলাদা করে "=" না চাপলেও চলে।
    const finalAmount = hasOperator(amountStr) ? (evaluateExpression(amountStr) ?? amountStr) : amountStr;
    const minor = parseAmountToMinor(finalAmount);
    if (minor === null || !category || !isValidDate(date)) return;
    setSaving(true);
    try {
      const base = {
        date,
        type,
        amountMinor: minor,
        currency: initial?.currency ?? 'BDT',
        categoryId: category.id,
        categoryName: category.name,
        labelIds: selLabels.map((l) => l.id),
        labelNames: selLabels.map((l) => l.name),
        note: note.trim(),
      };
      const write = initial
        ? updateTransaction(uid, initial.id, base)
        : addTransaction(uid, newId, { ...base, occurredAt: occurredAtFor(date), importKey: null });
      await settleOrPending(write, 3000); // অফলাইনে লোকাল ক্যাশে জমা হয়ে এগিয়ে যায়
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  async function runDelete() {
    if (!onDelete || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete();
    } catch {
      setError('Could not delete. Check your connection and try again.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const footer = confirmDelete ? (
    <>
      <p className="flex-1 self-center text-sm">Delete this transaction?</p>
      <button
        type="button"
        onClick={() => setConfirmDelete(false)}
        disabled={deleting}
        className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void runDelete()}
        disabled={deleting}
        className="min-h-11 rounded-lg bg-expense px-4 text-sm font-medium text-canvas disabled:opacity-60"
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
    </>
  ) : confirmDiscard ? (
    <>
      <p className="flex-1 self-center text-sm">Discard changes?</p>
      <button type="button" onClick={() => setConfirmDiscard(false)} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm">
        Keep editing
      </button>
      <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-expense px-4 text-sm font-medium text-canvas">
        Discard
      </button>
    </>
  ) : step === 'category' ? (
    <button type="button" onClick={requestClose} className="min-h-11 w-full rounded-lg border border-muted/40 text-base">
      Cancel
    </button>
  ) : (
    <>
      <button type="button" onClick={requestClose} className="min-h-11 flex-1 rounded-lg border border-muted/40 text-base">
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="min-h-11 flex-1 rounded-lg bg-primary text-base font-medium text-canvas disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </>
  );

  return (
    <BottomSheet title={initial ? 'Edit transaction' : 'Add transaction'} onRequestClose={requestClose} footer={footer}>
      {/* Spendee layout (owner-request, ২০২৬-০৯-২৬): category-ধাপ ও details-ধাপ এখন সম্পূর্ণ
          আলাদা sub-screen — category-ধাপে শুধু Type toggle + category grid দেখায় (Amount/Date/
          Note/Labels এখানে অপ্রাসঙ্গিক ও কার্যকরও না, তাই hide — owner-request, compactness pass)।
          category বাছার সাথে সাথেই details-ধাপে চলে যায়, তখন pill+Amount+Date/Note+Labels+keypad
          দেখা যায়। উভয় ধাপই sheet-এর পুরো height (h-full, flex-1 grid/keypad) ব্যবহার করে যাতে
          এক-পেজেই যতটা সম্ভব fit করে — grid নিজেই flex-1+internal-scroll, বাইরের header/quick-add
          সবসময় দৃশ্যমান থাকে। */}
      {step === 'category' ? (
        <div className="flex h-full flex-col gap-3">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => changeType(t)}
                className={`min-h-11 rounded-lg border text-base capitalize ${
                  type === t ? 'border-primary bg-primary text-canvas' : 'border-muted/40 bg-surface text-fg'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div role="group" aria-labelledby="cat-h" className="flex flex-1 min-h-0 flex-col">
            <h3 id="cat-h" className="mb-1 shrink-0 text-sm text-muted">Select category</h3>
            <div className="grid flex-1 min-h-0 auto-rows-min grid-cols-4 gap-x-2 gap-y-2 overflow-y-auto">
              {catChips.map((c) => (
                <CategoryTile
                  key={c.id}
                  icon={c.icon ?? getCategoryIcon(c.name, type)}
                  name={c.name}
                  selected={category?.id === c.id}
                  onClick={() => {
                    setCategory(c);
                    setStep('details');
                  }}
                />
              ))}
            </div>
            <div className="mt-2 shrink-0">
              <QuickAddButton label="Category" onOpen={() => setAddingCategory(true)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-2">
          <button
            type="button"
            onClick={() => setStep('category')}
            className="flex items-center gap-2 self-start rounded-full border border-muted/40 bg-surface px-3 py-1.5 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span aria-hidden="true" className="text-lg">
              {category ? categories.find((c) => c.id === category.id)?.icon ?? getCategoryIcon(category.name, type) : '🗂️'}
            </span>
            <span>{category ? category.name : 'Select category'}</span>
            {category && <span className="text-muted" aria-hidden="true">✎</span>}
          </button>
          {submitted && !category && (
            <p role="alert" className="text-sm text-expense">Choose a category.</p>
          )}

          <AmountInput value={amountStr} showError={submitted} type={type} largeAmountThresholdMinor={largeThreshold} />

          {/* owner-request (২০২৬-০৯-২৭): Labels ও Date/Note কম্প্যাক্ট + Labels আরো উপরে (Amount-এর
              ঠিক পরে) — যাতে expression-preview লাইন এলেও নিচের flex-1 AmountKeypad-এর উচ্চতা কম না
              পড়ে, keypad কখনো squeeze/fold না হয়। heading ছোট (text-xs) ও margin কমানো হয়েছে;
              chip/input-এর নিজস্ব min-h-11 টাচ-টার্গেট অপরিবর্তিত (Roadmap §৮ item ৩)। */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="date" className="mb-0.5 block text-xs text-muted">Date</label>
              <DateInput id="date" value={date} onChange={setDate} dateFormat={dateFormat} invalid={submitted && !isValidDate(date)} />
              {submitted && !isValidDate(date) && (
                <p role="alert" className="mt-1 text-sm text-expense">Pick a valid date.</p>
              )}
            </div>

            <div>
              <label htmlFor="note" className="mb-0.5 block text-xs text-muted">Note (optional)</label>
              <input
                id="note"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg"
              />
            </div>
          </div>

          <div role="group" aria-labelledby="lbl-h">
            <h3 id="lbl-h" className="mb-0.5 text-xs text-muted">Labels (optional)</h3>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
              {lblChips.map((l) => (
                <Chip
                  key={l.id}
                  selected={selLabels.some((x) => x.id === l.id)}
                  onClick={() =>
                    setSelLabels((cur) => (cur.some((x) => x.id === l.id) ? cur.filter((x) => x.id !== l.id) : [...cur, l]))
                  }
                >
                  {l.name}
                </Chip>
              ))}
              <div className="shrink-0">
                <QuickAddButton compact label="Label" onOpen={() => setAddingLabel(true)} />
              </div>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 flex-col gap-2">
            <div className="flex-1 min-h-0">
              <AmountKeypad value={amountStr} onChange={setAmountStr} />
            </div>

            {initial && onDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="min-h-11 shrink-0 self-start text-sm text-expense"
              >
                Delete transaction
              </button>
            )}

            {error && <p role="alert" className="shrink-0 text-sm text-expense">{error}</p>}
          </div>
        </div>
      )}

      {addingCategory && (
        <CatalogEntryForm
          kind="category"
          onClose={() => setAddingCategory(false)}
          onCreate={async (data) => {
            setCategory(await addCategory(uid, { name: data.name, type, icon: data.icon, color: data.color }));
            setStep('details');
          }}
        />
      )}
      {addingLabel && (
        <CatalogEntryForm
          kind="label"
          onClose={() => setAddingLabel(false)}
          onCreate={async (data) => {
            const l = await addLabel(uid, data.name, { icon: data.icon, color: data.color });
            setSelLabels((cur) => (cur.some((x) => x.id === l.id) ? cur : [...cur, l]));
          }}
        />
      )}
    </BottomSheet>
  );
}

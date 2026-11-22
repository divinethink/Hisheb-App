// ক্রয় তালিকা: যোগ/এডিট ফর্ম-শিট (ধরন, নাম+সাজেশন, ডোজ, মূল্য, তারিখ, রোগী, নোট) + ডিলিট।
import { useMemo, useState, type ReactNode } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput from '../../common/AmountInput';
import DateInput from '../../common/DateInput';
import DeleteEntryButton from '../../common/DeleteEntryButton';
import { resolveAmountMinor, minorToInput } from '../../../lib/money';
import { toDhakaDate } from '../../../lib/date';
import { formatTaka } from '../../../lib/format';
import { settleOrPending } from '../../../lib/async';
import { KIND_LABEL, suggestNames } from '../../../lib/medPurchaseCalc';
import { addMedPurchase, deleteMedPurchase, newMedPurchaseId, updateMedPurchase } from '../../../data/medPurchaseRepo';
import { MED_KINDS, MED_LIMITS, type MedKind, type MedPurchase } from '../../../validation/medPurchaseSchema';

const inputCls = 'min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none focus:border-primary';
const DOSE_HINTS = ['500mg', '250mg', '5ml', '10ml', '1+1+1'];

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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm ${on ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-transparent bg-muted/10 text-muted'}`}
    >
      {children}
    </button>
  );
}

export default function MedPurchaseSheet({
  uid,
  item,
  knownNames,
  knownPatients,
  defaultPatient,
  onClose,
  onPatientUsed,
}: {
  uid: string;
  item?: MedPurchase;
  /** আগে লেখা নাম (সাজেশনে আগে আসে) */
  knownNames: readonly { name: string; kind: MedKind }[];
  knownPatients: readonly string[];
  defaultPatient: string;
  onClose: () => void;
  onPatientUsed: (p: string) => void;
}) {
  const [id] = useState(() => item?.id ?? newMedPurchaseId(uid)); // retry-তে একই id → duplicate নয়
  const [kind, setKind] = useState<MedKind>(item?.kind ?? 'medicine');
  const [name, setName] = useState(item?.name ?? '');
  const [dose, setDose] = useState(item?.dose ?? '');
  const [amount, setAmount] = useState(item ? minorToInput(item.amountMinor) : '');
  const [date, setDate] = useState(item?.date ?? toDhakaDate(new Date()));
  const [patient, setPatient] = useState(item ? item.patient : defaultPatient);
  const [note, setNote] = useState(item?.note ?? '');
  const [focusName, setFocusName] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = resolveAmountMinor(amount);
  const nameOk = name.trim().length > 0;
  const suggestions = useMemo(
    () =>
      focusName
        ? suggestNames(name, kind, knownNames.filter((k) => k.kind === kind).map((k) => k.name))
        : [],
    [focusName, name, kind, knownNames],
  );

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (!nameOk || parsed === null || !date) return;
    setSaving(true);
    setError('');
    const input = { kind, name, dose, amountMinor: parsed, date, patient, note };
    try {
      await settleOrPending(item ? updateMedPurchase(uid, id, input) : addMedPurchase(uid, id, input), 3000);
      onPatientUsed(patient.trim());
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      title={item ? 'Edit purchase' : 'Add purchase'}
      onRequestClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Type" className="flex gap-2 overflow-x-auto pb-1">
          {MED_KINDS.map((k) => (
            <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>

        <Field label="নাম (ঔষধ / টেস্ট / অপারেশন)" htmlFor="mp-name">
          <input
            id="mp-name"
            value={name}
            maxLength={MED_LIMITS.name}
            autoComplete="off"
            aria-invalid={submitted && !nameOk}
            onFocus={() => setFocusName(true)}
            onBlur={() => setTimeout(() => setFocusName(false), 150)}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
          {suggestions.length > 0 && (
            <ul aria-label="Suggestions" className="mt-1 overflow-hidden rounded-lg border border-muted/20 bg-canvas">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setName(s);
                      setFocusName(false);
                    }}
                    className="min-h-11 w-full px-3 text-left text-sm text-fg active:bg-primary/10"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {submitted && !nameOk && (
            <p role="alert" className="mt-1 text-sm text-expense">
              নাম লিখুন।
            </p>
          )}
        </Field>

        <Field label="ডোজ / পরিমাণ (ঐচ্ছিক)" htmlFor="mp-dose">
          <input id="mp-dose" value={dose} maxLength={MED_LIMITS.dose} onChange={(e) => setDose(e.target.value)} placeholder="যেমন 500mg, 10ml" className={inputCls} />
        </Field>
        {kind === 'medicine' && (
          <div className="-mt-1 flex gap-2 overflow-x-auto pb-1">
            {DOSE_HINTS.map((h) => (
              <Chip key={h} on={dose === h} onClick={() => setDose(h)}>
                {h}
              </Chip>
            ))}
          </div>
        )}

        <AmountInput value={amount} onChange={setAmount} showError={submitted} card />

        <Field label="তারিখ" htmlFor="mp-date">
          <DateInput uid={uid} id="mp-date" value={date} onChange={setDate} invalid={submitted && !date} variant="tall" />
        </Field>

        <Field label="রোগী (ঐচ্ছিক)" htmlFor="mp-patient">
          <input id="mp-patient" value={patient} maxLength={MED_LIMITS.patient} onChange={(e) => setPatient(e.target.value)} placeholder="যেমন আমি, স্ত্রী, ছেলে" className={inputCls} />
        </Field>
        {knownPatients.length > 0 && (
          <div className="-mt-1 flex gap-2 overflow-x-auto pb-1">
            {knownPatients.map((p) => (
              <Chip key={p} on={patient === p} onClick={() => setPatient(p)}>
                {p}
              </Chip>
            ))}
          </div>
        )}

        <Field label="নোট (ঐচ্ছিক)" htmlFor="mp-note">
          <input id="mp-note" value={note} maxLength={MED_LIMITS.note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}

        {item && (
          <div className="flex justify-end pt-2">
            <DeleteEntryButton
              title="এই ক্রয়টি মুছবেন?"
              detail={`${item.name} · ${formatTaka(item.amountMinor)}`}
              onDelete={async () => {
                await deleteMedPurchase(uid, item.id);
                onClose();
              }}
            />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

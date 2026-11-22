import { useState } from 'react';
import BottomSheet from '../../common/BottomSheet';
import AmountInput from '../../common/AmountInput';
import { minorToInput, resolveAmountMinor } from '../../../lib/money';
import { addZakatAsset, updateZakatAsset } from '../../../data/zakatRepo';
import { settleOrPending } from '../../../lib/async';
import type { ZakatAsset } from '../../../validation/zakatSchema';

type Category = ZakatAsset['category'];
type Irrigation = NonNullable<ZakatAsset['irrigationMethod']>;

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'goldJewelry', label: 'Gold' },
  { key: 'silverJewelry', label: 'Silver' },
  { key: 'agriculturalProduce', label: 'Crop' },
  { key: 'other', label: 'Other' },
];
const IRRIGATION: { key: Irrigation; label: string }[] = [
  { key: 'rainfed', label: 'Rain-fed · 10%' },
  { key: 'irrigated', label: 'Irrigated · 5%' },
];

const chip = (on: boolean) =>
  `min-h-11 flex-1 rounded-lg border px-2 text-sm ${on ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-muted'}`;

export default function ZakatAssetSheet({ uid, editing, onClose }: { uid: string; editing?: ZakatAsset; onClose: () => void }) {
  const [category, setCategory] = useState<Category>(editing?.category ?? 'goldJewelry');
  const [name, setName] = useState(editing?.name ?? '');
  const [weight, setWeight] = useState(editing?.weightGrams != null ? String(editing.weightGrams) : '');
  const [amount, setAmount] = useState(editing?.valueMinor != null ? minorToInput(editing.valueMinor) : '');
  const [irrigation, setIrrigation] = useState<Irrigation | null>(editing?.irrigationMethod ?? null);
  const [zakatable, setZakatable] = useState(editing?.zakatable ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const jewelry = category === 'goldJewelry' || category === 'silverJewelry';
  const crop = category === 'agriculturalProduce';
  const weightNum = Number(weight.replace(/,/g, ''));
  const weightOk = weight.trim() !== '' && Number.isFinite(weightNum) && weightNum > 0;
  const valueMinor = resolveAmountMinor(amount);

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (name.trim() === '') return;
    if (jewelry ? !weightOk : valueMinor === null) return;
    if (crop && irrigation === null) return;
    setSaving(true);
    setError('');
    const input = {
      name: name.trim(),
      category,
      weightGrams: jewelry ? weightNum : null,
      valueMinor: jewelry ? null : valueMinor,
      irrigationMethod: crop ? irrigation : null,
      zakatable,
      note: editing?.note ?? '',
    };
    try {
      if (editing) await settleOrPending(updateZakatAsset(uid, editing.id, input), 3000);
      else await settleOrPending(addZakatAsset(uid, input), 3000);
      onClose();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  const footer = (
    <>
      <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm disabled:opacity-60">
        Cancel
      </button>
      <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </>
  );

  return (
    <BottomSheet title={editing ? 'Edit asset' : 'Add asset'} onRequestClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Asset type" className="flex gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" aria-pressed={category === c.key} onClick={() => setCategory(c.key)} className={chip(category === c.key)}>
              {c.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="za-name" className="mb-1 block text-sm text-muted">
            Name
          </label>
          <input
            id="za-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && name.trim() === ''}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
        </div>

        {jewelry ? (
          <div>
            <label htmlFor="za-weight" className="mb-1 block text-sm text-muted">
              Weight (grams)
            </label>
            <input
              id="za-weight"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value.replace(/[^0-9.,]/g, ''))}
              aria-invalid={submitted && !weightOk}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
            <p className="mt-1 text-xs text-muted">Value is worked out from the {category === 'goldJewelry' ? 'gold' : 'silver'} price you set.</p>
          </div>
        ) : (
          <AmountInput value={amount} onChange={setAmount} showError={submitted} />
        )}

        {crop && (
          <div role="group" aria-label="Irrigation" className="flex gap-2">
            {IRRIGATION.map((i) => (
              <button key={i.key} type="button" aria-pressed={irrigation === i.key} onClick={() => setIrrigation(i.key)} className={chip(irrigation === i.key)}>
                {i.label}
              </button>
            ))}
          </div>
        )}
        {crop && submitted && irrigation === null && (
          <p role="alert" className="-mt-2 text-sm text-expense">
            Choose how the crop was watered.
          </p>
        )}

        <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
          <input type="checkbox" checked={zakatable} onChange={(e) => setZakatable(e.target.checked)} className="h-5 w-5 accent-primary" />
          Include in Zakat calculation
        </label>

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

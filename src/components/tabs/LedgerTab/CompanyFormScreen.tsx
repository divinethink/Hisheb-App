import { useEffect, useRef, useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import CompanyLogo from '../../common/CompanyLogo';
import { addInvestmentCompany, updateInvestmentCompany } from '../../../data/investmentCompanyRepo';
import { companyNameTaken } from '../../../lib/investmentName';
import { settleOrPending } from '../../../lib/async';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { fileToLogoDataUrl, logoErrorMessage } from './logoResize';
import { safeLogo, type InvestmentCompany } from '../../../validation/investmentCompanySchema';

/** নতুন কোম্পানি / এডিট — নাম, ঐচ্ছিক Medium (শুধু সাজেশনের জন্য), ঐচ্ছিক লোগো। একবার সেভ, পরে সব এন্ট্রিতে বসে। */
export default function CompanyFormScreen({
  uid,
  initial,
  companies,
  onClose,
  onSaved,
}: {
  uid: string;
  initial: InvestmentCompany | null;
  companies: readonly InvestmentCompany[];
  onClose: () => void;
  onSaved: (company: InvestmentCompany) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [medium, setMedium] = useState(initial?.medium ?? '');
  const [logo, setLogo] = useState<string | null>(safeLogo(initial?.logo));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyLogo, setBusyLogo] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = initial
    ? name.trim() !== initial.name || medium.trim() !== initial.medium || logo !== safeLogo(initial.logo)
    : name.trim() !== '' || medium.trim() !== '' || logo !== null;

  useEffect(() => {
    if (!dirty) return;
    markDirty();
    return () => markClean();
  }, [dirty]);

  const trimmed = name.trim();
  const taken = trimmed !== '' && companyNameTaken(companies, trimmed, initial?.id);

  function requestBack() {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setBusyLogo(true);
    try {
      setLogo(await fileToLogoDataUrl(file));
    } catch (e) {
      setError(logoErrorMessage(e));
    } finally {
      setBusyLogo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save() {
    if (saving || busyLogo) return;
    setSubmitted(true);
    setError('');
    if (!trimmed || taken) return;
    setSaving(true);
    const input = { name: trimmed, medium: medium.trim(), logo };
    try {
      if (initial) {
        await settleOrPending(updateInvestmentCompany(uid, initial.id, input), 3000);
        onSaved({ ...initial, name: trimmed, medium: medium.trim(), logo });
      } else {
        const { id, done } = addInvestmentCompany(uid, input);
        await settleOrPending(done, 3000);
        onSaved({ id, name: trimmed, medium: medium.trim(), logo, createdAt: null, updatedAt: null });
      }
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  if (confirmDiscard) {
    return (
      <FullScreenPage title={initial ? 'Edit company' : 'New company'} onBack={() => setConfirmDiscard(false)}>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-fg">Discard changes?</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmDiscard(false)} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm">
              Keep editing
            </button>
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-expense px-4 text-sm font-medium text-canvas">
              Discard
            </button>
          </div>
        </div>
      </FullScreenPage>
    );
  }

  return (
    <FullScreenPage
      title={initial ? 'Edit company' : 'New company'}
      onBack={requestBack}
      footer={
        <button type="button" onClick={() => void save()} disabled={saving || busyLogo} className="min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-60">
          {saving ? 'Saving…' : 'Save company'}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-2">
          <CompanyLogo name={trimmed || '?'} logo={logo} size="lg" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Company logo file" onChange={(e) => void pickFile(e.target.files?.[0])} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busyLogo}
              onClick={() => fileRef.current?.click()}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60"
            >
              {busyLogo ? 'Reading…' : logo ? 'Change logo' : 'Choose logo'}
            </button>
            {logo && (
              <button type="button" onClick={() => setLogo(null)} className="min-h-11 rounded-lg border border-expense/40 px-4 text-sm text-expense">
                Remove
              </button>
            )}
          </div>
          <p className="text-center text-xs text-muted">Optional · square crop · shrunk to ~96px on this phone</p>
        </div>

        <div>
          <label htmlFor="co-name" className="mb-1 block text-sm text-muted">
            Company name
          </label>
          <input
            id="co-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && (!trimmed || taken)}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
          {submitted && !trimmed && (
            <p role="alert" className="mt-1 text-sm text-expense">
              Enter a name.
            </p>
          )}
          {taken && (
            <p role="alert" className="mt-1 text-sm text-expense">
              This company already exists.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="co-medium" className="mb-1 block text-sm text-muted">
            Medium (optional — only a top suggestion, never auto-filled)
          </label>
          <input
            id="co-medium"
            value={medium}
            maxLength={60}
            onChange={(e) => setMedium(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </FullScreenPage>
  );
}

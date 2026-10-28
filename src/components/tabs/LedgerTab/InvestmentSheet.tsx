import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Paperclip } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import AmountInput from '../../common/AmountInput';
import CompanyLogo from '../../common/CompanyLogo';
import CompanyPickerScreen from './CompanyPickerScreen';
import ContractLink from '../../common/ContractLink';
import { getEnv } from '../../../config/env';
import { driveNotReadyReason, isGoogleDriveConfigured, uploadContractPdf } from '../../../data/googleDrive';
import { checkContractMeta, contractProblemMessage, hasPdfMagic, safeContractName } from '../../../lib/contractFile';
import { minorToInput, resolveAmountMinor } from '../../../lib/money';
import { addInvestment, updateInvestment } from '../../../data/investmentRepo';
import { markClean, markDirty } from '../../../pwa/dirtyForms';
import { settleOrPending } from '../../../lib/async';
import { toDhakaDate } from '../../../lib/date';
import {
  baseInvestmentName,
  composeInvestmentName,
  hasTrailingRoundTag,
  lastRoundForCompany,
  mediumSuggestions,
  parseRoundInput,
} from '../../../lib/investmentName';
import { useInvestmentCompanies, useInvestments } from '../../../hooks/useData';
import type { Investment } from '../../../validation/investmentSchema';

const DRIVE_CLIENT_ID = getEnv().googleDriveClientId;

// গ (Owner-approved ২০২৬-১০-২৯): UTC-substring নয়, ঢাকার তারিখ — রাত ১২টা–ভোর ৬টায়ও সঠিক দিন (§৯)
function today(): string {
  return toDhakaDate(new Date());
}

export default function InvestmentSheet({
  uid,
  initial,
  ledgerId = null,
  onClose,
}: {
  uid: string;
  initial: Investment | null;
  ledgerId?: string | null;
  onClose: () => void;
}) {
  // পুরনো এন্ট্রি (companyId নেই) = legacy: নাম হুবহু আগের মতো টেক্সট, [n]/কোম্পানি ছোঁয়া হয় না (zero data loss, ধাপ ২-এ Link)
  const legacy = initial !== null && !initial.companyId;
  const baseName = initial ? (legacy ? initial.investedTo : baseInvestmentName(initial.investedTo, initial.round)) : '';
  const initialRound = initial?.round ? String(initial.round) : '';
  const companies = useInvestmentCompanies(uid);
  const investments = useInvestments(uid);
  const [companyId, setCompanyId] = useState<string | null>(initial?.companyId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [investedTo, setInvestedTo] = useState(baseName);
  const [round, setRound] = useState(initialRound);
  const [platformNo, setPlatformNo] = useState(initial?.platformNo ?? '');
  const [medium, setMedium] = useState(initial?.medium ?? '');
  const [mediumFocus, setMediumFocus] = useState(false);
  const [amount, setAmount] = useState(initial ? minorToInput(initial.principalMinor) : '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [duration, setDuration] = useState(initial?.duration ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // PDF (ধাপ ৩): নতুন ফাইল বাছাই হয় ফর্মে, আপলোড হয় Save-এর সময় (বাতিল করলে Drive-এ এতিম ফাইল জমে না)
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [removeContract, setRemoveContract] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadedRef = useRef<{ file: File; fileId: string; name: string } | null>(null); // সেভ আটকে retry হলে দ্বিতীয়বার আপলোড নয়
  const driveReady = isGoogleDriveConfigured(DRIVE_CLIENT_ID);
  const hasSavedContract = !!initial?.contractFileId && !removeContract;

  const companyList = companies.state.status === 'ready' ? companies.state.data : [];
  const invList = investments.state.status === 'ready' ? investments.state.data : [];
  const company = companyId ? companyList.find((c) => c.id === companyId) ?? null : null;
  const lastRound = companyId ? lastRoundForCompany(invList, companyId, initial ? invList.find((i) => i.id === initial.id) ?? null : null) : null;
  const suggestions = mediumSuggestions(
    invList.map((i) => i.medium),
    company?.medium ?? '',
    medium,
  );

  const roundParsed = parseRoundInput(round);
  const trimmedName = investedTo.trim();
  const roundInvalid = !legacy && roundParsed === 'invalid';
  const doubleTag = !legacy && typeof roundParsed === 'number' && hasTrailingRoundTag(trimmedName);
  const companyMissing = !legacy && companyId === null;
  const savedAs = legacy ? trimmedName : composeInvestmentName(trimmedName, typeof roundParsed === 'number' ? roundParsed : null);

  const dirty = initial
    ? trimmedName !== baseName ||
      medium !== initial.medium ||
      duration !== initial.duration ||
      note !== initial.note ||
      date !== initial.date ||
      // খ (Owner-approved ২০২৬-১০-২৯): Edit মোডে শুধু Amount বদলে Back করলেও "Discard?" আসবে
      amount !== minorToInput(initial.principalMinor) ||
      platformNo.trim() !== initial.platformNo ||
      pdfFile !== null ||
      removeContract ||
      (!legacy && (companyId !== (initial.companyId ?? null) || round.trim() !== initialRound))
    : trimmedName !== '' || companyId !== null || amount !== '' || medium !== '' || duration !== '' || note !== '' || platformNo !== '' || round !== '' || pdfFile !== null;

  useEffect(() => {
    if (!dirty) return;
    markDirty();
    return () => markClean();
  }, [dirty]);

  function requestBack() {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  async function pickPdf(file: File | undefined) {
    if (!file) return;
    setPdfError('');
    const problem = checkContractMeta(file);
    if (problem) {
      setPdfError(contractProblemMessage(problem));
    } else {
      const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (!hasPdfMagic(head)) setPdfError('This file is not a valid PDF.');
      else {
        setPdfFile(file);
        setRemoveContract(false);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save() {
    if (saving) return;
    setSubmitted(true);
    const parsed = resolveAmountMinor(amount);
    setError('');
    if (!trimmedName || parsed === null || !date || companyMissing || roundInvalid || doubleTag) return;
    const roundNum = !legacy && typeof roundParsed === 'number' ? roundParsed : null;
    const finalName = legacy ? trimmedName : composeInvestmentName(trimmedName, roundNum);
    const platform = platformNo.trim().replace(/^#\s*/, '');
    setSaving(true);
    try {
      // PDF আগে আপলোড (প্রথম await-এই, যাতে Google অনুমতি-পপআপ ক্লিকের সাথে যুক্ত থাকে); ব্যর্থ হলে এন্ট্রি সেভ হয় না
      let contract: { contractFileId: string | null; contractName: string | null } | null = null;
      if (pdfFile) {
        // ক্লিকের মুহূর্তে আবার দেখা (স্ক্রিপ্ট দেরিতে লোড হলেও ঠিক)
        if (!isGoogleDriveConfigured(DRIVE_CLIENT_ID)) throw new Error(`Google Drive not ready: ${driveNotReadyReason(DRIVE_CLIENT_ID)}`);
        let up = uploadedRef.current?.file === pdfFile ? uploadedRef.current : null;
        if (!up) {
          const name = safeContractName(pdfFile.name);
          const r = await uploadContractPdf(DRIVE_CLIENT_ID, pdfFile, name);
          up = { file: pdfFile, fileId: r.fileId, name: r.name };
          uploadedRef.current = up;
        }
        contract = { contractFileId: up.fileId, contractName: safeContractName(up.name) };
      } else if (removeContract) {
        contract = { contractFileId: null, contractName: null }; // শুধু রেফারেন্স সরে; Drive-এর ফাইল মোছা হয় না
      }
      if (initial) {
        await settleOrPending(
          updateInvestment(uid, initial.id, {
            investedTo: finalName,
            medium,
            principalMinor: parsed,
            date,
            duration,
            note,
            platformNo: platform,
            // legacy এন্ট্রিতে companyId/round লেখা হয় না — শুধু কোম্পানি-সংযুক্ত এন্ট্রিতে
            ...(legacy ? {} : { companyId, round: roundNum }),
            ...(contract ?? {}),
          }),
          3000,
        );
      } else {
        await settleOrPending(
          addInvestment(uid, {
            investedTo: finalName,
            medium,
            principalMinor: parsed,
            currency: 'BDT',
            date,
            duration,
            note,
            investmentOutcome: 'running',
            zakatable: true,
            expectedRepaymentDate: null,
            ledgerId,
            companyId,
            round: roundNum,
            platformNo: platform,
            ...(contract ?? {}),
          }),
          3000,
        );
      }
      onClose();
    } catch (e) {
      setError(
        pdfFile && !uploadedRef.current
          ? `PDF upload failed${e instanceof Error && e.message ? `: ${e.message}` : ''}. Allow the Google popup and tap Save again, or remove the PDF.`
          : 'Could not save. Check your connection and try again.',
      );
      setSaving(false);
    }
  }

  if (pickerOpen) {
    return (
      <CompanyPickerScreen
        uid={uid}
        selectedId={companyId}
        onClose={() => setPickerOpen(false)}
        onSelect={(c) => {
          setCompanyId(c.id);
          setInvestedTo(c.name); // নাম এন্ট্রিতে এডিটযোগ্য থাকে; এন্ট্রির নাম বদলালে কোম্পানি-রেকর্ড বদলায় না
          setPickerOpen(false);
        }}
      />
    );
  }

  if (confirmDiscard) {
    return (
      <FullScreenPage title={initial ? 'Edit entry' : 'New entry'} onBack={() => setConfirmDiscard(false)}>
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
      title={initial ? 'Edit entry' : 'New entry'}
      onBack={requestBack}
      footer={
        <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {legacy ? (
          <div>
            <label htmlFor="inv-to" className="mb-1 block text-sm text-muted">
              Invested To
            </label>
            <input
              id="inv-to"
              autoFocus
              value={investedTo}
              maxLength={60}
              onChange={(e) => setInvestedTo(e.target.value)}
              aria-invalid={submitted && !trimmedName}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
            {submitted && !trimmedName && (
              <p role="alert" className="mt-1 text-sm text-expense">
                Enter a name.
              </p>
            )}
          </div>
        ) : (
          <>
            <div>
              <span className="mb-1 block text-sm text-muted">Company</span>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-invalid={submitted && companyMissing}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-muted/40 bg-surface px-3 text-left"
              >
                {companyId ? (
                  <>
                    <CompanyLogo name={company?.name ?? trimmedName} logo={company?.logo} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium text-fg">{company?.name ?? trimmedName}</span>
                  </>
                ) : (
                  <span className="flex-1 text-muted">Choose company</span>
                )}
                <ChevronDown aria-hidden size={18} className="text-muted" />
              </button>
              {submitted && companyMissing && (
                <p role="alert" className="mt-1 text-sm text-expense">
                  Choose a company.
                </p>
              )}
            </div>

            {companyId && (
              <div>
                <label htmlFor="inv-to" className="mb-1 block text-sm text-muted">
                  Name
                </label>
                <input
                  id="inv-to"
                  value={investedTo}
                  maxLength={60}
                  onChange={(e) => setInvestedTo(e.target.value)}
                  aria-invalid={submitted && (!trimmedName || doubleTag)}
                  className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
                />
                {submitted && !trimmedName && (
                  <p role="alert" className="mt-1 text-sm text-expense">
                    Enter a name.
                  </p>
                )}
                {submitted && doubleTag && (
                  <p role="alert" className="mt-1 text-sm text-expense">
                    Remove the [n] from the name — Round adds it.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="inv-round" className="mb-1 block text-sm text-muted">
                  Round (optional)
                </label>
                <input
                  id="inv-round"
                  inputMode="numeric"
                  value={round}
                  maxLength={3}
                  placeholder="9"
                  onChange={(e) => setRound(e.target.value)}
                  aria-invalid={submitted && roundInvalid}
                  className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
                />
                {submitted && roundInvalid ? (
                  <p role="alert" className="mt-1 text-xs text-expense">
                    Digits only (1–999).
                  </p>
                ) : (
                  lastRound !== null && <p className="mt-1 text-xs text-muted">Last: {lastRound}</p>
                )}
              </div>
              <div>
                <label htmlFor="inv-no" className="mb-1 block text-sm text-muted">
                  Investment No (optional)
                </label>
                <input
                  id="inv-no"
                  value={platformNo}
                  maxLength={30}
                  placeholder="#74874"
                  onChange={(e) => setPlatformNo(e.target.value)}
                  className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
                />
              </div>
            </div>
          </>
        )}

        {legacy && (
          <div>
            <label htmlFor="inv-no" className="mb-1 block text-sm text-muted">
              Investment No (optional)
            </label>
            <input
              id="inv-no"
              value={platformNo}
              maxLength={30}
              placeholder="#74874"
              onChange={(e) => setPlatformNo(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
        )}

        <div>
          <label htmlFor="inv-medium" className="mb-1 block text-sm text-muted">
            Medium (optional)
          </label>
          <input
            id="inv-medium"
            value={medium}
            maxLength={60}
            onChange={(e) => setMedium(e.target.value)}
            onFocus={() => setMediumFocus(true)}
            onBlur={() => setMediumFocus(false)}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
          {mediumFocus && suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" role="list" aria-label="Medium suggestions">
              {suggestions.map((m, idx) => (
                <button
                  key={m}
                  type="button"
                  role="listitem"
                  // pointerdown-এ focus কেড়ে নেওয়া আটকাই, যাতে চিপ বাছার আগে সাজেশন-সারি লুকিয়ে না যায়
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setMedium(m)}
                  className={`min-h-9 rounded-full px-3 text-sm ${idx === 0 && company?.medium?.trim() === m ? 'bg-primary text-canvas' : 'bg-primary/10 text-primary'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {!legacy && companyId && trimmedName && (
          <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
            Saved as: <span className="font-medium text-fg">{savedAs}</span>
          </p>
        )}

        <AmountInput value={amount} onChange={setAmount} showError={submitted} />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="inv-date" className="mb-1 block text-sm text-muted">
              Date
            </label>
            <input
              id="inv-date"
              type="date"
              lang="en-GB"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
          <div>
            <label htmlFor="inv-note" className="mb-1 block text-sm text-muted">
              Note (optional)
            </label>
            <input
              id="inv-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="inv-duration" className="mb-1 block text-sm text-muted">
            Duration (optional)
          </label>
          <input
            id="inv-duration"
            value={duration}
            maxLength={40}
            onChange={(e) => setDuration(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
          />
        </div>

        <div>
          <span className="mb-1 block text-sm text-muted">Contract (PDF, optional)</span>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Contract PDF file" onChange={(e) => void pickPdf(e.target.files?.[0])} />
          {pdfFile ? (
            <div className="flex min-h-12 items-center gap-2 rounded-lg border border-muted/40 bg-surface px-3 text-sm">
              <Paperclip aria-hidden size={16} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-fg">{pdfFile.name}</span>
              <button type="button" onClick={() => setPdfFile(null)} className="min-h-9 shrink-0 px-2 text-expense">
                Remove
              </button>
            </div>
          ) : hasSavedContract && initial?.contractFileId ? (
            <div className="flex flex-col gap-2">
              <ContractLink fileId={initial.contractFileId} name={initial.contractName} />
              <div className="flex gap-2">
                <button type="button" disabled={!driveReady} onClick={() => fileRef.current?.click()} className="min-h-10 flex-1 rounded-lg border border-muted/40 text-sm text-fg disabled:opacity-60">
                  Replace PDF
                </button>
                <button type="button" onClick={() => setRemoveContract(true)} className="min-h-10 flex-1 rounded-lg border border-expense/40 text-sm text-expense">
                  Detach
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={!driveReady}
                onClick={() => fileRef.current?.click()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-medium text-primary disabled:opacity-60"
              >
                <Paperclip aria-hidden size={16} /> Attach PDF · saved to your Google Drive
              </button>
              {removeContract && <p className="mt-1 text-xs text-muted">PDF will be detached on Save (the Drive file stays).</p>}
            </>
          )}
          {!driveReady && <p className="mt-1 text-xs text-muted">Google Drive not ready: {driveNotReadyReason(DRIVE_CLIENT_ID)}</p>}
          {pdfError && (
            <p role="alert" className="mt-1 text-xs text-expense">
              {pdfError}
            </p>
          )}
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

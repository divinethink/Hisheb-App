import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Paperclip, Trash2, X } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import AmountInput from '../../common/AmountInput';
import CompanyLogo from '../../common/CompanyLogo';
import DateInput from '../../common/DateInput';
import CompanyPickerScreen from './CompanyPickerScreen';
import ContractLink from '../../common/ContractLink';
import { getEnv } from '../../../config/env';
import { deleteContractFile, driveNotReadyReason, isGoogleDriveConfigured, uploadContractPdf } from '../../../data/googleDrive';
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

const INPUT = 'block min-h-8 w-full bg-transparent text-base text-fg outline-none placeholder:text-muted/60';

// কার্ড-ফিল্ড: লেবেল কার্ডের ভেতরে, পুরো কার্ড ট্যাপে ইনপুটে ফোকাস
function FieldCard({
  label,
  htmlFor,
  invalid = false,
  className = '',
  children,
}: {
  label: string;
  htmlFor: string;
  invalid?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block rounded-xl border bg-surface px-3 pb-2 pt-2 focus-within:border-primary ${invalid ? 'border-expense' : 'border-muted/25'} ${className}`}
    >
      <span className="block truncate text-xs text-muted">{label}</span>
      {children}
    </label>
  );
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
  // কোম্পানি-ছাড়া এন্ট্রি (পুরনো বা "Type company name"): কোম্পানির নাম নিজে লেখা, কোনো কোম্পানি-রেকর্ড তৈরি হয় না; Round দিলে [n] বসে
  const baseName = initial ? baseInvestmentName(initial.investedTo, initial.round) : '';
  const initialRound = initial?.round ? String(initial.round) : '';
  const companies = useInvestmentCompanies(uid);
  const investments = useInvestments(uid);
  const [companyId, setCompanyId] = useState<string | null>(initial?.companyId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customCompany, setCustomCompany] = useState(initial !== null && !initial.companyId);
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
  const [confirmRemovePdf, setConfirmRemovePdf] = useState(false);
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
  const roundInvalid = roundParsed === 'invalid';
  const doubleTag = typeof roundParsed === 'number' && hasTrailingRoundTag(trimmedName);
  const companyMissing = companyId === null && !customCompany;
  const savedAs = composeInvestmentName(trimmedName, typeof roundParsed === 'number' ? roundParsed : null);

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
      companyId !== (initial.companyId ?? null) ||
      round.trim() !== initialRound
    : trimmedName !== '' || companyId !== null || customCompany || amount !== '' || medium !== '' || duration !== '' || note !== '' || platformNo !== '' || round !== '' || pdfFile !== null;

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
    const roundNum = typeof roundParsed === 'number' ? roundParsed : null;
    const finalName = composeInvestmentName(trimmedName, roundNum);
    const platform = platformNo.trim().replace(/^#\s*/, '');
    setSaving(true);
    let stage: 'upload' | 'delete' | 'save' = 'upload';
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
        contract = { contractFileId: null, contractName: null };
      }
      // Remove করলে Drive থেকেও মোছা (নতুন PDF থাকলে সেটা আগেই আপলোড হয়েছে); ফাইল আগেই নেই হলে ঠিক আছে
      if (removeContract && initial?.contractFileId) {
        stage = 'delete';
        if (!isGoogleDriveConfigured(DRIVE_CLIENT_ID)) throw new Error(`Google Drive not ready: ${driveNotReadyReason(DRIVE_CLIENT_ID)}`);
        await deleteContractFile(DRIVE_CLIENT_ID, initial.contractFileId);
      }
      stage = 'save';
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
            // companyId/round শুধু বদলালে লেখা হয় (পুরনো এন্ট্রির ফিল্ড অক্ষত থাকে)
            ...(companyId !== (initial.companyId ?? null) || roundNum !== (initial.round ?? null) ? { companyId, round: roundNum } : {}),
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
        stage === 'delete'
          ? 'Could not remove the PDF from Google Drive. Check your connection, allow the Google popup and tap Save again.'
          : pdfFile && !uploadedRef.current
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
        onSelectOther={() => {
          // সেভ-করা কোম্পানির নাম বসে থাকলে সেটা মুছে ফাঁকা করি, নইলে নিজের লেখা নাম রাখি
          if (company && trimmedName === company.name) setInvestedTo('');
          setCompanyId(null);
          setCustomCompany(true);
          setPickerOpen(false);
        }}
        onSelect={(c) => {
          setCompanyId(c.id);
          setCustomCompany(false);
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
        {/* Company ও Round — এক লাইনে। সেভ-করা কোম্পানি বাছলে সেটাই; না হলে ("Other") নাম টাইপ — দুই ক্ষেত্রেই পাশে Round */}
        <div>
          <div className="flex gap-2">
            {customCompany && !companyId ? (
              <FieldCard label="Company name" htmlFor="inv-to" invalid={submitted && !trimmedName} className="min-w-0 flex-1">
                <div className="flex items-center">
                  <input
                    id="inv-to"
                    autoFocus={!initial}
                    value={investedTo}
                    maxLength={60}
                    placeholder="Type company name"
                    onChange={(e) => setInvestedTo(e.target.value)}
                    aria-invalid={submitted && !trimmedName}
                    className={INPUT}
                  />
                  <button type="button" aria-label="Choose a saved company" onClick={() => setPickerOpen(true)} className="-mr-1 flex size-8 shrink-0 items-center justify-center text-muted">
                    <ChevronDown aria-hidden size={18} />
                  </button>
                </div>
              </FieldCard>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-invalid={submitted && companyMissing}
                className={`min-w-0 flex-1 rounded-xl border bg-surface px-3 pb-2 pt-2 text-left ${submitted && companyMissing ? 'border-expense' : 'border-muted/25'}`}
              >
                <span className="block truncate text-xs text-muted">Company</span>
                <span className="flex min-h-8 items-center gap-2">
                  {companyId ? (
                    <>
                      <CompanyLogo name={company?.name ?? trimmedName} logo={company?.logo} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium text-fg">{company?.name ?? trimmedName}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-muted">Choose company</span>
                  )}
                  <ChevronDown aria-hidden size={18} className="shrink-0 text-muted" />
                </span>
              </button>
            )}
            <FieldCard label="Round" htmlFor="inv-round" invalid={submitted && roundInvalid} className="w-24 shrink-0">
              <input
                id="inv-round"
                inputMode="numeric"
                value={round}
                maxLength={3}
                placeholder="9"
                onChange={(e) => setRound(e.target.value)}
                aria-invalid={submitted && roundInvalid}
                className={INPUT}
              />
            </FieldCard>
          </div>
          {submitted && companyMissing && (
            <p role="alert" className="mt-1 text-sm text-expense">
              Choose a company.
            </p>
          )}
          {submitted && !companyMissing && !trimmedName && customCompany && (
            <p role="alert" className="mt-1 text-sm text-expense">
              Enter a name.
            </p>
          )}
          {submitted && doubleTag && (
            <p role="alert" className="mt-1 text-sm text-expense">
              Remove the [n] from the name — Round adds it.
            </p>
          )}
          {submitted && roundInvalid ? (
            <p role="alert" className="mt-1 text-xs text-expense">
              Digits only (1–999).
            </p>
          ) : (
            companyId !== null && lastRound !== null && <p className="mt-1 text-xs text-muted">Last round: {lastRound}</p>
          )}
        </div>

        {/* এন্ট্রির নাম কোম্পানির নাম থেকে আলাদা হলে (পুরনো এন্ট্রি) তবেই দেখায় — নাম হারায় না */}
        {company && trimmedName !== company.name && (
          <FieldCard label="Name" htmlFor="inv-name" invalid={submitted && (!trimmedName || doubleTag)}>
            <input id="inv-name" value={investedTo} maxLength={60} onChange={(e) => setInvestedTo(e.target.value)} aria-invalid={submitted && !trimmedName} className={INPUT} />
          </FieldCard>
        )}

        {(companyId !== null || customCompany) && trimmedName && savedAs !== trimmedName && (
          <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
            Saved as: <span className="font-medium text-fg">{savedAs}</span>
          </p>
        )}

        {/* Medium ও Investment No — এক লাইনে */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            <FieldCard label="Medium" htmlFor="inv-medium">
              <input
                id="inv-medium"
                value={medium}
                maxLength={60}
                onChange={(e) => setMedium(e.target.value)}
                onFocus={() => setMediumFocus(true)}
                onBlur={() => setMediumFocus(false)}
                className={INPUT}
              />
            </FieldCard>
            <FieldCard label="Investment No" htmlFor="inv-no">
              <input id="inv-no" value={platformNo} maxLength={30} placeholder="#74874" onChange={(e) => setPlatformNo(e.target.value)} className={INPUT} />
            </FieldCard>
          </div>
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

        <AmountInput card value={amount} onChange={setAmount} showError={submitted} />

        <div className="grid grid-cols-2 gap-2">
          <FieldCard label="Date" htmlFor="inv-date">
            <DateInput uid={uid} id="inv-date" value={date} onChange={setDate} variant="card" />
          </FieldCard>
          <FieldCard label="Note" htmlFor="inv-note">
            <input id="inv-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={INPUT} />
          </FieldCard>
        </div>

        {/* Duration ও Contract PDF — এক লাইনে */}
        <div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Contract PDF file" onChange={(e) => void pickPdf(e.target.files?.[0])} />
          <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-2">
            <FieldCard label="Duration" htmlFor="inv-duration">
              <input id="inv-duration" value={duration} maxLength={40} onChange={(e) => setDuration(e.target.value)} className={INPUT} />
            </FieldCard>
            {pdfFile ? (
              <div className="min-w-0 rounded-xl border border-muted/25 bg-surface px-3 pb-2 pt-2">
                <span className="block truncate text-xs text-muted">Contract PDF</span>
                <div className="flex min-h-8 items-center gap-1.5">
                  <Paperclip aria-hidden size={16} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{pdfFile.name}</span>
                  <button type="button" aria-label="Remove PDF" onClick={() => setPdfFile(null)} className="-mr-1 flex size-8 shrink-0 items-center justify-center text-expense">
                    <X aria-hidden size={16} />
                  </button>
                </div>
              </div>
            ) : hasSavedContract && initial?.contractFileId ? (
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <ContractLink fileId={initial.contractFileId} name={initial.contractName} />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove PDF"
                    disabled={!driveReady}
                    onClick={() => setConfirmRemovePdf(true)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-expense/40 text-expense disabled:opacity-60"
                  >
                    <Trash2 aria-hidden size={18} />
                  </button>
                </div>
                {confirmRemovePdf && (
                  <div role="alertdialog" aria-label="Remove PDF" className="rounded-lg border border-expense/40 p-2">
                    <p className="text-xs text-fg">Remove this PDF from your Google Drive too?</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => setConfirmRemovePdf(false)} className="min-h-10 flex-1 rounded-lg border border-muted/40 text-sm text-fg">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveContract(true);
                          setConfirmRemovePdf(false);
                        }}
                        className="min-h-10 flex-1 rounded-lg bg-expense text-sm font-medium text-canvas"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={!driveReady}
                onClick={() => fileRef.current?.click()}
                className="min-w-0 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-3 pb-2 pt-2 text-left disabled:opacity-60"
              >
                <span className="block truncate text-xs text-muted">Contract PDF</span>
                <span className="flex min-h-8 items-center gap-1.5 text-sm font-medium text-primary">
                  <Paperclip aria-hidden size={16} className="shrink-0" /> Attach PDF
                </span>
              </button>
            )}
          </div>
          {!hasSavedContract && !pdfFile && driveReady && <p className="mt-1 text-xs text-muted">PDF is saved to your Google Drive.</p>}
          {removeContract && (
            <p className="mt-1 text-xs text-muted">
              The old PDF will be removed from your Google Drive on Save.
              {!pdfFile && (
                <button type="button" onClick={() => setRemoveContract(false)} className="ml-1 font-medium text-primary underline">
                  Undo
                </button>
              )}
            </p>
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

// Excel "Investment" শীট → investments migration importer (DF12, one-time, P3)। ImportCsv.tsx-এর
// pick→review→done→error প্যাটার্ন reuse করা হয়েছে। Home Deposit/netWorthSnapshots ইচ্ছাকৃতভাবে এখানে
// নেই — lib/excelMigration.ts-এর হেডার-কমেন্ট দ্রষ্টব্য (existing P3-4/P3-5 স্ক্রিন দিয়ে ম্যানুয়ালি হবে)।
import { useState } from 'react';
import * as XLSX from 'xlsx';
import FullScreenPage from '../../common/FullScreenPage';
import { parseInvestmentSheet, type ParsedInvestmentRow, type SkippedInvestmentRow } from '../../../lib/excelMigration';
import { addInvestment } from '../../../data/investmentRepo';
import { formatAmount } from '../../../lib/format';
import { useInvestments } from '../../../hooks/useData';
import type { Investment } from '../../../validation/investmentSchema';

type Step = 'pick' | 'review' | 'done' | 'error';

/** নাম-ভিত্তিক idempotent guard (catalogRepo-এর addCategory/addLabel-এর প্যাটার্নের অনুরূপ, C-Improvement
 *  2026-09-18) — investedTo+date+principalMinor মিললে সেটা আগেই migrate হয়ে গেছে ধরে skip হয়। */
function isDuplicate(row: ParsedInvestmentRow, existing: Investment[]): boolean {
  return existing.some(
    (e) => e.investedTo === row.input.investedTo && e.date === row.input.date && e.principalMinor === row.input.principalMinor,
  );
}

export default function ImportExcelInvestments({ uid, onClose }: { uid: string; onClose: () => void }) {
  const investments = useInvestments(uid);
  const existing = investments.state.status === 'ready' ? investments.state.data : [];

  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ParsedInvestmentRow[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [skipped, setSkipped] = useState<SkippedInvestmentRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const { rows: parsed, skipped: sk } = parseInvestmentSheet(wb);
      const dupes = parsed.filter((r) => isDuplicate(r, existing));
      const fresh = parsed.filter((r) => !isDuplicate(r, existing));
      setDuplicateCount(dupes.length);
      setSkipped(sk);
      setRows(fresh);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel file পড়া যায়নি');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    setBusy(true);
    setError('');
    try {
      for (const r of rows) {
        await addInvestment(uid, r.input);
      }
      setImportedCount(rows.length);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenPage title="Migrate Investments from Excel" onBack={onClose}>
      {step === 'pick' && (
        <div>
          <p className="text-sm text-muted">
            owner-এর সর্বশেষ সংশোধিত Excel ফাইল ({'.xlsx'}) বেছে নিন — শুধু "Investment" শীটের প্রথম টেবিল পড়া হবে।
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={(e) => void handleFile(e.target.files)}
            className="mt-4 block text-sm text-fg"
          />
          {busy && <p className="mt-4 text-sm text-muted">Reading…</p>}
        </div>
      )}

      {step === 'review' && (
        <div>
          <p className="text-sm text-fg">{rows.length} investment(s) ready to import</p>
          {duplicateCount > 0 && <p className="mt-1 text-xs text-muted">{duplicateCount} already imported earlier, skipped.</p>}
          {skipped.length > 0 && (
            <div className="mt-2 rounded-lg border border-muted/30 p-3">
              <p className="text-xs font-medium text-fg">{skipped.length} row(s) could not be read:</p>
              <ul className="mt-1 space-y-1">
                {skipped.map((s, i) => (
                  <li key={i} className="text-xs text-muted">
                    Row {s.rowIndex}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border border-muted/30 p-3">
                <p className="text-sm font-medium text-fg">{r.input.investedTo}</p>
                <p className="text-xs text-muted">
                  {r.input.date} · {r.input.medium} · Principal {formatAmount(r.input.principalMinor)}
                  {(r.input.repayments?.length ?? 0) > 0 &&
                    ` · Repaid ${formatAmount(r.input.repayments![0].amountMinor)} on ${r.input.repayments![0].date}`}
                </p>
              </div>
            ))}
          </div>
          {rows.length === 0 && <p className="mt-3 text-sm text-muted">নতুন কোনো এন্ট্রি নেই — সবকিছু আগেই migrate হয়ে গেছে।</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setStep('pick')} disabled={busy} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
              Back
            </button>
            <button
              type="button"
              onClick={() => void confirmImport()}
              disabled={busy || rows.length === 0}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-40"
            >
              Import {rows.length}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div>
          <p className="text-base font-semibold text-fg">✅ Import Complete</p>
          <p className="mt-2 text-sm text-fg">{importedCount} investment(s) imported</p>
          <p className="mt-2 text-xs text-muted">
            প্রতিটা entry-র Outcome ডিফল্ট "Running" — চলমান-বন্ধ/আইনি-প্রক্রিয়াধীন এন্ট্রি (যদি থাকে) Investments স্ক্রিন থেকে ম্যানুয়ালি "Doubtful"/"Written-off" সেট করে নিন।
          </p>
          <button type="button" onClick={onClose} className="mt-6 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas">
            Done
          </button>
        </div>
      )}

      {step === 'error' && (
        <div>
          <p role="alert" className="text-sm text-fg">
            {error}
          </p>
          <button type="button" onClick={() => setStep('pick')} className="mt-4 min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
            Retry
          </button>
        </div>
      )}
    </FullScreenPage>
  );
}

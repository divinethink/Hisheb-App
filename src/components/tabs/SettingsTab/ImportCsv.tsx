import { useMemo, useState } from 'react';
import { dateRangeOf, dedupeRows, mergeParseResults, parseSpendeeCsv, type ParsedRow, type ParseResult, type SkippedRow } from '../../../lib/csvImport';
import { addCategory, addLabel } from '../../../data/catalogRepo';
import { getExistingImportKeys, importTransactionsBatch } from '../../../data/transactionRepo';
import type { TransactionInput } from '../../../validation/transactionSchema';

type Decision = 'keepAll' | 'deleteExtra';
type Step = 'pick' | 'review' | 'done' | 'error';

interface ReviewGroup {
  key: string;
  rows: ParsedRow[];
}

const REASON_LABEL: Record<SkippedRow['reason'], string> = {
  'sign-mismatch': 'Type/Amount sign mismatch (Expense should be negative, Income positive)',
  'invalid-type': 'Unrecognized Type (only Expense/Income supported)',
  'invalid-date': 'Unreadable Date',
  'invalid-amount': 'Unreadable Amount',
  'missing-category': 'Missing Category name',
};

/** Roadmap §২: mismatch কখনো silently auto-fix/drop হয় না — owner-কে row-বাই-row দেখানো হয়। */
function SkippedRowsPanel({ rows }: { rows: SkippedRow[] }) {
  const byReason = new Map<SkippedRow['reason'], SkippedRow[]>();
  for (const r of rows) byReason.set(r.reason, [...(byReason.get(r.reason) ?? []), r]);
  return (
    <div className="mt-3 space-y-3">
      {[...byReason.entries()].map(([reason, list]) => (
        <div key={reason} className="rounded-lg border border-muted/30 p-3">
          <p className="text-xs font-medium text-fg">
            {REASON_LABEL[reason]} ({list.length})
          </p>
          <ul className="mt-1 space-y-1">
            {list.slice(0, 20).map((s, i) => (
              <li key={i} className="text-xs text-muted">
                Row {s.rowIndex + 2}: {s.raw['Date'] ?? '?'} · {s.raw['Category name'] ?? '?'} · {s.raw['Amount'] ?? '?'}
              </li>
            ))}
            {list.length > 20 && <li className="text-xs text-muted">…and {list.length - 20} more</li>}
          </ul>
        </div>
      ))}
      <p className="text-xs text-muted">These rows were not imported. Add them manually from Home if needed.</p>
    </div>
  );
}

export default function ImportCsv({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // pick 
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const skippedCount = skippedRows.length;
  const [autoMergedCount, setAutoMergedCount] = useState(0);
  const [alreadyImportedCount, setAlreadyImportedCount] = useState(0);

  // review
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [pendingRows, setPendingRows] = useState<ParsedRow[]>([]); // newRows (post already-imported filter)

  // done
  const [importedCount, setImportedCount] = useState(0);

  const allDecided = useMemo(() => reviewGroups.every((g) => decisions[g.key]), [reviewGroups, decisions]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const results: ParseResult[] = [];
      for (const f of Array.from(files)) {
        const text = await f.text();
        results.push(parseSpendeeCsv(text));
      }
      const merged = mergeParseResults(results);
      setSkippedRows(merged.skipped);

      const first = dedupeRows(merged.rows); // (ক) same-second auto-collapse — কখনো silent না (B3)
      setAutoMergedCount(first.autoMerged.length);

      const range = dateRangeOf(first.kept);
      const existingKeys = range ? await getExistingImportKeys(uid, range.min, range.max) : new Set<string>();
      const newRows = first.kept.filter((r) => !existingKeys.has(r.importKey));
      setAlreadyImportedCount(first.kept.length - newRows.length);

      const second = dedupeRows(newRows); // (খ) amount+category+date, সেকেন্ড ভিন্ন → review
      setPendingRows(newRows);
      if (second.reviewGroups.length > 0) {
        setReviewGroups(second.reviewGroups.map((rows, i) => ({ key: `g${i}`, rows })));
        setStep('review');
      } else {
        await finalize(newRows);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  async function finalize(rows: ParsedRow[]) {
    setBusy(true);
    setError('');
    try {
      const catIds = new Map<string, string>();
      const lblIds = new Map<string, string>();
      const typeByName = new Map<string, 'income' | 'expense'>();
      for (const r of rows) if (!typeByName.has(r.categoryName)) typeByName.set(r.categoryName, r.type);
      for (const name of new Set(rows.map((r) => r.categoryName))) {
        // নতুন category হলে CSV row-এর type থেকেই সঠিকভাবে সিড হয়; আগে থেকে থাকলে addCategory অপরিবর্তিত রাখে।
        catIds.set(name, (await addCategory(uid, { name, type: typeByName.get(name) ?? null })).id);
      }
      for (const name of new Set(rows.map((r) => r.labelName).filter((n): n is string => !!n))) {
        lblIds.set(name, (await addLabel(uid, name)).id);
      }
      const inputs: TransactionInput[] = rows.map((r) => ({
        date: r.date,
        type: r.type,
        occurredAt: r.occurredAt,
        amountMinor: r.amountMinor,
        currency: 'BDT',
        categoryId: catIds.get(r.categoryName)!,
        categoryName: r.categoryName,
        labelIds: r.labelName ? [lblIds.get(r.labelName)!] : [],
        labelNames: r.labelName ? [r.labelName] : [],
        note: r.note,
        deleted: false,
        importKey: r.importKey,
      }));
      const written = await importTransactionsBatch(uid, inputs);
      setImportedCount(written);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  function setDecision(key: string, d: Decision) {
    setDecisions((prev) => ({ ...prev, [key]: d }));
  }

  async function applyReview() {
    const excluded = new Set<ParsedRow>();
    for (const g of reviewGroups) {
      if (decisions[g.key] === 'deleteExtra') {
        for (const r of g.rows.slice(1)) excluded.add(r);
      }
    }
    await finalize(pendingRows.filter((r) => !excluded.has(r)));
  }

  function skipAllReview() {
    const d: Record<string, Decision> = {};
    for (const g of reviewGroups) d[g.key] = 'keepAll';
    setDecisions(d);
    void finalize(pendingRows);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b border-muted/20 px-4 py-3">
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-fg" aria-label="Close">
          ‹
        </button>
        <h2 className="text-base font-semibold text-fg">Import Spendee CSV</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {step === 'pick' && (
          <div>
            <p className="text-sm text-muted">Select one or more Spendee CSV export files.</p>
            <input
              type="file"
              accept=".csv"
              multiple
              disabled={busy}
              onChange={(e) => void handleFiles(e.target.files)}
              className="mt-4 block text-sm text-fg"
            />
            {busy && <p className="mt-4 text-sm text-muted">Importing…</p>}
          </div>
        )}

        {step === 'review' && (
          <div>
            <p className="text-sm text-fg">
              {reviewGroups.length} decision{reviewGroups.length === 1 ? '' : 's'} required
            </p>
            <p className="mt-1 text-xs text-muted">
              {autoMergedCount} duplicates were auto-merged (same-second duplicate-save bug). {alreadyImportedCount} already imported, skipped.
              {skippedCount > 0 && ` ${skippedCount} rows need review.`}
            </p>
            {skippedCount > 0 && (
              <>
                <button type="button" onClick={() => setShowSkipped((v) => !v)} className="mt-2 text-xs font-medium text-primary underline">
                  {showSkipped ? 'Hide' : 'View'} {skippedCount} rows needing review
                </button>
                {showSkipped && <SkippedRowsPanel rows={skippedRows} />}
              </>
            )}
            <div className="mt-4 space-y-3">
              {reviewGroups.map((g) => (
                <div key={g.key} className="rounded-lg border border-muted/30 p-3">
                  <p className="text-sm font-medium text-fg">
                    {g.rows[0].categoryName} · −{(g.rows[0].amountMinor / 100).toFixed(2)}
                  </p>
                  {g.rows.map((r, i) => (
                    <p key={i} className="text-xs text-muted">
                      {r.date} · {r.occurredAt.toISOString().slice(11, 19)} UTC
                    </p>
                  ))}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision(g.key, 'keepAll')}
                      className={`min-h-11 rounded-lg border px-3 text-sm ${decisions[g.key] === 'keepAll' ? 'border-primary bg-primary text-canvas' : 'border-muted/40 text-fg'}`}
                    >
                      Keep both
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision(g.key, 'deleteExtra')}
                      className={`min-h-11 rounded-lg border px-3 text-sm ${decisions[g.key] === 'deleteExtra' ? 'border-primary bg-primary text-canvas' : 'border-muted/40 text-fg'}`}
                    >
                      Delete extra
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between gap-2">
              <button type="button" onClick={skipAllReview} disabled={busy} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
                Skip All
              </button>
              <button
                type="button"
                onClick={() => void applyReview()}
                disabled={busy || !allDecided}
                className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-40"
              >
                Apply ({Object.keys(decisions).length}/{reviewGroups.length})
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div>
            <p className="text-base font-semibold text-fg">✅ Import Complete</p>
            <p className="mt-2 text-sm text-fg">{importedCount} transactions imported</p>
            {autoMergedCount > 0 && <p className="mt-1 text-sm text-muted">{autoMergedCount} duplicates were auto-merged.</p>}
            {alreadyImportedCount > 0 && <p className="mt-1 text-sm text-muted">{alreadyImportedCount} were already imported, skipped.</p>}
            {skippedCount > 0 && (
              <>
                <p className="mt-1 text-sm text-muted">{skippedCount} rows need review — not imported.</p>
                <button type="button" onClick={() => setShowSkipped((v) => !v)} className="mt-1 text-xs font-medium text-primary underline">
                  {showSkipped ? 'Hide' : 'View'} details
                </button>
                {showSkipped && <SkippedRowsPanel rows={skippedRows} />}
              </>
            )}
            <button type="button" onClick={onClose} className="mt-6 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas">
              Done
            </button>
          </div>
        )}

        {step === 'error' && (
          <div>
            <p role="alert" className="text-sm text-fg">
              Import failed: {error}
            </p>
            <button type="button" onClick={() => setStep('pick')} className="mt-4 min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

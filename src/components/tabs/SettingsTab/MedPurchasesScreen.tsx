// Menu → ক্রয় তালিকা: ওষুধ/ল্যাব টেস্ট/অপারেশন খরচের তালিকা — নাম | ডোজ | মূল্য | তারিখ (+ ধরন, রোগী)। সার্চ, যোগ, এডিট, ডিলিট, "View" (ফর্দ)।
import { lazy, Suspense, useMemo, useState } from 'react';
import { FileText, Plus, Search, X } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import { useMedPurchases, useSettings } from '../../../hooks/useData';
import { formatTaka } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { KIND_LABEL, filterPurchases, patientsOf, sortPurchases, totalMinor, yearsOf } from '../../../lib/medPurchaseCalc';
import { MED_KINDS, type MedKind, type MedPurchase } from '../../../validation/medPurchaseSchema';
import MedPurchaseSheet from './MedPurchaseSheet';

const MedMemoScreen = lazy(() => import('./MedMemoScreen'));

type Sheet = { kind: 'add' } | { kind: 'edit'; id: string } | null;

export default function MedPurchasesScreen({ uid, onClose }: { uid: string; onClose: () => void }) {
  const q = useMedPurchases(uid);
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  const [sheet, setSheet] = useState<Sheet>(null);
  const [memo, setMemo] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MedKind | 'all'>('all');
  const [year, setYear] = useState('all');
  const [lastPatient, setLastPatient] = useState(''); // এই সেশনে সর্বশেষ ব্যবহৃত রোগী — পরের এন্ট্রিতে ডিফল্ট

  const ready = q.state.status === 'ready';
  const all = useMemo<MedPurchase[]>(() => (q.state.status === 'ready' ? q.state.data : []), [q.state]);
  const years = useMemo(() => yearsOf(all), [all]);
  const patients = useMemo(() => patientsOf(all), [all]);
  const knownNames = useMemo(() => all.map((p) => ({ name: p.name, kind: p.kind })), [all]);
  const rows = useMemo(
    () =>
      sortPurchases(
        filterPurchases(all, {
          query,
          kind,
          from: year === 'all' ? undefined : `${year}-01-01`,
          to: year === 'all' ? undefined : `${year}-12-31`,
        }),
      ),
    [all, query, kind, year],
  );
  const editItem = sheet?.kind === 'edit' ? all.find((p) => p.id === sheet.id) : undefined;

  const chip = (on: boolean) =>
    `min-h-9 shrink-0 rounded-full border px-3.5 text-sm ${on ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-transparent bg-muted/10 text-muted'}`;

  return (
    <FullScreenPage
      title="ক্রয় তালিকা"
      onBack={onClose}
      actions={
        <>
          <button type="button" aria-label="View memo" onClick={() => setMemo(true)} className="flex h-11 w-11 items-center justify-center rounded-lg text-primary">
            <FileText aria-hidden size={20} />
          </button>
          <button
            type="button"
            aria-label={searching ? 'Close search' : 'Search'}
            aria-pressed={searching}
            onClick={() => {
              setSearching((s) => !s);
              setQuery('');
            }}
            className={`flex h-11 w-11 items-center justify-center rounded-lg ${searching ? 'text-primary' : 'text-muted'}`}
          >
            {searching ? <X aria-hidden size={20} /> : <Search aria-hidden size={20} />}
          </button>
        </>
      }
      footer={
        <button type="button" onClick={() => setSheet({ kind: 'add' })} className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg bg-primary text-sm font-medium text-canvas">
          <Plus aria-hidden size={16} /> Add purchase
        </button>
      }
    >
      {searching && (
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="নাম, ডোজ, রোগী বা নোট খুঁজুন"
          aria-label="Search purchases"
          className="mb-3 min-h-11 w-full rounded-xl border border-muted/20 bg-surface px-3 text-sm text-fg outline-none focus:border-primary"
        />
      )}

      {!ready ? (
        <SkeletonLoader />
      ) : (
        <>
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')} className={chip(kind === 'all')}>সব</button>
            {MED_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          {years.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              <button type="button" aria-pressed={year === 'all'} onClick={() => setYear('all')} className={chip(year === 'all')}>সব বছর</button>
              {years.map((y) => (
                <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)} className={chip(year === y)}>
                  {y}
                </button>
              ))}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between rounded-2xl bg-primary/5 px-4 py-3">
            <span className="text-sm text-muted">{rows.length}টি ক্রয়</span>
            <span className="text-lg font-semibold tabular-nums text-fg">{formatTaka(totalMinor(rows))}</span>
          </div>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{all.length === 0 ? 'এখনো কিছু যোগ করা হয়নি। নিচের বাটনে চাপুন।' : 'কিছু মেলেনি।'}</p>
          ) : (
            <ul className="divide-y divide-muted/10 overflow-hidden rounded-2xl border border-muted/10 bg-canvas">
              {rows.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSheet({ kind: 'edit', id: p.id })}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[15px] font-medium text-fg">
                        {p.name}
                        {p.dose && <span className="font-normal text-muted"> · {p.dose}</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {formatDisplayDate(p.date, dateFormat)} · {KIND_LABEL[p.kind]}
                        {p.patient ? ` · ${p.patient}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-base font-semibold tabular-nums text-fg">{formatTaka(p.amountMinor)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {sheet?.kind === 'add' && (
        <MedPurchaseSheet uid={uid} knownNames={knownNames} knownPatients={patients} defaultPatient={lastPatient} onPatientUsed={setLastPatient} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'edit' && editItem && (
        <MedPurchaseSheet uid={uid} item={editItem} knownNames={knownNames} knownPatients={patients} defaultPatient={lastPatient} onPatientUsed={setLastPatient} onClose={() => setSheet(null)} />
      )}
      {memo && (
        <Suspense fallback={<SkeletonLoader />}>
          <MedMemoScreen uid={uid} items={all} dateFormat={dateFormat} onClose={() => setMemo(false)} />
        </Suspense>
      )}
    </FullScreenPage>
  );
}

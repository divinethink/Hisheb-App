// ক্রয় তালিকা → "View": ফর্দ/মেমোর মতো দেখা (তারিখ-সীমা, ধরন ও রোগী বেছে)। কল্যাণ বোর্ডে জমা দেওয়ার জন্য শেয়ার/কপি করা যায়।
import { useMemo, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import DateInput from '../../common/DateInput';
import { formatTaka } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { KIND_LABEL, buildMemoText, filterPurchases, groupByKind, patientsOf, totalMinor, yearsOf } from '../../../lib/medPurchaseCalc';
import { MED_KINDS, type MedKind, type MedPurchase } from '../../../validation/medPurchaseSchema';

export default function MedMemoScreen({
  uid,
  items,
  dateFormat,
  onClose,
}: {
  uid: string;
  items: readonly MedPurchase[];
  dateFormat: 'dmy' | 'mdy';
  onClose: () => void;
}) {
  const years = useMemo(() => yearsOf(items), [items]);
  const patients = useMemo(() => patientsOf(items), [items]);
  const thisYear = years[0] ?? String(new Date().getFullYear());
  const [from, setFrom] = useState(`${thisYear}-01-01`);
  const [to, setTo] = useState(`${thisYear}-12-31`);
  const [kind, setKind] = useState<MedKind | 'all'>('all');
  const [patient, setPatient] = useState('');
  const [msg, setMsg] = useState('');

  const rows = useMemo(() => filterPurchases(items, { from, to, kind, patient }), [items, from, to, kind, patient]);
  const groups = useMemo(() => groupByKind(rows), [rows]);
  const fmt = (d: string) => formatDisplayDate(d, dateFormat);
  const period = `${fmt(from)} – ${fmt(to)}`;
  const text = () => buildMemoText(rows, { title: 'চিকিৎসা ক্রয়ের ফর্দ', period, patient, fmtDate: fmt });

  async function share() {
    setMsg('');
    try {
      if (navigator.share) await navigator.share({ title: 'চিকিৎসা ক্রয়ের ফর্দ', text: text() });
      else {
        await navigator.clipboard.writeText(text());
        setMsg('কপি হয়েছে।');
      }
    } catch {
      /* শেয়ার বাতিল করলে কিছু না */
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      setMsg('কপি হয়েছে।');
    } catch {
      setMsg('কপি করা গেল না।');
    }
  }

  const chip = (on: boolean) =>
    `min-h-9 shrink-0 rounded-full border px-3.5 text-sm ${on ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-transparent bg-muted/10 text-muted'}`;

  return (
    <FullScreenPage
      title="ক্রয়ের ফর্দ"
      onBack={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={() => void copy()} disabled={rows.length === 0} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-muted/40 text-sm disabled:opacity-40">
            <Copy aria-hidden size={16} /> Copy
          </button>
          <button type="button" onClick={() => void share()} disabled={rows.length === 0} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-40">
            <Share2 aria-hidden size={16} /> Share
          </button>
        </div>
      }
    >
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {years.map((y) => (
            <button key={y} type="button" aria-pressed={from === `${y}-01-01` && to === `${y}-12-31`} onClick={() => { setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }} className={chip(from === `${y}-01-01` && to === `${y}-12-31`)}>
              {y}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DateInput uid={uid} id="memo-from" value={from} onChange={setFrom} variant="box" />
          <DateInput uid={uid} id="memo-to" value={to} onChange={setTo} variant="box" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')} className={chip(kind === 'all')}>সব</button>
          {MED_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {patients.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" aria-pressed={patient === ''} onClick={() => setPatient('')} className={chip(patient === '')}>সব রোগী</button>
            {patients.map((p) => (
              <button key={p} type="button" aria-pressed={patient === p} onClick={() => setPatient(p)} className={chip(patient === p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <article aria-label="Memo" className="rounded-2xl border border-muted/20 bg-canvas p-4 shadow-sm">
        <h2 className="text-center text-lg font-semibold text-fg">চিকিৎসা ক্রয়ের ফর্দ</h2>
        <p className="text-center text-xs text-muted">{period}</p>
        {patient && <p className="text-center text-xs text-muted">রোগী: {patient}</p>}

        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">এই সময়ে কোনো ক্রয় নেই।</p>
        ) : (
          groups.map((g) => (
            <section key={g.kind} className="mt-4">
              <div className="flex items-baseline justify-between border-b border-muted/30 pb-1">
                <h3 className="font-semibold text-fg">{KIND_LABEL[g.kind]}</h3>
                <span className="text-sm tabular-nums text-muted">{formatTaka(g.subtotalMinor)}</span>
              </div>
              <ol className="divide-y divide-muted/10">
                {g.rows.map((p, i) => (
                  <li key={p.id} className="flex items-start gap-2 py-2 text-sm">
                    <span className="w-5 shrink-0 text-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-fg">
                        {p.name}
                        {p.dose && <span className="text-muted"> · {p.dose}</span>}
                      </span>
                      <span className="block text-xs text-muted">
                        {fmt(p.date)}
                        {!patient && p.patient ? ` · ${p.patient}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-fg">{formatTaka(p.amountMinor)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}

        <div className="mt-4 flex items-baseline justify-between border-t-2 border-fg/40 pt-2">
          <span className="font-semibold text-fg">সর্বমোট</span>
          <span className="text-lg font-semibold tabular-nums text-fg">{formatTaka(totalMinor(rows))}</span>
        </div>
      </article>
      {msg && (
        <p role="status" className="mt-2 text-center text-sm text-muted">
          {msg}
        </p>
      )}
    </FullScreenPage>
  );
}

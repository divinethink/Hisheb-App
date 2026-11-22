// ক্রয় তালিকা → "View": ফর্দ/মেমোর মতো দেখা (তারিখ-সীমা, ধরন ও রোগী বেছে)। কল্যাণ বোর্ডে জমা দেওয়ার জন্য শেয়ার/কপি করা যায়।
import { useMemo, useState } from 'react';
import { Copy, FileDown, Share2 } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import DateInput from '../../common/DateInput';
import { formatTaka } from '../../../lib/format';
import { formatDisplayDate } from '../../../lib/date';
import { KIND_LABEL, buildMemoHtml, buildMemoText, filterPurchases, groupByKind, patientsOf, totalMinor, yearsOf } from '../../../lib/medPurchaseCalc';
import { MED_KINDS, type MedKind, type MedPurchase } from '../../../validation/medPurchaseSchema';
import { Chip, KindBadge, ROW_CLS } from './MedUi';

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
  /** PDF: ফোন/ব্রাউজারের Print → "Save as PDF" (বাংলা ফন্ট ঠিকমতো আসে, নতুন লাইব্রেরি লাগে না)। */
  function savePdf() {
    setMsg('');
    const html = buildMemoHtml(rows, { title: 'চিকিৎসা ক্রয়ের ফর্দ', period, patient, fmtDate: fmt });
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.srcdoc = html;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        setMsg('PDF খোলা গেল না। Copy/Share ব্যবহার করুন।');
      }
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      setMsg('কপি হয়েছে।');
    } catch {
      setMsg('কপি করা গেল না।');
    }
  }

  return (
    <FullScreenPage
      title="ক্রয়ের ফর্দ"
      onBack={onClose}
      footer={
        <div className="flex w-full gap-2">
          <button type="button" onClick={savePdf} disabled={rows.length === 0} className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary text-sm font-semibold text-canvas shadow-md disabled:opacity-40">
            <FileDown aria-hidden size={16} /> PDF
          </button>
          <button type="button" onClick={() => void copy()} disabled={rows.length === 0} className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-muted/30 text-sm disabled:opacity-40">
            <Copy aria-hidden size={16} /> Copy
          </button>
          <button type="button" onClick={() => void share()} disabled={rows.length === 0} className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-muted/30 text-sm disabled:opacity-40">
            <Share2 aria-hidden size={16} /> Share
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-col gap-2.5">
        <div className={ROW_CLS}>
          {years.map((y) => {
            const on = from === `${y}-01-01` && to === `${y}-12-31`;
            return (
              <Chip key={y} on={on} onClick={() => { setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }}>
                {y}
              </Chip>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DateInput uid={uid} id="memo-from" value={from} onChange={setFrom} variant="box" />
          <DateInput uid={uid} id="memo-to" value={to} onChange={setTo} variant="box" />
        </div>
        <div className={ROW_CLS}>
          <Chip on={kind === 'all'} onClick={() => setKind('all')}>সব</Chip>
          {MED_KINDS.map((k) => (
            <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
        {patients.length > 0 && (
          <div className={ROW_CLS}>
            <Chip on={patient === ''} onClick={() => setPatient('')}>সব রোগী</Chip>
            {patients.map((p) => (
              <Chip key={p} on={patient === p} onClick={() => setPatient(p)}>
                {p}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <article aria-label="Memo" className="overflow-hidden rounded-3xl border border-muted/15 bg-canvas shadow-md">
        <header className="bg-primary px-5 py-5 text-center text-canvas">
          <h2 className="text-lg font-semibold tracking-wide">চিকিৎসা ক্রয়ের ফর্দ</h2>
          <p className="mt-1 text-xs text-canvas/70">{period}</p>
          {patient && <p className="text-xs text-canvas/70">রোগী: {patient}</p>}
        </header>

        <div className="px-5 pb-2 pt-1">
          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">এই সময়ে কোনো ক্রয় নেই।</p>
          ) : (
            groups.map((g) => (
              <section key={g.kind} className="mt-4">
                <div className="flex items-center gap-2.5 pb-2">
                  <KindBadge kind={g.kind} size={30} />
                  <h3 className="flex-1 font-semibold text-fg">{KIND_LABEL[g.kind]}</h3>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary">{formatTaka(g.subtotalMinor)}</span>
                </div>
                <ol className="border-t border-dashed border-muted/30">
                  {g.rows.map((p, i) => (
                    <li key={p.id} className="flex items-start gap-2 border-b border-dashed border-muted/20 py-2.5 text-sm last:border-b-0">
                      <span className="w-5 shrink-0 text-xs text-muted">{i + 1}.</span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium text-fg">
                          {p.name}
                          {p.dose && <span className="font-normal text-muted"> · {p.dose}</span>}
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
        </div>

        <footer className="mt-2 flex items-baseline justify-between border-t-2 border-dashed border-muted/40 bg-primary/5 px-5 py-4">
          <span className="font-semibold text-fg">সর্বমোট</span>
          <span className="text-2xl font-semibold tabular-nums text-primary">{formatTaka(totalMinor(rows))}</span>
        </footer>
      </article>
      {msg && (
        <p role="status" className="mt-2 text-center text-sm text-muted">
          {msg}
        </p>
      )}
    </FullScreenPage>
  );
}

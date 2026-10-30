import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import { useSettings } from '../../../hooks/useData';
import { updateSettings } from '../../../data/settingsRepo';
import {
  TAB_KEYS,
  TAB_LABEL,
  cardTitle,
  defaultLayout,
  moveCard,
  sameLayout,
  updateCard,
  type Fold,
  type OverviewLayout,
  type OverviewTabKey,
} from '../../../lib/overviewLayout';

const FOLD_LABEL: Record<Fold, string> = { fixed: 'Fixed', open: 'Open ▾', closed: 'Closed ▾' };
const FOLD_HINT = 'Fixed = always open · Open/Closed = can be folded, starts open/closed';

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="flex h-11 w-12 shrink-0 items-center justify-center">
      <span aria-hidden className={`relative inline-block h-6 w-10 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted/30'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

// Customize Overview: ড্রাফট লোকাল state-এ থাকে, "Save layout" চাপলে তবেই settings-এ যায়। Reset-ও ড্রাফটে (সেভ না করা পর্যন্ত কিছু বদলায় না)।
export default function OverviewLayoutScreen({ uid, onClose }: { uid: string; onClose: () => void }) {
  const settings = useSettings(uid);
  const saved: OverviewLayout | null = settings.state.status === 'ready' ? settings.state.data.overviewLayout : null;
  const [draft, setDraft] = useState<OverviewLayout | null>(null);
  const initial = useRef<OverviewLayout | null>(null);
  const [tab, setTab] = useState<OverviewTabKey>('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // সেভ-করা layout প্রথমবার এলে ড্রাফট শুরু (পরে অন্য ডিভাইসের বদল ড্রাফট মুছে দেবে না)
  useEffect(() => {
    if (saved && !initial.current) {
      initial.current = saved;
      setDraft(saved);
    }
  }, [saved]);

  const dirty = draft !== null && initial.current !== null && !sameLayout(draft, initial.current);

  function back() {
    if (dirty && !window.confirm('Discard your changes?')) return;
    onClose();
  }

  async function save() {
    if (busy || !draft) return;
    setBusy(true);
    setError(false);
    try {
      await updateSettings(uid, { overviewLayout: draft });
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const cards = draft ? draft.tabs[tab] : [];
  const setCards = (next: typeof cards) => draft && setDraft({ ...draft, tabs: { ...draft.tabs, [tab]: next } });

  return (
    <FullScreenPage
      title="Customize Overview"
      onBack={back}
      footer={
        <div className="w-full">
          {error && <p role="alert" className="mb-2 text-center text-sm text-expense">Couldn’t save. Try again.</p>}
          <button type="button" onClick={() => void save()} disabled={busy || !dirty} className="min-h-12 w-full rounded-2xl bg-primary text-base font-semibold text-canvas disabled:opacity-50">
            {busy ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      }
    >
      {!draft ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          {/* সব ট্যাবের জন্য এক — ট্যাবের বাইরে */}
          <section aria-label="General" className="rounded-2xl border border-muted/10 bg-surface px-3.5">
            <div className="flex min-h-12 items-center justify-between gap-3">
              <label htmlFor="ov-default-tab" className="text-sm text-fg">Open Overview on</label>
              <select
                id="ov-default-tab"
                value={draft.defaultTab}
                onChange={(e) => setDraft({ ...draft, defaultTab: e.target.value as OverviewTabKey })}
                className="min-h-10 rounded-lg border border-muted/30 bg-canvas px-2 text-sm font-medium text-primary"
              >
                {TAB_KEYS.map((k) => (
                  <option key={k} value={k}>{TAB_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 border-t border-muted/10">
              <span className="text-sm text-fg">Show insight banners</span>
              <Switch checked={draft.banners} label="Show insight banners" onChange={(v) => setDraft({ ...draft, banners: v })} />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 border-t border-muted/10">
              <span className="text-sm text-fg">Reset all tabs to default</span>
              <button type="button" onClick={() => setDraft(defaultLayout())} className="min-h-10 rounded-lg bg-primary/10 px-3 text-sm font-medium text-primary">
                Reset
              </button>
            </div>
          </section>

          <div role="tablist" aria-label="Overview period" className="mt-4 grid h-11 grid-cols-3 gap-1 rounded-2xl border border-muted/10 bg-surface p-1">
            {TAB_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`h-full rounded-xl text-sm ${tab === k ? 'bg-canvas font-semibold text-primary shadow-sm' : 'text-muted'}`}
              >
                {TAB_LABEL[k]}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-muted">Cards · order, visibility, folding</p>
          <p className="mb-2 text-xs text-muted">{FOLD_HINT}</p>

          <div className="flex items-center gap-3 rounded-2xl border border-muted/10 bg-canvas px-3.5 py-3">
            <Lock aria-hidden size={16} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">Summary (Income/Expense/Savings)</p>
              <p className="text-xs text-muted">Fixed at top · always on</p>
            </div>
          </div>

          <ul className="mt-2 space-y-2">
            {cards.map((c, i) => (
              <li key={c.id} className={`flex items-center gap-1 rounded-2xl border border-muted/10 bg-canvas py-2 pl-1.5 pr-1 ${c.visible ? '' : 'opacity-60'}`}>
                <div className="flex shrink-0 flex-col">
                  <button type="button" aria-label={`Move ${cardTitle(tab, c.id)} up`} disabled={i === 0} onClick={() => setCards(moveCard(cards, c.id, -1))} className="flex h-9 w-9 items-center justify-center text-primary disabled:text-muted/40">
                    <ArrowUp aria-hidden size={16} />
                  </button>
                  <button type="button" aria-label={`Move ${cardTitle(tab, c.id)} down`} disabled={i === cards.length - 1} onClick={() => setCards(moveCard(cards, c.id, 1))} className="flex h-9 w-9 items-center justify-center text-primary disabled:text-muted/40">
                    <ArrowDown aria-hidden size={16} />
                  </button>
                </div>
                <div className="min-w-0 flex-1 pl-1">
                  <p className="truncate text-sm font-semibold text-fg">{cardTitle(tab, c.id)}</p>
                  <select
                    aria-label={`${cardTitle(tab, c.id)} folding`}
                    value={c.fold}
                    disabled={!c.visible}
                    onChange={(e) => setCards(updateCard(cards, c.id, { fold: e.target.value as Fold }))}
                    className="mt-1 min-h-9 rounded-lg border border-muted/30 bg-surface px-2 text-xs font-medium text-primary disabled:opacity-60"
                  >
                    {(Object.keys(FOLD_LABEL) as Fold[]).map((f) => (
                      <option key={f} value={f}>{FOLD_LABEL[f]}</option>
                    ))}
                  </select>
                </div>
                <Switch checked={c.visible} label={`Show ${cardTitle(tab, c.id)}`} onChange={(v) => setCards(updateCard(cards, c.id, { visible: v }))} />
              </li>
            ))}
          </ul>
        </>
      )}
    </FullScreenPage>
  );
}

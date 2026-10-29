import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import { useCategories, useSettings } from '../../../hooks/useData';
import { updateSettings } from '../../../data/settingsRepo';
import { minorToInput, parseAmountToMinor } from '../../../lib/money';
import { formatTaka } from '../../../lib/format';

// Monthly Target (Overall budget) — আগে Menu-র ভেতরে ভাঁজ-হওয়া কার্ড ছিল; লজিক অপরিবর্তিত।
export default function BudgetScreen({ uid, onClose }: { uid: string; onClose: () => void }) {
  const settings = useSettings(uid);
  const saved = settings.state.status === 'ready' ? settings.state.data.overallMonthlyBudgetMinor : null;
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const minor = input.trim() === '' ? null : parseAmountToMinor(input);
    if (input.trim() !== '' && minor === null) return;
    setBusy(true);
    try {
      await updateSettings(uid, { overallMonthlyBudgetMinor: minor });
      setInput('');
    } finally {
      setBusy(false);
    }
  }

  const savedPct = settings.state.status === 'ready' ? settings.state.data.savingsTargetPct : null;
  const savedGoal = settings.state.status === 'ready' ? settings.state.data.netWorthGoalMinor : null;
  const [pctInput, setPctInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const cats = useCategories(uid);
  const essential = settings.state.status === 'ready' ? settings.state.data.essentialCategories : [];
  const catNames = cats.state.status === 'ready' ? cats.state.data.filter((c) => !c.archived && c.type !== 'income').map((c) => c.name) : [];
  const savedInflation = settings.state.status === 'ready' ? settings.state.data.inflationPct : null;
  const [inflationInput, setInflationInput] = useState('');

  async function savePct() {
    if (busy) return;
    const n = pctInput.trim() === '' ? null : Number(pctInput);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 100)) return;
    setBusy(true);
    try {
      await updateSettings(uid, { savingsTargetPct: n });
      setPctInput('');
    } finally {
      setBusy(false);
    }
  }

  async function saveGoal() {
    if (busy) return;
    const minor = goalInput.trim() === '' ? null : parseAmountToMinor(goalInput);
    if (goalInput.trim() !== '' && minor === null) return;
    setBusy(true);
    try {
      await updateSettings(uid, { netWorthGoalMinor: minor });
      setGoalInput('');
    } finally {
      setBusy(false);
    }
  }

  async function saveInflation() {
    if (busy) return;
    const n = inflationInput.trim() === '' ? null : Number(inflationInput);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) return;
    setBusy(true);
    try {
      await updateSettings(uid, { inflationPct: n });
      setInflationInput('');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEssential(name: string) {
    if (busy) return;
    const next = essential.includes(name) ? essential.filter((n) => n !== name) : [...essential, name];
    setBusy(true);
    try {
      await updateSettings(uid, { essentialCategories: next });
    } finally {
      setBusy(false);
    }
  }

  const field = 'min-h-11 flex-1 rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none';
  const btn = 'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60';

  return (
    <FullScreenPage title="Monthly Target" onBack={onClose}>
      <p className="text-sm text-muted">
        {saved != null
          ? `Currently ${formatTaka(saved)} — reminders at 70% / 80% / 90% / 100% of the target.`
          : 'Not set — set a monthly spending target to get budget reminders.'}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <input
          inputMode="decimal"
          aria-label="Monthly target"
          placeholder="e.g. 30000"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^0-9.,]/g, ''))}
          className="min-h-11 flex-1 rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
        />
        <button type="button" onClick={() => void save()} disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60">
          Save
        </button>
      </div>
      {saved != null && (
        <button type="button" onClick={() => void updateSettings(uid, { overallMonthlyBudgetMinor: null })} className="mt-3 min-h-11 text-sm text-muted underline">
          Clear target (current: {minorToInput(saved)})
        </button>
      )}
      <h2 className="mt-8 text-sm font-medium text-fg">Overview লক্ষ্য</h2>
      <p className="mt-1 text-xs text-muted">
        সঞ্চয়-হার টার্গেট: {savedPct != null ? `${savedPct}%` : 'ডিফল্ট ২০%'} · সম্পদ লক্ষ্য: {savedGoal != null ? formatTaka(savedGoal) : 'ডিফল্ট ৳10,00,000'}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          inputMode="numeric"
          aria-label="Savings rate target percent"
          placeholder="সঞ্চয়-হার টার্গেট % (যেমন 20)"
          value={pctInput}
          onChange={(e) => setPctInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          className={field}
        />
        <button type="button" onClick={() => void savePct()} disabled={busy} className={btn}>Save</button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          inputMode="decimal"
          aria-label="Net worth goal"
          placeholder="সম্পদ লক্ষ্য (যেমন 1000000)"
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value.replace(/[^0-9.,]/g, ''))}
          className={field}
        />
        <button type="button" onClick={() => void saveGoal()} disabled={busy} className={btn}>Save</button>
      </div>
      <p className="mt-4 text-xs text-muted">মূল্যস্ফীতি (বছরে): {savedInflation != null ? `${savedInflation}%` : 'সেট করা নেই'} — Yearly-তে "আসল বৃদ্ধি" হিসাবে লাগে</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          inputMode="decimal"
          aria-label="Inflation percent"
          placeholder="মূল্যস্ফীতি % (যেমন 9)"
          value={inflationInput}
          onChange={(e) => setInflationInput(e.target.value.replace(/[^0-9.]/g, '').slice(0, 5))}
          className={field}
        />
        <button type="button" onClick={() => void saveInflation()} disabled={busy} className={btn}>Save</button>
      </div>
      {savedInflation != null && (
        <button type="button" onClick={() => void updateSettings(uid, { inflationPct: null })} className="mt-3 min-h-11 text-sm text-muted underline">
          মূল্যস্ফীতি মুছুন
        </button>
      )}
      {catNames.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-medium text-fg">প্রয়োজনীয় খাত</h2>
          <p className="mt-1 text-xs text-muted">যেগুলো কমানো যায় না (যেমন বাসা-ভাড়া, বাজার) সেগুলো বেছে রাখুন — Overview-র "ছোট ফাঁক"-এ এগুলো আসবে না।</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="প্রয়োজনীয় খাত">
            {catNames.map((n) => {
              const on = essential.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => void toggleEssential(n)}
                  className={`min-h-11 rounded-full border px-3 text-sm disabled:opacity-60 ${on ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-muted/40 text-fg'}`}
                >
                  {on ? '✓ ' : ''}{n}
                </button>
              );
            })}
          </div>
        </>
      )}
      {(savedPct != null || savedGoal != null) && (
        <button type="button" onClick={() => void updateSettings(uid, { savingsTargetPct: null, netWorthGoalMinor: null })} className="mt-3 min-h-11 text-sm text-muted underline">
          লক্ষ্য মুছে ডিফল্টে ফিরুন
        </button>
      )}
    </FullScreenPage>
  );
}

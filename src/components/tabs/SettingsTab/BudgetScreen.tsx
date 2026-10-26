import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import { useSettings } from '../../../hooks/useData';
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
    </FullScreenPage>
  );
}

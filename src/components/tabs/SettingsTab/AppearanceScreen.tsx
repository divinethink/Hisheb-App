import FullScreenPage from '../../common/FullScreenPage';
import { useSettings } from '../../../hooks/useData';
import { updateSettings } from '../../../data/settingsRepo';
import { ACCENTS, normalizeAccent, type DisplayMode } from '../../../lib/theme';

const MODES: { id: DisplayMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const DATE_FORMATS: { id: 'dmy' | 'mdy'; label: string; example: string }[] = [
  { id: 'dmy', label: 'Day/Month/Year', example: '26/09/2026' },
  { id: 'mdy', label: 'Month/Day/Year', example: '09/26/2026' },
];

// UI Mockup §৮.৫: Accent Color ও Display Mode সম্পূর্ণ স্বতন্ত্র সেটিং।
export default function AppearanceScreen({ uid, onClose }: { uid: string; onClose: () => void }) {
  const s = useSettings(uid);
  const mode = s.state.status === 'ready' ? s.state.data.displayMode : 'system';
  const accent = normalizeAccent(s.state.status === 'ready' ? s.state.data.themeColor : null);
  const dateFormat = s.state.status === 'ready' ? s.state.data.dateFormat : 'dmy';

  return (
    <FullScreenPage title="Appearance" onBack={onClose}>
      <section aria-labelledby="accent-h">
        <h2 id="accent-h" className="text-sm font-medium text-fg">
          Accent Color
        </h2>
        <div role="radiogroup" aria-labelledby="accent-h" className="mt-2 flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={accent === a.id}
              aria-label={a.label}
              onClick={() => void updateSettings(uid, { themeColor: a.id })}
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {/* data-theme element-scoped: এই বৃত্তের bg-primary সেই accent-এর রং (hard-coded hex নেই) */}
              <span
                data-theme={a.id}
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-canvas ${
                  accent === a.id ? 'ring-2 ring-fg ring-offset-2 ring-offset-canvas' : ''
                }`}
              >
                {accent === a.id ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="mode-h" className="mt-8">
        <h2 id="mode-h" className="text-sm font-medium text-fg">
          Display Mode
        </h2>
        <div role="radiogroup" aria-labelledby="mode-h" className="mt-2 grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => void updateSettings(uid, { displayMode: m.id })}
              className={`min-h-11 rounded-lg border text-sm ${
                mode === m.id ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-muted/40 text-fg'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Dark mode is easier on the eyes, especially when checking balances at night. “System” follows your device setting.
        </p>
      </section>

      <section aria-labelledby="datefmt-h" className="mt-8">
        <h2 id="datefmt-h" className="text-sm font-medium text-fg">
          Date Format
        </h2>
        <div role="radiogroup" aria-labelledby="datefmt-h" className="mt-2 grid grid-cols-2 gap-2">
          {DATE_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={dateFormat === f.id}
              onClick={() => void updateSettings(uid, { dateFormat: f.id })}
              className={`min-h-11 rounded-lg border px-2 text-sm ${
                dateFormat === f.id ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-muted/40 text-fg'
              }`}
            >
              {f.label} <span className="text-muted">({f.example})</span>
            </button>
          ))}
        </div>
      </section>
    </FullScreenPage>
  );
}

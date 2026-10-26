import FullScreenPage from '../../common/FullScreenPage';
import { useSettings } from '../../../hooks/useData';
import { updateSettings } from '../../../data/settingsRepo';
import { THEMES, findTheme, type DisplayMode } from '../../../lib/theme';

const MODES: { id: DisplayMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'system', label: 'System' },
];

const DATE_FORMATS: { id: 'dmy' | 'mdy'; label: string; example: string }[] = [
  { id: 'dmy', label: 'Day/Month/Year', example: '26/09/2026' },
  { id: 'mdy', label: 'Month/Day/Year', example: '09/26/2026' },
];

// থিম-কার্ড (পূর্ণ প্যালেট, নিজে Light/Dark ঠিক করে) ও সাধারণ Display Mode — একটাই সক্রিয় থাকে।
// থিম বাছলে `themeColor` = থিম-id (schema বদল নেই); সাধারণ মোড বাছলে থিম সরে যায়, আগের accent থাকলে তা-ই থাকে।
export default function AppearanceScreen({ uid, onClose }: { uid: string; onClose: () => void }) {
  const s = useSettings(uid);
  const mode = s.state.status === 'ready' ? s.state.data.displayMode : 'system';
  const themeColor = s.state.status === 'ready' ? s.state.data.themeColor : 'blue';
  const themeId = findTheme(themeColor)?.id ?? null; // null = সাধারণ Light/Dark/Sepia/System
  const dateFormat = s.state.status === 'ready' ? s.state.data.dateFormat : 'dmy';

  return (
    <FullScreenPage title="Appearance" onBack={onClose}>
      <section aria-labelledby="theme-h">
        <h2 id="theme-h" className="text-sm font-medium text-fg">
          Themes
        </h2>
        <p className="mt-1 text-xs text-muted">A theme changes the whole palette — and sets its own Light/Dark.</p>
        <div role="radiogroup" aria-labelledby="theme-h" className="mt-2 grid grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const on = themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${t.label} (${t.tone})`}
                onClick={() => void updateSettings(uid, { themeColor: t.id })}
                className={`rounded-xl border-2 p-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  on ? 'border-primary' : 'border-muted/30'
                }`}
              >
                {/* data-theme element-scoped: preview সেই থিমের নিজস্ব রঙে (hard-coded hex নেই) */}
                <div data-theme={t.id} className="rounded-lg bg-page p-2 text-fg" aria-hidden="true">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-primary" />
                    <span className="h-1.5 w-12 rounded bg-fg/70" />
                  </div>
                  <div className="mt-2 rounded-md bg-canvas p-1.5">
                    <div className="flex justify-between text-[10px] font-semibold">
                      <span className="text-income">+৳42,008</span>
                      <span className="text-expense">−৳60</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted/25">
                      <div className="h-1.5 w-2/3 rounded-full bg-primary" />
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      <span className="h-1.5 w-4 rounded-full bg-chart1" />
                      <span className="h-1.5 w-4 rounded-full bg-chart2" />
                      <span className="h-1.5 w-4 rounded-full bg-chart3" />
                      <span className="h-1.5 w-4 rounded-full bg-chart4" />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <span className="h-4 w-4 rounded-full bg-primary" />
                  </div>
                </div>
                <div className="px-1 pb-0.5 pt-1.5">
                  <div className={`text-sm ${on ? 'font-semibold text-primary' : 'font-medium text-fg'}`}>
                    {on ? '✓ ' : ''}
                    {t.label}
                  </div>
                  <div className="text-[11px] text-muted">
                    {t.tone === 'dark' ? 'Dark' : 'Light'} · {t.hint}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="mode-h" className="mt-8">
        <h2 id="mode-h" className="text-sm font-medium text-fg">
          Display Mode
        </h2>
        <div role="radiogroup" aria-labelledby="mode-h" className="mt-2 grid grid-cols-4 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={!themeId && mode === m.id}
              onClick={() =>
                void updateSettings(uid, { displayMode: m.id, ...(themeId ? { themeColor: 'blue' } : {}) })
              }
              className={`min-h-11 rounded-lg border text-xs ${
                !themeId && mode === m.id ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-muted/40 text-fg'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Pick a theme above, or a plain mode here. Dark mode is easier on the eyes at night. Sepia is a warm, paper-like tone for long reading. “System” follows your device’s Light/Dark setting.
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

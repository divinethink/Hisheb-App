import { useState, type ReactNode } from 'react';
import { Check, Flag, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import { useCategories, useSettings } from '../../../hooks/useData';
import { updateSettings } from '../../../data/settingsRepo';
import { minorToInput, parseAmountToMinor } from '../../../lib/money';
import { formatTaka } from '../../../lib/format';

// সেকশন-কার্ড: আইকন + শিরোনাম + (ডানে) বর্তমান মান
function Section({ icon: Icon, title, value, children }: { icon: typeof Target; title: string; value?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-muted/20 bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon aria-hidden size={14} />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{title}</h2>
        {value != null && <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{value}</span>}
      </div>
      {children}
    </section>
  );
}

const FIELD_BOX = 'flex min-w-0 flex-1 items-center rounded-xl border border-muted/25 bg-canvas px-3 focus-within:border-primary';
const FIELD_INPUT = 'min-h-10 w-full min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-muted/60';
const SAVE_BTN = 'min-h-10 shrink-0 rounded-xl bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60';
const LINK_BTN = 'min-h-9 text-xs text-muted underline';

// Target & More (Overall budget + Overview লক্ষ্য + মূল্যস্ফীতি + প্রয়োজনীয় খাত) — লজিক অপরিবর্তিত, শুধু UI কার্ড-ভিত্তিক (owner-request ২০২৬-১০-৩০)।
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

  return (
    <FullScreenPage title="Target & More" onBack={onClose}>
      <div className="flex flex-col gap-2.5">
        <Section icon={Target} title="Monthly target" value={saved != null ? formatTaka(saved) : 'Not set'}>
          <p className="mt-1.5 text-xs text-muted">
            {saved != null
              ? `Currently ${formatTaka(saved)} — reminders at 70% / 80% / 90% / 100% of the target.`
              : 'Not set — set a monthly spending target to get budget reminders.'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className={FIELD_BOX}>
              <input
                inputMode="decimal"
                aria-label="Monthly target"
                placeholder="e.g. 30000"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                className={FIELD_INPUT}
              />
            </div>
            <button type="button" onClick={() => void save()} disabled={busy} className={SAVE_BTN}>
              Save
            </button>
          </div>
          {saved != null && (
            <button type="button" onClick={() => void updateSettings(uid, { overallMonthlyBudgetMinor: null })} className={`mt-0.5 ${LINK_BTN}`}>
              Clear target (current: {minorToInput(saved)})
            </button>
          )}
        </Section>

        <Section icon={Flag} title="Overview লক্ষ্য">
          <div className="mt-2 flex flex-col gap-2">
            <div>
              <p className="mb-0.5 flex items-center justify-between text-xs text-muted">
                <span>সঞ্চয়-হার টার্গেট</span>
                <span className="font-medium text-fg">{savedPct != null ? `${savedPct}%` : 'ডিফল্ট ২০%'}</span>
              </p>
              <div className="flex items-center gap-2">
                <div className={FIELD_BOX}>
                  <input
                    inputMode="numeric"
                    aria-label="Savings rate target percent"
                    placeholder="সঞ্চয়-হার টার্গেট % (যেমন 20)"
                    value={pctInput}
                    onChange={(e) => setPctInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                    className={FIELD_INPUT}
                  />
                </div>
                <button type="button" onClick={() => void savePct()} disabled={busy} className={SAVE_BTN}>Save</button>
              </div>
            </div>
            <div>
              <p className="mb-0.5 flex items-center justify-between text-xs text-muted">
                <span>সম্পদ লক্ষ্য</span>
                <span className="font-medium text-fg">{savedGoal != null ? formatTaka(savedGoal) : 'ডিফল্ট ৳10,00,000'}</span>
              </p>
              <div className="flex items-center gap-2">
                <div className={FIELD_BOX}>
                  <input
                    inputMode="decimal"
                    aria-label="Net worth goal"
                    placeholder="সম্পদ লক্ষ্য (যেমন 1000000)"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className={FIELD_INPUT}
                  />
                </div>
                <button type="button" onClick={() => void saveGoal()} disabled={busy} className={SAVE_BTN}>Save</button>
              </div>
            </div>
          </div>
          {(savedPct != null || savedGoal != null) && (
            <button type="button" onClick={() => void updateSettings(uid, { savingsTargetPct: null, netWorthGoalMinor: null })} className={`mt-0.5 ${LINK_BTN}`}>
              লক্ষ্য মুছে ডিফল্টে ফিরুন
            </button>
          )}
        </Section>

        <Section icon={TrendingUp} title="মূল্যস্ফীতি (বছরে)" value={savedInflation != null ? `${savedInflation}%` : 'সেট করা নেই'}>
          <p className="mt-1.5 text-xs text-muted">Yearly-তে "আসল বৃদ্ধি" হিসাবে লাগে।</p>
          <div className="mt-2 flex items-center gap-2">
            <div className={FIELD_BOX}>
              <input
                inputMode="decimal"
                aria-label="Inflation percent"
                placeholder="মূল্যস্ফীতি % (যেমন 9)"
                value={inflationInput}
                onChange={(e) => setInflationInput(e.target.value.replace(/[^0-9.]/g, '').slice(0, 5))}
                className={FIELD_INPUT}
              />
            </div>
            <button type="button" onClick={() => void saveInflation()} disabled={busy} className={SAVE_BTN}>Save</button>
          </div>
          {savedInflation != null && (
            <button type="button" onClick={() => void updateSettings(uid, { inflationPct: null })} className={`mt-0.5 ${LINK_BTN}`}>
              মূল্যস্ফীতি মুছুন
            </button>
          )}
        </Section>

        {catNames.length > 0 && (
          <Section icon={ShieldCheck} title="প্রয়োজনীয় খাত" value={`${catNames.filter((n) => essential.includes(n)).length}/${catNames.length}`}>
            <p className="mt-1.5 text-xs text-muted">যেগুলো কমানো যায় না (যেমন বাসা-ভাড়া, বাজার) সেগুলো বেছে রাখুন — Overview-র "ছোট ফাঁক"-এ এগুলো আসবে না।</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label="প্রয়োজনীয় খাত">
              {catNames.map((n) => {
                const on = essential.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => void toggleEssential(n)}
                    className={`flex min-h-10 items-center gap-2 rounded-xl border px-2 py-1 text-left text-[13px] leading-tight disabled:opacity-60 ${on ? 'border-primary/60 bg-primary/10 font-medium text-primary' : 'border-muted/25 bg-canvas text-fg'}`}
                  >
                    <span aria-hidden className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${on ? 'border-primary bg-primary text-canvas' : 'border-muted/40'}`}>
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="line-clamp-2 min-w-0 break-words">{n}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </FullScreenPage>
  );
}

import { BarChart3, BookOpen, Home, Menu, Wallet, type LucideIcon } from 'lucide-react';

export type TabId = 'home' | 'ledger' | 'networth' | 'overview' | 'menu';

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'ledger', label: 'Ledger', Icon: BookOpen },
  { id: 'networth', label: 'Net Worth', Icon: Wallet },
  { id: 'overview', label: 'Overview', Icon: BarChart3 },
  { id: 'menu', label: 'Menu', Icon: Menu },
];

// Active: filled icon + bold label; inactive: outline (UI Mockup)। Menu badge-dot: DF16 ("Review Duplicates pending" persist হয় না বলে স্থগিত)
export default function BottomNav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav
      aria-label="Main"
      className="grid shrink-0 grid-cols-5 border-t border-muted/10"
      // থিম ঐচ্ছিক --nav-* টোকেন বসালে সেটা, নইলে আগের canvas/muted/primary (অন্য থিমে চেহারা অপরিবর্তিত)
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', background: 'rgb(var(--nav-bg, var(--color-canvas)))' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const on = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => onChange(id)}
            style={{ color: on ? 'rgb(var(--nav-fg-active, var(--color-primary)))' : 'rgb(var(--nav-fg, var(--color-muted)))' }}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              on ? 'font-semibold' : ''
            }`}
          >
            <span
              className="flex items-center justify-center rounded-full px-3.5 py-1"
              style={on ? { background: 'rgb(var(--nav-pill, var(--color-primary) / 0.1))' } : undefined}
            >
              <Icon aria-hidden size={21} strokeWidth={on ? 2.4 : 1.75} />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

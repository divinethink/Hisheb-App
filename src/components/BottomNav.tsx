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
      className="grid shrink-0 grid-cols-5 border-t border-muted/10 bg-canvas"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const on = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              on ? 'font-semibold text-primary' : 'text-muted'
            }`}
          >
            <span className={`flex items-center justify-center rounded-full px-3.5 py-1 ${on ? 'bg-primary/10' : ''}`}>
              <Icon aria-hidden size={21} strokeWidth={on ? 2.4 : 1.75} />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

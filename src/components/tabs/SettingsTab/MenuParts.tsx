import type { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import Card from '../../common/Card';

// Menu-র ছোট UI-অংশ (শুধু presentation)। রঙ বিদ্যমান chart-টোকেন থেকে — Light/Dark/Sepia তিনেই মেলে।
export type Tint = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'muted' | 'danger';
const TINT: Record<Tint, string> = {
  c1: 'bg-chart1/15 text-chart1',
  c2: 'bg-chart2/15 text-chart2',
  c3: 'bg-chart3/15 text-chart3',
  c4: 'bg-chart4/15 text-chart4',
  c5: 'bg-chart5/15 text-chart5',
  c6: 'bg-chart6/15 text-chart6',
  c7: 'bg-chart7/15 text-chart7',
  muted: 'bg-muted/15 text-muted',
  danger: 'bg-expense/15 text-expense',
};

export function TintIcon({ icon: Icon, tint, size = 36 }: { icon: LucideIcon; tint: Tint; size?: number }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-xl ${TINT[tint]}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.52)} />
    </span>
  );
}

export function MenuSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      {title && <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>}
      <Card className="divide-y divide-muted/10 overflow-hidden">{children}</Card>
    </section>
  );
}

const rowBase = 'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

export function MenuRow({
  icon,
  tint,
  label,
  value,
  onClick,
  danger = false,
}: {
  icon: LucideIcon;
  tint: Tint;
  label: string;
  value?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={`${rowBase} ${danger ? 'text-expense' : 'text-fg'}`}>
      <TintIcon icon={icon} tint={danger ? 'danger' : tint} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value && <span className="shrink-0 text-sm text-muted">{value}</span>}
      <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
    </button>
  );
}

export function ToggleRow({
  icon,
  tint,
  label,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  tint: Tint;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`${rowBase} text-fg`}>
      <TintIcon icon={icon} tint={tint} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span aria-hidden className={`relative inline-block h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted/30'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Tile({ icon, tint, title, sub, onClick }: { icon: LucideIcon; tint: Tint; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col items-start gap-1 rounded-2xl border border-muted/10 bg-canvas p-3 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <TintIcon icon={icon} tint={tint} />
      <span className="mt-1 w-full truncate text-sm font-medium text-fg">{title}</span>
      <span className="w-full truncate text-xs text-muted">{sub}</span>
    </button>
  );
}

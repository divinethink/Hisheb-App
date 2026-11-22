// ক্রয় তালিকার শেয়ার্ড UI অংশ: স্ক্রলবার-লুকানো চিপ-সারি, চিপ, ধরন-আইকন।
import type { ReactNode } from 'react';
import { ClipboardList, FlaskConical, Pill, Scissors, type LucideIcon } from 'lucide-react';
import { TintIcon, type Tint } from './MenuParts';
import type { MedKind } from '../../../validation/medPurchaseSchema';

/** আনুভূমিক স্ক্রল-সারি — স্ক্রলবার (নিচের ধূসর রেখা) লুকানো। */
export const ROW_CLS = 'flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const KIND_ICON: Record<MedKind, { icon: LucideIcon; tint: Tint }> = {
  medicine: { icon: Pill, tint: 'c1' },
  lab: { icon: FlaskConical, tint: 'c5' },
  operation: { icon: Scissors, tint: 'c6' },
  other: { icon: ClipboardList, tint: 'c4' },
};

export function KindBadge({ kind, size = 40 }: { kind: MedKind; size?: number }) {
  const k = KIND_ICON[kind];
  return <TintIcon icon={k.icon} tint={k.tint} size={size} />;
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full px-4 text-sm transition-colors ${
        on ? 'bg-primary font-medium text-canvas shadow-sm' : 'bg-muted/10 text-muted active:bg-muted/20'
      }`}
    >
      {children}
    </button>
  );
}

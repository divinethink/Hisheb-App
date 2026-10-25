import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * ভাঁজযোগ্য অংশ (owner-request, ২০২৬-১০-২৫) — তালিকার নিচে "শেষ হয়ে যাওয়া" আইটেম গুছিয়ে রাখতে
 * (Debts: Fully repaid, Investments: Closed)। শুধু presentation; খোলা/বন্ধ অবস্থা ক্ষণস্থায়ী (কোথাও store হয় না)।
 */
export default function CollapsibleSection({
  title,
  count,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  /** হেডারের ডানে ছোট সারাংশ (যেমন মোট শোধ) */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <section className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-2">
          {title}
          <span className="rounded-full bg-muted/10 px-2 py-0.5 text-xs">{count}</span>
        </span>
        <span className="flex items-center gap-2">
          {summary && <span className="text-xs">{summary}</span>}
          <ChevronDown aria-hidden size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div id={panelId} className="mt-1 flex flex-col gap-2">
          {children}
        </div>
      )}
    </section>
  );
}

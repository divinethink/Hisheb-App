import { Search, X } from 'lucide-react';

/**
 * তালিকার সার্চ + ফিল্টার-চিপ (owner-approved ২০২৬-১০-২৫)। আইকন হেডারে (FullScreenPage `actions`) — আলাদা জায়গা নেয় না;
 * সার্চ-সারি শুধু খুললেই দেখা যায়। শুধু presentation; filter-লজিক কল-সাইটে।
 */
export function SearchToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={open ? 'Close search' : 'Search'}
      aria-pressed={open}
      onClick={onToggle}
      className={`ml-auto flex h-11 w-11 items-center justify-center rounded-lg ${open ? 'text-primary' : 'text-muted'}`}
    >
      {open ? <X aria-hidden size={20} /> : <Search aria-hidden size={20} />}
    </button>
  );
}

export function SearchPanel<K extends string>({
  query,
  onQuery,
  placeholder,
  chips,
  active,
  onChip,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  chips: readonly (readonly [K, string])[];
  active: K;
  onChip: (k: K) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-11 w-full rounded-xl border border-muted/20 bg-surface px-3 text-sm text-fg outline-none focus:border-primary"
      />
      <div className="flex gap-2">
        {chips.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={active === k}
            onClick={() => onChip(k)}
            className={`min-h-8 rounded-full px-3 text-xs ${active === k ? 'bg-primary/10 font-medium text-primary' : 'bg-muted/10 text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

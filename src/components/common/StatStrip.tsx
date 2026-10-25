import type { ReactNode } from 'react';

/**
 * এক সারির তথ্য-কার্ড (owner-request, ২০২৬-১০-২৫): ২–৩টা লেবেল+মান পাশাপাশি, একটাই কার্ডে।
 * Debts/Investments বিস্তারিত স্ক্রিনে লাইন কমাতে। শুধু presentation।
 */
export interface StatItem {
  label: string;
  value: ReactNode;
  /** মানের রঙ (ঐচ্ছিক) */
  tone?: 'default' | 'danger';
}

export default function StatStrip({ items }: { items: readonly StatItem[] }) {
  return (
    <div className="flex rounded-2xl border border-muted/15 bg-surface py-2">
      {items.map((it) => (
        <div key={it.label} className="relative min-w-0 flex-1 border-r border-muted/15 px-1 text-center last:border-r-0">
          <p className="truncate text-[11px] text-muted">{it.label}</p>
          <div className={`mt-0.5 truncate text-sm font-semibold ${it.tone === 'danger' ? 'text-expense' : 'text-fg'}`}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

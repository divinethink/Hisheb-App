import type { LucideIcon } from 'lucide-react';

type Tone = 'income' | 'expense' | 'primary' | 'muted' | 'warning' | 'danger';

// tone → soft-bg + matching icon color, সবসময় বিদ্যমান Tailwind design-token থেকে
// (tailwind.config.ts-এর income/expense/primary/muted/warning/danger, tokens.css §৬)।
// কোনো hardcoded hex না, তাই accent/dark-mode বদলালে badge অটো-সামঞ্জস্যপূর্ণ থাকে।
const TONE_CLASSES: Record<Tone, string> = {
  income: 'bg-income/10 text-income',
  expense: 'bg-expense/10 text-expense',
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted/10 text-muted',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

/**
 * Soft-color rounded icon badge — Income/Expense/Savings/Net Worth-এর মতো summary
 * সংখ্যার পাশে ব্যবহারের জন্য (UI Polish [1_4] ধাপ ১: foundation, presentation-only,
 * কোনো নতুন ডেটা/লজিক না)। lucide-react icon component সরাসরি নেয়; পিওর presentational।
 */
export default function IconBadge({
  icon: Icon,
  tone = 'primary',
  size = 36,
  className = '',
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[tone]} ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.55)} />
    </span>
  );
}

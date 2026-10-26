import { categoryColorIndex } from '../../lib/format';

const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-8'];

/**
 * নাম/owner-color থেকে deterministic soft tint (bg + fg) — CategoryIcon avatar ও Home-এর
 * category quick-chip pill দুটোতেই reuse (UI Polish, existing chart-token palette,
 * hardcoded hex/gradient না — dark-mode-এ chart-token নিজেই বদলায় বলে অটো-সামঞ্জস্যপূর্ণ)।
 */
export function categoryTint(name: string, color?: string | null): { bg: string; fg: string } {
  if (color) return { bg: `${color}29`, fg: color };
  const v = CHART_VARS[categoryColorIndex(name, CHART_VARS.length)];
  return { bg: `rgb(var(${v}) / 0.16)`, fg: `rgb(var(${v}))` };
}

// Home লেনদেন-তালিকার জন্য থিম-নিরপেক্ষ উজ্জ্বল রঙ (বিভিন্ন category আলাদা চেনা যায়); owner-set color থাকলে সেটাই জেতে।
const VIVID = ['#3B82F6', '#10B981', '#8B5CF6', '#F97316', '#F43F5E', '#14B8A6', '#D97706', '#06B6D4', '#EC4899', '#65A30D'];

function vividTint(name: string, color?: string | null): { bg: string; fg: string } {
  const c = color || VIVID[categoryColorIndex(name, VIVID.length)];
  return { bg: `${c}33`, fg: c };
}

/**
 * নাম থেকে deterministic রঙিন বৃত্ত-আইকন — Home transaction row, Ledger module row, ও
 * Overview chart-এ একই নামের জন্য সবসময় একই রঙ (categoryColorIndex, lib/format.ts)।
 * `icon` দেওয়া থাকলে (category.icon বা keyword-inferred emoji) সেটা দেখানো হয়, নাহলে
 * নামের প্রথম অক্ষরে fallback করে। পিওর presentational — কোনো business logic না।
 */
export default function CategoryIcon({
  name,
  icon,
  color,
  size = 36,
  vivid = false,
}: {
  name: string;
  icon?: string | null;
  /** owner-set explicit hex color (category.color/label.color) — দেওয়া থাকলে নাম-ভিত্তিক auto-color-এর বদলে এটাই ব্যবহৃত হয়। */
  color?: string | null;
  size?: number;
  /** true হলে থিম-নিরপেক্ষ উজ্জ্বল রঙ (Home লেনদেন-তালিকা) */
  vivid?: boolean;
}) {
  const { bg, fg } = vivid ? vividTint(name, color) : categoryTint(name, color);
  const letter = [...name.trim()][0]?.toUpperCase() ?? '?';
  const style = { width: size, height: size, background: bg, color: fg, fontSize: size * 0.42 };
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full font-semibold" style={style}>
      {icon || letter}
    </span>
  );
}

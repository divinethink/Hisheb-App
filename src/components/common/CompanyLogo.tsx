import { safeLogo } from '../../validation/investmentCompanySchema';

// লোগো না থাকলে নামের প্রথম অক্ষর + নাম-ভিত্তিক স্থির রং (কেন্দ্রীয় chart-টোকেন, hard-coded hex নয়)।
const BADGE_BG = ['bg-chart1', 'bg-chart2', 'bg-chart3', 'bg-chart4', 'bg-chart5', 'bg-chart6', 'bg-chart7', 'bg-chart8'] as const;
const SIZE = {
  sm: 'h-8 w-8 rounded-xl text-sm',
  md: 'h-10 w-10 rounded-xl text-base',
  lg: 'h-24 w-24 rounded-3xl text-4xl',
} as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function CompanyLogo({
  name,
  logo,
  size = 'md',
}: {
  name: string;
  logo?: string | null;
  size?: keyof typeof SIZE;
}) {
  const src = safeLogo(logo);
  const base = `flex shrink-0 items-center justify-center overflow-hidden font-semibold ${SIZE[size]}`;
  if (src) {
    return <img aria-hidden alt="" src={src} className={`${base} bg-white object-cover`} />;
  }
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span aria-hidden className={`${base} text-canvas ${BADGE_BG[hash(name.trim().toLowerCase()) % BADGE_BG.length]}`}>
      {letter}
    </span>
  );
}

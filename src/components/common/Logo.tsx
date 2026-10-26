import { useId } from 'react';

/** অ্যাপ-লোগো (গাঢ় বন-সবুজ টাইল + কয়েনের ভেতর চারা) — public/logo.svg-র inline রূপ; লগইন/লক-স্ক্রিন/Menu-তে। রং ইচ্ছাকৃতভাবে স্থির (ব্র্যান্ড)। */
export default function Logo({ size = 64, className = '' }: { size?: number; className?: string }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="হিসাব-নিকাশ" className={className}>
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14532d" />
          <stop offset="1" stopColor="#052e1c" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#${gid}-bg)`} />
      <circle cx="50" cy="50" r="30" fill="#6ee7b7" fillOpacity=".1" stroke="#6ee7b7" strokeWidth="4" />
      <path d="M50 66 V47" stroke="#a7f3d0" strokeWidth="4.2" strokeLinecap="round" fill="none" />
      <path d="M50 53 C50 43 60 38 67 40 C67 50 59 55 50 53Z" fill="#6ee7b7" />
      <path d="M50 59 C50 50 42 46 34 48 C34 57 42 62 50 59Z" fill="#bbf7d0" />
      <path d="M40 68 Q50 63 60 68" fill="none" stroke="#a7f3d0" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  );
}

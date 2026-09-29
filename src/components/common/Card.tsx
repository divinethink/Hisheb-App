import type { ElementType, ReactNode } from 'react';

/**
 * পুনঃব্যবহারযোগ্য কার্ড — ধূসর page ব্যাকগ্রাউন্ডের ওপর সাদা (dark মোডে গাঢ়) rounded card।
 * UI Polish Step ১ (Design Tokens কেন্দ্রীভূত, tokens.css §৬)। বিদ্যমান bg-canvas/bg-surface
 * টোকেন অপরিবর্তিত রেখে শুধু page-এর ওপরে visual grouping দেয়।
 */
export default function Card({
  children,
  className = '',
  as = 'div',
  ariaLabel,
  role,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  ariaLabel?: string;
  role?: string;
}) {
  const As = as;
  return (
    <As role={role} aria-label={ariaLabel} className={`rounded-2xl border border-muted/10 bg-canvas shadow-sm ${className}`}>
      {children}
    </As>
  );
}

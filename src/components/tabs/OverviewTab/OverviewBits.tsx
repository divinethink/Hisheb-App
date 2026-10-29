import type { ReactNode } from 'react';
import { Info, type LucideIcon } from 'lucide-react';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';

// Overview-এর সব কার্ডের শেয়ার-করা presentational অংশ (আগে MonthlyCards/YearlyCards/GoalCards-এ তিন কপি ছিল)।
// শুধু দেখার স্টাইল — কোনো হিসাব/ডেটা/schema নেই। কার্ড-শিরোনামে আইকন-ব্যাজ, কার্ডের বাইরের নোট এখন Callout কার্ড।

type Tone = 'income' | 'expense' | 'primary' | 'muted' | 'warning';

/** Overview কার্ড: আইকন-ব্যাজ + শিরোনাম + উপ-শিরোনাম। aria-label = শিরোনাম। */
export function Block({ title, sub, icon, tone = 'primary', right, children }: { title: string; sub?: ReactNode; icon?: LucideIcon; tone?: Tone; right?: ReactNode; children: ReactNode }) {
  return (
    <Card as="section" ariaLabel={title} className="mx-4 mt-3 p-4">
      <div className="mb-3 flex items-start gap-2.5">
        {icon && <IconBadge icon={icon} tone={tone} size={30} />}
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-snug text-fg">{title}</h2>
          {sub && <p className="mt-0.5 text-xs leading-relaxed text-muted">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

/** কার্ডের ভেতরের হাইলাইট-বক্স (টিপ/সতর্কতা/ইতিবাচক)। */
export function Tip({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'income' }) {
  return (
    <p className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${tone === 'income' ? 'border-income/15 bg-income/10 text-income' : 'border-warning/15 bg-warning/10 text-warning'}`}>
      {children}
    </p>
  );
}

/** কার্ডের ভেতরের ছোট পাদটীকা। */
export function Foot({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[11px] leading-relaxed text-muted">{children}</p>;
}

/** কার্ডের বাইরের নোট (আগে খোলা ছোট লেখা ছিল) — এখন নিজের হালকা কার্ডে, আইকনসহ। */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="mx-4 mt-3 flex items-start gap-2.5 rounded-2xl border border-primary/15 bg-primary/5 px-3.5 py-3">
      <Info aria-hidden size={16} className="mt-0.5 shrink-0 text-primary" />
      <p className="min-w-0 text-xs leading-relaxed text-fg">{children}</p>
    </div>
  );
}

/** খাতের নাম দেখানোর সময়: ভেতরের 'Others' কী অপরিবর্তিত, শুধু লেখা বাংলা। */
export const catLabel = (name: string) => (name === 'Others' ? 'অন্যান্য' : name);

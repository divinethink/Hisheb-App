import { Fragment, useId, useState, type ReactNode } from 'react';
import { ChevronDown, Info, type LucideIcon } from 'lucide-react';
import Card from '../../common/Card';
import IconBadge from '../../common/IconBadge';
import { cardTitle, type OverviewLayout, type OverviewTabKey } from '../../../lib/overviewLayout';

// Overview-এর সব কার্ডের শেয়ার-করা presentational অংশ (আগে MonthlyCards/YearlyCards/GoalCards-এ তিন কপি ছিল)।
// শুধু দেখার স্টাইল — কোনো হিসাব/ডেটা/schema নেই। কার্ড-শিরোনামে আইকন-ব্যাজ, কার্ডের বাইরের নোট এখন Callout কার্ড।

type Tone = 'income' | 'expense' | 'primary' | 'muted' | 'warning';

/** Overview কার্ড: আইকন-ব্যাজ + শিরোনাম + উপ-শিরোনাম। aria-label = শিরোনাম। */
export function Block({ title, sub, icon, tone = 'primary', right, children }: { title: string; sub?: ReactNode; icon?: LucideIcon; tone?: Tone; right?: ReactNode; children: ReactNode }) {
  return (
    <Card as="section" ariaLabel={title} className="mx-4 mt-2.5 p-3.5">
      <div className="mb-2.5 flex items-start gap-2.5">
        {icon && <IconBadge icon={icon} tone={tone} size={28} />}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-snug text-fg">{title}</h2>
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
    <p className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${tone === 'income' ? 'border-income/15 bg-income/10 text-income' : 'border-warning/15 bg-warning/10 text-warning'}`}>
      {children}
    </p>
  );
}

/** কার্ডের ভেতরের ছোট পাদটীকা। */
export function Foot({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{children}</p>;
}

/** কার্ডের বাইরের নোট — এক বা একাধিক নোট একটাই কমপ্যাক্ট কার্ডে (প্রতি নোট এক সারি, আইকনসহ)। */
export function NoteGroup({ children }: { children: ReactNode[] | ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div role="note" className="mx-4 mt-2.5 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2">
      <ul className="divide-y divide-primary/10">
        {items.map((c, i) => (
          <li key={i} className="flex items-start gap-2 py-1.5 first:pt-0.5 last:pb-0.5">
            <Info aria-hidden size={14} className="mt-0.5 shrink-0 text-primary" />
            <p className="min-w-0 text-xs leading-relaxed text-fg">{c}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** একটাই নোট — NoteGroup-এর শর্টকাট। */
export function Callout({ children }: { children: ReactNode }) {
  return <NoteGroup>{children}</NoteGroup>;
}

/** কম-দরকারি কার্ডের ভাঁজ-করা গ্রুপ — ডিফল্ট বন্ধ; খুললে তবেই ভেতরের কার্ড রেন্ডার হয়। */
export function MoreInsights({ label = 'More insights', count, defaultOpen = false, children }: { label?: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="mx-4 mt-2.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-muted/10 bg-canvas px-3.5 text-sm font-medium text-fg shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span>{label}{count ? <span className="ml-1.5 text-xs font-normal text-muted">({count})</span> : null}</span>
        <ChevronDown aria-hidden size={18} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={id} hidden={!open} className="-mx-4">{open ? children : null}</div>
    </section>
  );
}

/** Customize Overview অনুযায়ী কার্ড সাজানো: ক্রম/লুকানো/ভাঁজ। cards-এ null/false মানে কার্ডটা এখন প্রযোজ্য না (ডেটা নেই ইত্যাদি) — বাদ যায়। */
export function OrderedCards({ tab, layout, cards }: { tab: OverviewTabKey; layout: OverviewLayout; cards: Record<string, ReactNode> }) {
  return (
    <>
      {layout.tabs[tab].map((p) => {
        const node = cards[p.id];
        if (!p.visible || !node) return null;
        if (p.fold === 'fixed') return <Fragment key={p.id}>{node}</Fragment>;
        return <MoreInsights key={p.id} label={cardTitle(tab, p.id)} defaultOpen={p.fold === 'open'}>{node}</MoreInsights>;
      })}
    </>
  );
}

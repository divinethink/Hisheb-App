import { useMemo, useState } from 'react';
import { Check, PenLine, Pencil, Plus } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import CompanyLogo from '../../common/CompanyLogo';
import CompanyFormScreen from './CompanyFormScreen';
import { useInvestmentCompanies, useInvestments } from '../../../hooks/useData';
import type { InvestmentCompany } from '../../../validation/investmentCompanySchema';

/** কোম্পানি বাছাই — ফুল-পেজ (ড্রপডাউন নয়)। সার্চ, নতুন কোম্পানি যোগ, প্রতি সারিতে এডিট (✎)। */
export default function CompanyPickerScreen({
  uid,
  selectedId,
  onSelect,
  onSelectOther,
  onClose,
}: {
  uid: string;
  selectedId: string | null;
  onSelect: (c: InvestmentCompany) => void;
  /** দিলে "Other company" সারি দেখায় — কোম্পানি সেভ না করে এন্ট্রিতে নাম টাইপ */
  onSelectOther?: () => void;
  onClose: () => void;
}) {
  const companies = useInvestmentCompanies(uid);
  const investments = useInvestments(uid);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<{ initial: InvestmentCompany | null } | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    if (investments.state.status === 'ready') {
      for (const i of investments.state.data) if (i.companyId) m.set(i.companyId, (m.get(i.companyId) ?? 0) + 1);
    }
    return m;
  }, [investments.state]);

  const all = companies.state.status === 'ready' ? companies.state.data : [];

  if (form) {
    return (
      <CompanyFormScreen
        uid={uid}
        initial={form.initial}
        companies={all}
        onClose={() => setForm(null)}
        onSaved={(c) => {
          setForm(null);
          // নতুন কোম্পানি বানালে সরাসরি বাছাই হয়ে যায়; এডিটে তালিকাতেই ফেরে (বাছা থাকলে নতুন নাম/লোগো নিতে বাছাই-ই করে)
          if (!form.initial || form.initial.id === selectedId) onSelect(c);
        }}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const list = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;

  return (
    <FullScreenPage title="Choose company" onBack={onClose}>
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company"
          aria-label="Search company"
          className="min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
        />

        <button
          type="button"
          onClick={() => setForm({ initial: null })}
          className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 px-3 text-left"
        >
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-canvas">
            <Plus size={20} />
          </span>
          <span>
            <span className="block text-sm font-medium text-primary">Add new company</span>
            <span className="block text-xs text-muted">Name · Medium · Logo — saved once</span>
          </span>
        </button>

        {onSelectOther && (
          <button type="button" onClick={onSelectOther} className="flex min-h-14 items-center gap-3 rounded-2xl border border-muted/25 bg-surface px-3 text-left">
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PenLine size={20} />
            </span>
            <span>
              <span className="block text-sm font-medium text-fg">Other company</span>
              <span className="block text-xs text-muted">Just type a name — not saved</span>
            </span>
          </button>
        )}

        {companies.state.status === 'loading' && <SkeletonLoader />}
        {companies.state.status === 'error' && (
          <div role="alert" className="rounded-lg bg-surface p-4 text-center">
            <p className="text-sm text-fg">Couldn’t load companies.</p>
            <button type="button" onClick={companies.retry} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
              Retry
            </button>
          </div>
        )}

        {companies.state.status === 'ready' &&
          (list.length === 0 ? (
            <p className="py-8 text-center text-muted">{q ? 'No match.' : 'No companies yet.'}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((c) => {
                const n = counts.get(c.id) ?? 0;
                const active = c.id === selectedId;
                return (
                  <li key={c.id} className={`flex items-center rounded-2xl border bg-surface ${active ? 'border-primary' : 'border-muted/15'}`}>
                    <button
                      type="button"
                      onClick={() => onSelect(c)}
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left active:bg-muted/10"
                    >
                      <CompanyLogo name={c.name} logo={c.logo} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {[c.medium, `${n} ${n === 1 ? 'entry' : 'entries'}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {active && <Check aria-hidden size={18} className="text-primary" />}
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => setForm({ initial: c })}
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
                    >
                      <Pencil aria-hidden size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
      </div>
    </FullScreenPage>
  );
}

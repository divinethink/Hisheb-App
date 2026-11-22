// বাজার দর (Menu → Organize): গ্রুপভিত্তিক রেফারেন্স তালিকা — পণ্য | মূল্য | মন্তব্য। Net Worth/বাজেটের সাথে সম্পর্ক নেই।
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MoreHorizontal, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import Card from '../../common/Card';
import SkeletonLoader from '../../common/SkeletonLoader';
import { useMarketGroups, useMarketItems, useSettings } from '../../../hooks/useData';
import { seedMarketDefaultsIfEmpty, updateMarketGroup, updateMarketItem } from '../../../data/marketRepo';
import { matchesQuery, priceTrend, sortByOrder } from '../../../lib/marketCalc';
import { formatTaka } from '../../../lib/format';
import type { MarketGroup, MarketItem } from '../../../validation/marketSchema';
import { Delta, GroupLayoutSheet, GroupSheet, ItemSheet, PriceSheet } from './MarketSheets';

/** জায়গা বাঁচাতে বছর ২ অঙ্কে: 21/11/26 */
function shortDate(date: string, format: 'dmy' | 'mdy'): string {
  const [y, m, d] = date.split('-');
  const yy = y.slice(2);
  return format === 'mdy' ? `${Number(m)}/${Number(d)}/${yy}` : `${Number(d)}/${Number(m)}/${yy}`;
}

type Sheet =
  | { kind: 'price'; id: string }
  | { kind: 'editItem'; id: string }
  | { kind: 'addItem'; groupId: string }
  | { kind: 'editGroup'; id: string }
  | { kind: 'addGroup' }
  | { kind: 'layout' }
  | null;

export default function MarketScreen({ uid, onClose }: { uid: string; onClose: () => void }) {
  const gq = useMarketGroups(uid);
  const iq = useMarketItems(uid);
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  const [sheet, setSheet] = useState<Sheet>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // ডিফল্টে সব গ্রুপ বন্ধ
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const seeded = useRef(false);

  // প্রথমবার: সার্ভার নিশ্চিত করলে দুই collection-ই খালি হলে শুরুর তালিকা বসে (অফলাইনে কিছু করে না)
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    void seedMarketDefaultsIfEmpty(uid);
  }, [uid]);

  const ready = gq.state.status === 'ready' && iq.state.status === 'ready';
  // প্রথমবার ডেটা এলে প্রতিটা গ্রুপের সেভ-করা fold (open/closed) অনুযায়ী খোলা-বন্ধ বসে
  const foldInit = useRef(false);
  useEffect(() => {
    if (foldInit.current || gq.state.status !== 'ready') return;
    foldInit.current = true;
    setExpanded(new Set(gq.state.data.filter((g) => g.fold === 'open').map((g) => g.id)));
  }, [gq.state]);
  const allGroups: MarketGroup[] = gq.state.status === 'ready' ? gq.state.data : [];
  const allItems: MarketItem[] = iq.state.status === 'ready' ? iq.state.data : [];

  const groups = useMemo(() => sortByOrder(allGroups.filter((g) => !g.archived)), [allGroups]);
  const itemsByGroup = useMemo(() => {
    const m = new Map<string, MarketItem[]>();
    for (const it of sortByOrder(allItems.filter((i) => !i.archived))) {
      const list = m.get(it.groupId) ?? [];
      list.push(it);
      m.set(it.groupId, list);
    }
    return m;
  }, [allItems]);
  const archivedGroups = allGroups.filter((g) => g.archived);
  const archivedItems = allItems.filter((i) => i.archived);
  const searchOn = query.trim() !== '';

  const byId = (id: string) => allItems.find((i) => i.id === id);
  const groupById = (id: string) => allGroups.find((g) => g.id === id);

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function restore(fn: () => Promise<void>, id: string) {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  }

  const priceItem = sheet?.kind === 'price' || sheet?.kind === 'editItem' ? byId(sheet.id) : undefined;
  const editGroup = sheet?.kind === 'editGroup' ? groupById(sheet.id) : undefined;

  return (
    <FullScreenPage
      title="Market Prices"
      onBack={onClose}
      actions={
        <>
        <button
          type="button"
          aria-label="Customize groups"
          onClick={() => setSheet({ kind: 'layout' })}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted"
        >
          <SlidersHorizontal aria-hidden size={20} />
        </button>
        <button
          type="button"
          aria-label={searching ? 'Close search' : 'Search'}
          aria-pressed={searching}
          onClick={() => {
            setSearching((s) => !s);
            setQuery('');
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-lg ${searching ? 'text-primary' : 'text-muted'}`}
        >
          {searching ? <X aria-hidden size={20} /> : <Search aria-hidden size={20} />}
        </button>
        </>
      }
      footer={
        <button type="button" onClick={() => setSheet({ kind: 'addGroup' })} className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-muted/40 text-sm font-medium text-fg">
          <Plus aria-hidden size={16} /> Add group
        </button>
      }
    >
      {searching && (
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item or note"
          aria-label="Search item or note"
          className="mb-3 min-h-11 w-full rounded-xl border border-muted/20 bg-surface px-3 text-sm text-fg outline-none focus:border-primary"
        />
      )}

      {!ready ? (
        <SkeletonLoader />
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{allGroups.length === 0 ? 'Setting up your starter list…' : 'All groups are archived.'}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const all = itemsByGroup.get(g.id) ?? [];
            const rows = searchOn ? all.filter((i) => matchesQuery(i.name, i.history[0]?.note ?? '', query)) : all;
            if (searchOn && rows.length === 0) return null;
            const open = searchOn || expanded.has(g.id);
            return (
              <Card key={g.id} className="overflow-hidden">
                <div className="flex items-center gap-1 bg-primary/5 pr-1">
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    aria-expanded={open}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
                      {g.icon || '🛒'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-fg">{g.name}</span>
                    <span className="rounded-full bg-muted/10 px-2 py-0.5 text-xs text-muted">{all.length}</span>
                    <ChevronDown aria-hidden size={18} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <button type="button" aria-label={`Edit group ${g.name}`} onClick={() => setSheet({ kind: 'editGroup', id: g.id })} className="flex h-11 w-11 shrink-0 items-center justify-center text-muted">
                    <MoreHorizontal aria-hidden size={20} />
                  </button>
                </div>

                {open && (
                  <>
                    {rows.length === 0 ? (
                      <p className="border-t border-muted/10 px-4 py-3 text-sm text-muted">No items yet.</p>
                    ) : (
                      <ul className="divide-y divide-muted/10 border-t border-muted/10">
                        {rows.map((it) => {
                          const cur = it.history[0];
                          const trend = priceTrend(it.history);
                          const qtyText = cur ? (cur.qty != null ? `${cur.qty} ${cur.unit}` : cur.unit ? `1 ${cur.unit}` : '') : '';
                          const meta = cur ? [qtyText, shortDate(cur.date, dateFormat)].filter(Boolean).join(' · ') : '';
                          return (
                            <li key={it.id}>
                              <button
                                type="button"
                                onClick={() => setSheet({ kind: 'price', id: it.id })}
                                className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block break-words text-[15px] font-medium text-fg">{it.name}</span>
                                  {meta && <span className="mt-0.5 block text-xs text-muted">{meta}</span>}
                                  {cur?.note && <span className="mt-0.5 line-clamp-1 block break-words text-xs italic text-muted">{cur.note}</span>}
                                </span>
                                {cur ? (
                                  <span className="flex shrink-0 flex-col items-end">
                                    <span className="text-base font-semibold tabular-nums text-fg">{formatTaka(cur.priceMinor)}</span>
                                    {trend && <Delta diffMinor={trend.diffMinor} compact />}
                                  </span>
                                ) : (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                                    <Plus aria-hidden size={14} /> Add price
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {!searchOn && (
                      <button type="button" onClick={() => setSheet({ kind: 'addItem', groupId: g.id })} className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-muted/10 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                        <Plus aria-hidden size={16} /> Add item
                      </button>
                    )}
                  </>
                )}
              </Card>
            );
          })}
          {searchOn && groups.every((g) => (itemsByGroup.get(g.id) ?? []).every((i) => !matchesQuery(i.name, i.history[0]?.note ?? '', query))) && (
            <p className="py-6 text-center text-sm text-muted">No match.</p>
          )}
        </div>
      )}

      {ready && !searchOn && (archivedGroups.length > 0 || archivedItems.length > 0) && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowArchived((s) => !s)} className="min-h-9 text-sm text-muted underline">
            {showArchived ? 'Hide archived' : `Show archived (${archivedGroups.length + archivedItems.length})`}
          </button>
          {showArchived && (
            <ul className="mt-2 divide-y divide-muted/10 rounded-2xl border border-muted/10 bg-canvas px-4">
              {archivedGroups.map((g) => (
                <li key={g.id} className="flex min-h-12 items-center gap-3 py-2">
                  <span className="flex-1 truncate text-fg">
                    {g.icon} {g.name} <span className="text-xs text-muted">(group)</span>
                  </span>
                  <button type="button" disabled={busyId === g.id} onClick={() => void restore(() => updateMarketGroup(uid, g.id, { archived: false }), g.id)} className="min-h-9 rounded-lg border border-primary px-3 text-sm text-primary disabled:opacity-40">
                    Restore
                  </button>
                </li>
              ))}
              {archivedItems.map((i) => (
                <li key={i.id} className="flex min-h-12 items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-fg">
                    {i.name} <span className="text-xs text-muted">· {groupById(i.groupId)?.name ?? '—'}</span>
                  </span>
                  <button type="button" disabled={busyId === i.id} onClick={() => void restore(() => updateMarketItem(uid, i.id, { archived: false }), i.id)} className="min-h-9 rounded-lg border border-primary px-3 text-sm text-primary disabled:opacity-40">
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sheet?.kind === 'price' && priceItem && (
        <PriceSheet uid={uid} item={priceItem} dateFormat={dateFormat} onEdit={() => setSheet({ kind: 'editItem', id: priceItem.id })} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'editItem' && priceItem && (
        <ItemSheet uid={uid} item={priceItem} groupId={priceItem.groupId} groups={groups} siblings={itemsByGroup.get(priceItem.groupId) ?? []} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'addItem' && (
        <ItemSheet uid={uid} groupId={sheet.groupId} groups={groups} siblings={itemsByGroup.get(sheet.groupId) ?? []} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'layout' && <GroupLayoutSheet uid={uid} groups={groups} onSaved={(ids) => setExpanded(new Set(ids))} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'addGroup' && <GroupSheet uid={uid} groups={groups} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'editGroup' && editGroup && <GroupSheet uid={uid} group={editGroup} groups={groups} onClose={() => setSheet(null)} />}
    </FullScreenPage>
  );
}

// Category/Label rename+icon+color এডিট (owner-approved scope, 2026-09-25) + Create+Merge
// (owner-request, ২০২৬-০৯-২৬, Spendee-স্টাইল নিচে দুই বাটন)। Categories ও Labels দুটোর
// CRUD-প্যাটার্ন হুবহু এক বলে একটাই কম্পোনেন্ট (kind দিয়ে শাখা)।
import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import CategoryIcon from '../../common/CategoryIcon';
import CatalogEntryForm from '../../common/CatalogEntryForm';
import { useCategories, useLabels } from '../../../hooks/useData';
import {
  addCategory,
  addLabel,
  getArchivedCategories,
  getArchivedLabels,
  mergeCategories,
  mergeLabels,
  restoreCategory,
  restoreLabel,
  updateCategory,
  updateLabel,
} from '../../../data/catalogRepo';
import { getCategoryIcon } from '../../../lib/categoryIcons';
import { ICON_OPTIONS, COLOR_OPTIONS } from '../../../lib/iconOptions';
import type { Category, Label } from '../../../validation/catalogSchemas';

type Kind = 'category' | 'label';
type Item = Category | Label;

export default function ManageCatalog({ uid, kind, onClose }: { uid: string; kind: Kind; onClose: () => void }) {
  const catQuery = useCategories(uid);
  const lblQuery = useLabels(uid);
  const query = kind === 'category' ? catQuery : lblQuery;
  const items: Item[] = query.state.status === 'ready' ? query.state.data : [];
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [merging, setMerging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickingKeep, setPickingKeep] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<Item[] | null>(null);
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState('');
  const label = kind === 'category' ? 'Category' : 'Label';
  const title = kind === 'category' ? 'Manage Categories' : 'Manage Labels';

  function exitMerge() {
    setMerging(false);
    setSelected(new Set());
    setPickingKeep(false);
  }
  function toggleSelect(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openArchived() {
    setShowArchived(true);
    setArchived(null);
    setArchiveError('');
    try {
      setArchived(kind === 'category' ? await getArchivedCategories(uid) : await getArchivedLabels(uid));
    } catch {
      setArchived([]);
      setArchiveError('Could not load archived items.');
    }
  }

  async function restore(id: string) {
    setArchiveBusyId(id);
    setArchiveError('');
    try {
      if (kind === 'category') await restoreCategory(uid, id);
      else await restoreLabel(uid, id);
      setArchived((cur) => (cur ? cur.filter((it) => it.id !== id) : cur));
    } catch {
      setArchiveError('Could not restore. Try again.');
    } finally {
      setArchiveBusyId(null);
    }
  }

  return (
    <FullScreenPage
      title={merging ? `Select ${label.toLowerCase()}s to merge` : showArchived ? `Archived ${label}s` : title}
      onBack={merging ? exitMerge : showArchived ? () => setShowArchived(false) : onClose}
      footer={
        merging ? (
          <>
            <button type="button" onClick={exitMerge} className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm text-fg">
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size < 2}
              onClick={() => setPickingKeep(true)}
              className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-40"
            >
              Merge ({selected.size})
            </button>
          </>
        ) : showArchived ? (
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className="min-h-11 w-full rounded-lg border border-muted/40 text-sm font-medium text-fg"
          >
            Back to {label} List
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm font-medium text-fg"
            >
              + Create New
            </button>
            <button
              type="button"
              disabled={items.length < 2}
              onClick={() => setMerging(true)}
              className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm font-medium text-fg disabled:opacity-40"
            >
              🔗 Merge {label}s
            </button>
          </>
        )
      }
    >
      {showArchived ? (
        <>
          {archived === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : archived.length === 0 ? (
            <p className="text-sm text-muted">No archived {kind === 'category' ? 'categories' : 'labels'}.</p>
          ) : (
            <ul className="divide-y divide-muted/10">
              {archived.map((it) => (
                <li key={it.id} className="flex min-h-14 items-center gap-3 py-2.5">
                  <CategoryIcon
                    name={it.name}
                    icon={it.icon ?? (kind === 'category' ? getCategoryIcon(it.name, (it as Category).type ?? null) : null)}
                    color={it.color}
                  />
                  <span className="flex-1 truncate text-fg">{it.name}</span>
                  <button
                    type="button"
                    onClick={() => void restore(it.id)}
                    disabled={archiveBusyId === it.id}
                    className="min-h-9 shrink-0 rounded-lg border border-primary px-3 text-sm text-primary disabled:opacity-40"
                  >
                    {archiveBusyId === it.id ? 'Restoring…' : 'Restore'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {archiveError && (
            <p role="alert" className="mt-3 text-sm text-expense">
              {archiveError}
            </p>
          )}
        </>
      ) : (
        <>
          {!merging && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => void openArchived()}
                className="min-h-9 text-sm text-muted underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                View archived {kind === 'category' ? 'categories' : 'labels'}
              </button>
            </div>
          )}
          {query.state.status !== 'ready' ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted">No {kind === 'category' ? 'categories' : 'labels'} yet.</p>
          ) : (
            <ul className="divide-y divide-muted/10">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => (merging ? toggleSelect(it.id) : setEditing(it))}
                    className="flex min-h-14 w-full items-center gap-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {merging && (
                      <input
                        type="checkbox"
                        checked={selected.has(it.id)}
                        readOnly
                        className="h-5 w-5 shrink-0 accent-primary"
                        aria-label={`Select ${it.name}`}
                      />
                    )}
                    <CategoryIcon
                      name={it.name}
                      icon={it.icon ?? (kind === 'category' ? getCategoryIcon(it.name, (it as Category).type ?? null) : null)}
                      color={it.color}
                    />
                    <span className="flex-1 truncate text-fg">{it.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing && <EditForm uid={uid} kind={kind} item={editing} onClose={() => setEditing(null)} />}

      {creating && (
        <CatalogEntryForm
          kind={kind}
          onClose={() => setCreating(false)}
          onCreate={async (data) => {
            if (kind === 'category') await addCategory(uid, { name: data.name, type: null, icon: data.icon, color: data.color });
            else await addLabel(uid, data.name, { icon: data.icon, color: data.color });
          }}
        />
      )}

      {pickingKeep && (
        <MergeKeepPicker
          uid={uid}
          kind={kind}
          items={items.filter((it) => selected.has(it.id))}
          onClose={() => setPickingKeep(false)}
          onDone={exitMerge}
        />
      )}
    </FullScreenPage>
  );
}

/** Merge-এর দ্বিতীয় ধাপ — কোনটা রাখা হবে (keep) বেছে confirm করলে বাকিগুলো তাতে মিশে যায়, কোনো data loss হয় না। */
function MergeKeepPicker({
  uid,
  kind,
  items,
  onClose,
  onDone,
}: {
  uid: string;
  kind: Kind;
  items: Item[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [keepId, setKeepId] = useState(items[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<number | null>(null);
  const keep = items.find((it) => it.id === keepId);

  async function confirm() {
    if (!keep || busy) return;
    setBusy(true);
    setError('');
    try {
      const mergeIds = items.map((it) => it.id).filter((id) => id !== keepId);
      const count =
        kind === 'category' ? await mergeCategories(uid, keepId, keep.name, mergeIds) : await mergeLabels(uid, keepId, keep.name, mergeIds);
      setResult(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (result !== null) {
    return (
      <FullScreenPage
        title="Merge complete"
        onBack={onDone}
        footer={
          <button type="button" onClick={onDone} className="min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas">
            Done
          </button>
        }
      >
        <p className="text-sm text-fg">
          Merged into <span className="font-medium">{keep?.name}</span>. {result} transaction{result === 1 ? '' : 's'} updated. No data
          was lost — the other {kind === 'category' ? 'categories' : 'labels'} are hidden now.
        </p>
      </FullScreenPage>
    );
  }

  return (
    <FullScreenPage
      title="Keep which one?"
      onBack={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm text-fg">
            Back
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-40"
          >
            {busy ? 'Merging…' : 'Confirm Merge'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        All transactions from the others will move to the one you keep. Nothing is deleted from your data.
      </p>
      <ul className="divide-y divide-muted/10">
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => setKeepId(it.id)}
              className="flex min-h-14 w-full items-center gap-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <input type="radio" checked={keepId === it.id} readOnly className="h-5 w-5 shrink-0 accent-primary" />
              <CategoryIcon name={it.name} icon={it.icon} color={it.color} />
              <span className="flex-1 truncate text-fg">{it.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-expense">
          {error}
        </p>
      )}
    </FullScreenPage>
  );
}

function EditForm({ uid, kind, item, onClose }: { uid: string; kind: Kind; item: Item; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [icon, setIcon] = useState<string | null>(item.icon ?? null);
  const [color, setColor] = useState<string | null>(item.color ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const patch = { name: trimmed, icon, color };
      if (kind === 'category') await updateCategory(uid, item.id, patch);
      else await updateLabel(uid, item.id, patch);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenPage
      title={`Edit ${kind === 'category' ? 'Category' : 'Label'}`}
      onBack={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-muted/40 text-sm text-fg">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-canvas disabled:opacity-40"
          >
            Save
          </button>
        </>
      }
    >
      <div className="flex justify-center">
        <CategoryIcon name={name || '?'} icon={icon} color={color} size={56} />
      </div>

      <label className="mt-4 block text-sm text-muted" htmlFor="catalog-name">
        Name
      </label>
      <input
        id="catalog-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none"
      />

      <h3 className="mt-5 text-sm text-muted">Color</h3>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          aria-pressed={color === null}
          onClick={() => setColor(null)}
          className={`flex h-9 items-center justify-center rounded-full border px-3 text-xs text-muted ${color === null ? 'border-primary text-fg' : 'border-muted/40'}`}
        >
          Auto
        </button>
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className={`h-9 w-9 rounded-full border-2 ${color === c ? 'border-fg' : 'border-transparent'}`}
            style={{ background: c }}
          />
        ))}
      </div>

      <h3 className="mt-5 text-sm text-muted">Icon</h3>
      <div className="mt-2 grid grid-cols-6 gap-2">
        {ICON_OPTIONS.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={icon === i}
            onClick={() => setIcon(icon === i ? null : i)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl ${icon === i ? 'border-primary bg-primary/10' : 'border-muted/40'}`}
          >
            {i}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-expense">
          {error}
        </p>
      )}
    </FullScreenPage>
  );
}

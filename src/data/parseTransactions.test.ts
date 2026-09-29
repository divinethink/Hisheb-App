import { describe, it, expect, vi } from 'vitest';
import { parseTransactions, type RawDoc } from './parseTransactions';

const ts = { toDate: () => new Date('2026-09-20T10:00:00Z') };
const base = {
  date: '2026-09-20',
  type: 'expense',
  occurredAt: ts,
  amountMinor: 12500,
  categoryId: 'c1',
  categoryName: 'Groceries',
};
const mk = (id: string, over: Record<string, unknown> = {}): RawDoc => ({ id, data: () => ({ ...base, ...over }) });

describe('parseTransactions', () => {
  it('parses valid doc and applies defensive defaults', () => {
    const [t] = parseTransactions([mk('a')]);
    expect(t).toMatchObject({ id: 'a', currency: 'BDT', labelIds: [], note: '', deleted: false, importKey: null, createdAt: null });
  });
  it('skips soft-deleted docs', () => {
    expect(parseTransactions([mk('a'), mk('b', { deleted: true })]).map((t) => t.id)).toEqual(['a']);
  });
  it('skips invalid docs and reports them, keeps the rest', () => {
    const onInvalid = vi.fn();
    const r = parseTransactions(
      [mk('ok'), mk('neg', { amountMinor: -5 }), mk('zero', { amountMinor: 0 }), mk('dec', { amountMinor: 1.5 }), mk('date', { date: '2026-9-1' }), mk('type', { type: 'transfer' })],
      onInvalid,
    );
    expect(r.map((t) => t.id)).toEqual(['ok']);
    expect(onInvalid.mock.calls.map((c) => c[0])).toEqual(['neg', 'zero', 'dec', 'date', 'type']);
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const repo = vi.hoisted(() => ({ addTransactionsBatch: vi.fn().mockResolvedValue(undefined) }));
let n = 0;
vi.mock('../../../data/transactionRepo', () => ({
  BASKET_MAX: 30,
  newTransactionId: () => `id-${++n}`,
  addTransactionsBatch: repo.addTransactionsBatch,
}));
vi.mock('../../../hooks/useData', () => ({
  useSettings: () => ({ state: { status: 'ready', data: { dateFormat: 'dmy' } }, retry: vi.fn() }),
}));

import BasketSheet from './BasketSheet';
import type { Category, Label } from '../../../validation/catalogSchemas';

const cat = (id: string, name: string): Category => ({
  id, name, type: 'expense', icon: null, color: null, archived: false, monthlyBudgetMinor: null, order: 0, createdAt: null, updatedAt: null,
});
const cats = [cat('c1', 'Groceries'), cat('c2', 'Raiyan'), cat('c3', 'Hira')];
const labels: Label[] = [];

function setup() {
  const onBack = vi.fn();
  const onSaved = vi.fn();
  render(
    <BasketSheet
      uid="u1" type="expense" initialCats={[{ id: 'c1', name: 'Groceries' }, { id: 'c2', name: 'Raiyan' }]}
      categories={cats} labels={labels} initialDate="2026-11-22" onBack={onBack} onSaved={onSaved}
    />,
  );
  return { onBack, onSaved, user: userEvent.setup() };
}

beforeEach(() => { vi.clearAllMocks(); n = 0; });
afterEach(cleanup);

describe('BasketSheet', () => {
  it('blocks save and writes nothing when a row has no amount', async () => {
    const { user, onSaved } = setup();
    await user.type(screen.getByLabelText('Amount for Groceries'), '100');
    await user.click(screen.getByRole('button', { name: /Save all/ }));
    expect(repo.addTransactionsBatch).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('greater than 0');
  });

  it('saves all rows in one batch with positive minor amounts and stable ids', async () => {
    const { user, onSaved } = setup();
    await user.type(screen.getByLabelText('Amount for Groceries'), '100+50');
    await user.type(screen.getByLabelText('Amount for Raiyan'), '30');
    await user.click(screen.getByRole('button', { name: /Save all \(2\)/ }));
    expect(repo.addTransactionsBatch).toHaveBeenCalledTimes(1);
    const items = repo.addTransactionsBatch.mock.calls[0][1];
    expect(items.map((i: { id: string }) => i.id)).toEqual(['id-1', 'id-2']);
    expect(items.map((i: { input: { amountMinor: number } }) => i.input.amountMinor)).toEqual([15000, 3000]);
    expect(items[0].input.type).toBe('expense');
    expect(onSaved).toHaveBeenCalled();
  });

  it('+ button appends a plus so several amounts can be added in one row', async () => {
    const { user } = setup();
    const input = screen.getByLabelText('Amount for Groceries') as HTMLInputElement;
    await user.type(input, '40');
    await user.click(screen.getByRole('button', { name: 'Add another amount to Groceries' }));
    await user.type(input, '110');
    expect(input.value).toBe('40+110');
    expect(screen.getByText('= 150')).toBeTruthy();
  });

  it('keeps the draft and shows an error when the batch fails', async () => {
    repo.addTransactionsBatch.mockRejectedValueOnce(new Error('x'));
    const { user, onSaved } = setup();
    await user.type(screen.getByLabelText('Amount for Groceries'), '10');
    await user.type(screen.getByLabelText('Amount for Raiyan'), '20');
    await user.click(screen.getByRole('button', { name: /Save all/ }));
    expect(onSaved).not.toHaveBeenCalled();
    expect(await screen.findByText(/nothing was saved/)).toBeTruthy();
  });

  it('removing a row updates the count', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove Raiyan' }));
    expect(screen.getByRole('button', { name: /Save all \(1\)/ })).toBeTruthy();
  });
});

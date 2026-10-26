// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const hooks = vi.hoisted(() => ({ all: vi.fn() }));
vi.mock('../../../hooks/useData', () => ({ useAllTransactions: hooks.all }));

import HomeSearch from './HomeSearch';
import type { Transaction } from '../../../validation/transactionSchema';

const tx = (id: string, date: string, amountMinor: number, categoryName: string, note = ''): Transaction =>
  ({
    id,
    date,
    type: 'expense',
    occurredAt: { toDate: () => new Date(date) },
    importKey: null,
    amountMinor,
    currency: 'BDT',
    categoryId: categoryName,
    categoryName,
    labelIds: [],
    labelNames: [],
    note,
    deleted: false,
    createdAt: null,
    updatedAt: null,
    receiptUrl: null,
    recurringTemplateId: null,
  }) as Transaction;

afterEach(cleanup);

describe('HomeSearch', () => {
  it('সব মাসে খোঁজে এবং রো ট্যাপে onPick ডাকে', async () => {
    hooks.all.mockReturnValue({
      state: { status: 'ready', data: [tx('a', '2026-10-25', 6000, 'Groceries'), tx('b', '2026-03-02', 31500, 'Groceries', 'old')] },
      retry: vi.fn(),
    });
    const onPick = vi.fn();
    render(<HomeSearch uid="u" catById={new Map()} onPick={onPick} />);
    expect(screen.getByText('Type to search all months.')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Search transactions'), 'groc');
    expect(screen.getByText(/2 found/)).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: /Groceries/ })[1]!);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });
  it('মিল না থাকলে বার্তা', async () => {
    hooks.all.mockReturnValue({ state: { status: 'ready', data: [tx('a', '2026-10-25', 6000, 'Groceries')] }, retry: vi.fn() });
    render(<HomeSearch uid="u" catById={new Map()} onPick={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Search transactions'), 'zzz');
    expect(screen.getByText('No matching transactions.')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const hooks = vi.hoisted(() => ({ tx: vi.fn(), cats: vi.fn(), lbls: vi.fn(), settings: vi.fn() }));
vi.mock('../../../hooks/useData', () => ({
  useMonthTransactions: hooks.tx,
  useCategories: hooks.cats,
  useLabels: hooks.lbls,
  useSettings: hooks.settings,
}));
const repo = vi.hoisted(() => ({
  softDeleteTransaction: vi.fn().mockResolvedValue(undefined),
  restoreTransaction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../data/transactionRepo', () => ({
  newTransactionId: () => 'id',
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  softDeleteTransaction: repo.softDeleteTransaction,
  restoreTransaction: repo.restoreTransaction,
  // UI Polish [1_5] §১ item ১: "vs last month" এর জন্য one-shot previous-month read
  getTransactionsByMonth: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../data/catalogRepo', () => ({ addCategory: vi.fn(), addLabel: vi.fn() }));

import HomeTab from './HomeTab';

const ready = <T,>(data: T) => ({ state: { status: 'ready' as const, data }, retry: vi.fn() });
const mk = (id: string, date: string, type: 'income' | 'expense', amountMinor: number, name: string) => ({
  id, date, type, amountMinor, categoryId: 'c', categoryName: name, labelIds: [], labelNames: [], note: '',
  currency: 'BDT', deleted: false, occurredAt: { toDate: () => new Date(`${date}T10:00:00Z`) },
  importKey: null, createdAt: null, updatedAt: null, receiptUrl: null, recurringTemplateId: null,
});

afterEach(cleanup);

// G3: থ্রেশহোল্ড off (null) — ডিফল্ট, নির্দিষ্ট test-এ override দরকার নেই।
hooks.settings.mockReturnValue(ready({ largeAmountWarningThresholdMinor: null }));

describe('HomeTab', () => {
  it('shows totals (lakh-style), grouped rows and opens edit on tap', async () => {
    hooks.tx.mockReturnValue({
      ...ready([
        mk('a', '2026-09-03', 'expense', 16241700, 'Rent'),
        mk('b', '2026-09-01', 'income', 4200800, 'Salary'),
      ]),
      invalidCount: 0,
    });
    hooks.cats.mockReturnValue(ready([]));
    hooks.lbls.mockReturnValue(ready([]));
    render(<HomeTab uid="u1" />);
    expect(screen.getAllByText('BDT 1,62,417').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BDT 42,008').length).toBeGreaterThan(0);
    expect(screen.getAllByText('−BDT 1,62,417').length).toBe(2); // দিনের net + সারি
    await userEvent.click(screen.getByRole('button', { name: /Rent/ }));
    expect(screen.getByRole('dialog', { name: 'Edit transaction' })).toBeTruthy();
  });

  it('deletes a transaction (with confirm) and offers Undo', async () => {
    hooks.tx.mockReturnValue({ ...ready([mk('a', '2026-09-03', 'expense', 16241700, 'Rent')]), invalidCount: 0 });
    hooks.cats.mockReturnValue(ready([]));
    hooks.lbls.mockReturnValue(ready([]));
    render(<HomeTab uid="u1" />);
    await userEvent.click(screen.getByRole('button', { name: /Rent/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete transaction' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(repo.softDeleteTransaction).toHaveBeenCalledWith('u1', 'a');
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(repo.restoreTransaction).toHaveBeenCalledWith('u1', 'a');
  });

  it('empty state offers Add transaction', () => {
    hooks.tx.mockReturnValue({ ...ready([]), invalidCount: 0 });
    hooks.cats.mockReturnValue(ready([]));
    hooks.lbls.mockReturnValue(ready([]));
    render(<HomeTab uid="u1" />);
    expect(screen.getByText(/No transactions yet/)).toBeTruthy();
  });

  it('error state shows Retry and reports invalid records note', async () => {
    const retry = vi.fn();
    hooks.tx.mockReturnValue({ state: { status: 'error', message: 'x' }, retry, invalidCount: 0 });
    hooks.cats.mockReturnValue(ready([]));
    hooks.lbls.mockReturnValue(ready([]));
    render(<HomeTab uid="u1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
    cleanup();
    hooks.tx.mockReturnValue({ ...ready([]), invalidCount: 2 });
    render(<HomeTab uid="u1" />);
    expect(screen.getByText('2 records couldn’t be loaded.')).toBeTruthy();
  });

  it('loading state shows skeleton, no totals', () => {
    hooks.tx.mockReturnValue({ state: { status: 'loading' }, retry: vi.fn(), invalidCount: 0 });
    hooks.cats.mockReturnValue({ state: { status: 'loading' }, retry: vi.fn() });
    hooks.lbls.mockReturnValue({ state: { status: 'loading' }, retry: vi.fn() });
    render(<HomeTab uid="u1" />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByLabelText('Month summary')).toBeNull();
  });
});

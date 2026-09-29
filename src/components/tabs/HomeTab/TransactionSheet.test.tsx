// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const repo = vi.hoisted(() => ({
  addTransaction: vi.fn().mockResolvedValue(undefined),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  addCategory: vi.fn().mockResolvedValue({ id: 'c-new', name: 'Books' }),
  addLabel: vi.fn().mockResolvedValue({ id: 'l-new', name: 'Gift' }),
}));
vi.mock('../../../data/transactionRepo', () => ({
  newTransactionId: () => 'new-id',
  addTransaction: repo.addTransaction,
  updateTransaction: repo.updateTransaction,
}));
vi.mock('../../../data/catalogRepo', () => ({ addCategory: repo.addCategory, addLabel: repo.addLabel }));
vi.mock('../../../hooks/useData', () => ({
  useSettings: () => ({ state: { status: 'ready', data: { largeAmountWarningThresholdMinor: null } }, retry: vi.fn() }),
}));

import TransactionSheet from './TransactionSheet';
import type { Category, Label } from '../../../validation/catalogSchemas';
import type { Transaction } from '../../../validation/transactionSchema';

const cat = (id: string, name: string, type: 'income' | 'expense' | null = null): Category => ({
  id, name, type, icon: null, color: null, archived: false, monthlyBudgetMinor: null, order: 0, createdAt: null, updatedAt: null,
});
const lbl = (id: string, name: string): Label => ({ id, name, icon: null, color: null, archived: false, order: 0, createdAt: null, updatedAt: null });
const cats = [cat('c1', 'Groceries', 'expense'), cat('c2', 'Salary', 'income')];
const lbls = [lbl('l1', 'Fruits')];

function setup(initial: Transaction | null = null, onDelete?: () => Promise<void>) {
  const onClose = vi.fn();
  render(
    <TransactionSheet uid="u1" initial={initial} categories={cats} labels={lbls} onClose={onClose} onDelete={onDelete} />,
  );
  return { onClose, user: userEvent.setup() };
}

// Amount field এখন readOnly + custom on-screen keypad (Spendee-স্টাইল, ২০২৬-০৯-২৬) — native
// user.type()/user.clear() আর কাজ করে না। এই তিনটা helper সেই keypad-ট্যাপ simulate করে।
type TestUser = ReturnType<typeof userEvent.setup>;
async function openKeypad(user: TestUser) {
  await user.click(screen.getByLabelText('Amount'));
}
async function typeAmount(user: TestUser, digits: string) {
  await openKeypad(user);
  for (const ch of digits) {
    await user.click(screen.getByRole('button', { name: ch }));
  }
}
async function backspaceAmount(user: TestUser, times: number) {
  for (let i = 0; i < times; i++) {
    await user.click(screen.getByRole('button', { name: 'Backspace' }));
  }
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('TransactionSheet', () => {
  it('shows validation errors and does not write when empty', async () => {
    // owner-request (২০২৬-০৯-২৬) category-first flow: Save বাটন শুধু category বাছার পরের
    // ধাপে (details) আসে, তাই "no category" validation এখন UI দিয়ে আর reachable না — সেই
    // চেক ইচ্ছাকৃতভাবে বাদ; amount-validation এখনো প্রযোজ্য।
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Groceries' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/greater than 0/)).toBeTruthy();
    expect(repo.addTransaction).not.toHaveBeenCalled();
  });

  it('rejects zero amount', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Groceries' }));
    await typeAmount(user, '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(repo.addTransaction).not.toHaveBeenCalled();
  });

  it('saves a valid expense with minor units, stable id, importKey null', async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Groceries' }));
    // custom keypad-এ কোনো "," কী নেই (Spendee-প্যাটার্ন) — owner সরাসরি "1250.5" টাইপ করবেন;
    // ফলাফল (amountMinor) কমা-সহ আগের ভার্সনের মতোই।
    await typeAmount(user, '1250.5');
    await user.click(screen.getByRole('button', { name: 'Fruits' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repo.addTransaction).toHaveBeenCalledTimes(1);
    const [uid, id, input] = repo.addTransaction.mock.calls[0];
    expect(uid).toBe('u1');
    expect(id).toBe('new-id');
    expect(input).toMatchObject({
      amountMinor: 125050, type: 'expense', categoryId: 'c1', categoryName: 'Groceries',
      labelIds: ['l1'], labelNames: ['Fruits'], importKey: null,
    });
    expect(input.occurredAt).toBeInstanceOf(Date);
  });

  it('hides categories of the other type and switches on type change', async () => {
    const { user } = setup();
    expect(screen.queryByRole('button', { name: 'Salary' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'income' }));
    expect(screen.getByRole('button', { name: 'Salary' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Groceries' })).toBeNull();
  });

  it('quick-adds a category (name only) and selects it', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: '+ New Category' }));
    await user.type(screen.getByLabelText('Name'), 'Books');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(repo.addCategory).toHaveBeenCalledWith('u1', { name: 'Books', type: 'expense', icon: null, color: null }),
    );
    // quick-add category সিলেক্ট হওয়ার সাথে সাথেই amount/details ধাপে চলে যায় (category-first flow)
    await waitFor(() => expect(screen.getByRole('button', { name: /Books/ })).toBeTruthy());
    expect(screen.getByLabelText('Amount')).toBeTruthy();
  });

  it('asks before discarding unsaved input', async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Groceries' }));
    await typeAmount(user, '50');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard changes?')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes immediately when nothing changed', async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('edit mode updates (no add), keeps currency', async () => {
    const initial = {
      id: 't9', date: '2026-09-20', type: 'expense', occurredAt: { toDate: () => new Date() }, importKey: null,
      amountMinor: 50000, currency: 'BDT', categoryId: 'c1', categoryName: 'Groceries', labelIds: [], labelNames: [],
      note: '', deleted: false, createdAt: null, updatedAt: null, receiptUrl: null, recurringTemplateId: null,
    } as Transaction;
    const { user, onClose } = setup(initial);
    const amount = screen.getByLabelText('Amount') as HTMLInputElement;
    expect(amount.value).toBe('500');
    await openKeypad(user);
    await backspaceAmount(user, amount.value.length);
    for (const ch of '750') await user.click(screen.getByRole('button', { name: ch }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(repo.addTransaction).not.toHaveBeenCalled();
    expect(repo.updateTransaction).toHaveBeenCalledWith('u1', 't9', expect.objectContaining({ amountMinor: 75000, currency: 'BDT' }));
  });

  it('asks to confirm before calling onDelete, and shows error on failure', async () => {
    const initial = {
      id: 't9', date: '2026-09-20', type: 'expense', occurredAt: { toDate: () => new Date() }, importKey: null,
      amountMinor: 50000, currency: 'BDT', categoryId: 'c1', categoryName: 'Groceries', labelIds: [], labelNames: [],
      note: '', deleted: false, createdAt: null, updatedAt: null, receiptUrl: null, recurringTemplateId: null,
    } as Transaction;
    const onDelete = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
    const { user } = setup(initial, onDelete);
    await user.click(screen.getByRole('button', { name: 'Delete transaction' }));
    expect(screen.getByText('Delete this transaction?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByText(/Could not delete/)).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Delete transaction' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
  });

  it('shows error and stays open when write fails', async () => {
    repo.addTransaction.mockRejectedValueOnce(new Error('denied'));
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Groceries' }));
    await typeAmount(user, '10');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText(/Could not save/)).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });
});

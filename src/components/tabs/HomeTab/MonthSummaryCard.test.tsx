// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonthSummaryCard from './MonthSummaryCard';

afterEach(cleanup);

const base = { incomeMinor: 4_200_800, typeFilter: null, onTypeFilter: () => {} } as const;

describe('MonthSummaryCard', () => {
  it('within target: left, avg + safe, forecast ok, days left', () => {
    render(
      <MonthSummaryCard {...base} expenseMinor={2_200_000} savingsMinor={2_000_800} budgetMinor={3_500_000} month="2026-10" today="2026-10-20" />,
    );
    expect(screen.getByText('63%')).toBeTruthy();
    expect(screen.getByText(/of target 35,000/)).toBeTruthy();
    expect(screen.getByText('13,000 left')).toBeTruthy();
    expect(screen.getByText('1,100')).toBeTruthy(); // Avg
    expect(screen.getByText('1,182')).toBeTruthy(); // Safe
    expect(screen.getByLabelText('Forecast is within target')).toBeTruthy();
    expect(screen.getByText('Savings · Oct · 11 days left')).toBeTruthy();
  });

  it('over target: over text, no Safe, forecast warning', () => {
    render(
      <MonthSummaryCard {...base} expenseMinor={5_862_600} savingsMinor={-1_661_800} budgetMinor={3_500_000} month="2026-10" today="2026-10-27" />,
    );
    expect(screen.getByText('168%')).toBeTruthy();
    expect(screen.getByText('23,626 over')).toBeTruthy();
    expect(screen.queryByText(/^Safe/)).toBeNull();
    expect(screen.getByLabelText('Forecast is above target')).toBeTruthy();
  });

  it('no budget: only savings and chips', () => {
    render(<MonthSummaryCard {...base} expenseMinor={100_000} savingsMinor={3_000_000} budgetMinor={null} month="2026-10" today="2026-10-20" />);
    expect(screen.queryByText(/of target/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Income/ })).toBeTruthy();
  });

  it('past month: avg only, no forecast', () => {
    render(<MonthSummaryCard {...base} expenseMinor={3_000_000} savingsMinor={1_200_800} budgetMinor={3_500_000} month="2026-09" today="2026-10-20" />);
    expect(screen.getByText('1,000')).toBeTruthy();
    expect(screen.queryByLabelText(/Forecast is/)).toBeNull();
  });

  it('chip tap toggles the filter', async () => {
    const onTypeFilter = vi.fn();
    const { rerender } = render(<MonthSummaryCard {...base} onTypeFilter={onTypeFilter} expenseMinor={1} savingsMinor={0} budgetMinor={null} month="2026-10" today="2026-10-20" />);
    await userEvent.click(screen.getByRole('button', { name: /^Expense/ }));
    expect(onTypeFilter).toHaveBeenCalledWith('expense');
    rerender(<MonthSummaryCard {...base} typeFilter="expense" onTypeFilter={onTypeFilter} expenseMinor={1} savingsMinor={0} budgetMinor={null} month="2026-10" today="2026-10-20" />);
    await userEvent.click(screen.getByRole('button', { name: /^Expense/ }));
    expect(onTypeFilter).toHaveBeenLastCalledWith(null);
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import MonthTargetCard from './MonthTargetCard';

afterEach(cleanup);

describe('MonthTargetCard', () => {
  it('under target: shows left, avg, safe and forecast-ok', () => {
    render(<MonthTargetCard spentMinor={2_200_000} budgetMinor={3_500_000} month="2026-10" today="2026-10-20" />);
    expect(screen.getByText('63%')).toBeTruthy();
    expect(screen.getByText('BDT 13,000 left')).toBeTruthy();
    expect(screen.getByText('BDT 1,100/day')).toBeTruthy();
    expect(screen.getByText('BDT 1,182/day')).toBeTruthy();
    expect(screen.getByLabelText('Forecast is within target')).toBeTruthy();
  });

  it('over target: shows over, no safe/day, forecast warning', () => {
    render(<MonthTargetCard spentMinor={5_862_600} budgetMinor={3_500_000} month="2026-10" today="2026-10-27" />);
    expect(screen.getByText('BDT 23,626 over')).toBeTruthy();
    expect(screen.queryByText(/^Safe/)).toBeNull();
    expect(screen.getByLabelText('Forecast is above target')).toBeTruthy();
  });

  it('past month: avg only, no forecast', () => {
    render(<MonthTargetCard spentMinor={3_000_000} budgetMinor={3_500_000} month="2026-09" today="2026-10-20" />);
    expect(screen.getByText('BDT 1,000/day')).toBeTruthy();
    expect(screen.queryByLabelText(/Forecast is/)).toBeNull();
  });
});

// Live Budget Pace-line — pure calculation, platform-independent (Architecture Plan §০ lib/ purity)।
// শুধু চলতি মাসেই অর্থবহ; caller (UI) নিশ্চিত করবে month === currentMonth() হলে তবেই দেখানো হবে।

function daysInMonth(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dayOfMonth(dhakaDate: string): number {
  return Number(dhakaDate.slice(8, 10));
}

export interface BudgetPace {
  expectedSpentMinor: number;
  paceStatus: 'ahead' | 'on-track';
}

/** expectedSpentMinor = budget × (আজ পর্যন্ত দিন / মাসের মোট দিন) — linear pace। */
export function budgetPace(budgetMinor: number, spentMinor: number, month: string, todayDhaka: string): BudgetPace {
  const totalDays = daysInMonth(month);
  const elapsed = Math.min(Math.max(dayOfMonth(todayDhaka), 1), totalDays);
  const expectedSpentMinor = Math.round((budgetMinor * elapsed) / totalDays);
  return { expectedSpentMinor, paceStatus: spentMinor > expectedSpentMinor ? 'ahead' : 'on-track' };
}

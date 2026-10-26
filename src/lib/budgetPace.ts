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

// পুরো টাকায় round (পয়সা দেখানোর দরকার নেই — প্রদর্শনে "BDT 1,182/day"), minor-এ ১০০-র গুণিতক
const wholeTaka = (minor: number) => Math.round(minor / 100) * 100;

export interface MonthSpendStats {
  /** আজ পর্যন্ত কত দিন গেছে (চলতি মাসে আজকেরটা সহ; অতীত মাসে পুরো মাস; ভবিষ্যৎ মাসে ০) */
  elapsedDays: number;
  daysLeft: number;
  /** ব্যয় ÷ elapsedDays (elapsedDays=০ হলে ০) */
  avgPerDayMinor: number;
  /** এখনকার গতিতে মাস-শেষের আনুমানিক ব্যয় — শুধু চলতি মাসে */
  forecastMinor: number | null;
  /** বাকি বাজেট ÷ বাকি দিন — শুধু চলতি মাসে, বাজেটের মধ্যে থাকলে, daysLeft > 0 হলে */
  safePerDayMinor: number | null;
}

/** Home "Monthly target" কার্ডের Avg/Safe/Forecast — pure, কোনো store/query নেই (শুধু বিদ্যমান মাসের ব্যয় থেকে)। */
export function monthSpendStats(spentMinor: number, budgetMinor: number, month: string, todayDhaka: string): MonthSpendStats {
  const totalDays = daysInMonth(month);
  const nowMonth = todayDhaka.slice(0, 7);
  if (month > nowMonth) {
    return { elapsedDays: 0, daysLeft: totalDays, avgPerDayMinor: 0, forecastMinor: null, safePerDayMinor: null };
  }
  if (month < nowMonth) {
    return {
      elapsedDays: totalDays,
      daysLeft: 0,
      avgPerDayMinor: wholeTaka(spentMinor / totalDays),
      forecastMinor: null,
      safePerDayMinor: null,
    };
  }
  const elapsed = Math.min(Math.max(dayOfMonth(todayDhaka), 1), totalDays);
  const daysLeft = totalDays - elapsed;
  const remaining = budgetMinor - spentMinor;
  return {
    elapsedDays: elapsed,
    daysLeft,
    avgPerDayMinor: wholeTaka(spentMinor / elapsed),
    forecastMinor: wholeTaka((spentMinor / elapsed) * totalDays),
    safePerDayMinor: remaining > 0 && daysLeft > 0 ? wholeTaka(remaining / daysLeft) : null,
  };
}

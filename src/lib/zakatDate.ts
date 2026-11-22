// Zakat বার্ষিক তারিখ (Hawl-স্মারক) — pure। UTC-তে দিন গোনা, timezone-এর ঝামেলা নেই।
const parts = (d: string): [number, number, number] => {
  const [y, m, day] = d.split('-').map(Number);
  return [y, m, day];
};

/** `date`-এর মাস-দিন ধরে পরের বার্ষিক তারিখ আজ থেকে কত দিন পরে (আজই হলে ০)। ২৯ ফেব্রুয়ারি অ-লিপ বছরে ১ মার্চ ধরা হয়। */
export function daysToAnniversary(date: string, today: string): number {
  const [ty, tm, td] = parts(today);
  const [, m, d] = parts(date);
  const todayMs = Date.UTC(ty, tm - 1, td);
  let next = Date.UTC(ty, m - 1, d);
  if (next < todayMs) next = Date.UTC(ty + 1, m - 1, d);
  return Math.round((next - todayMs) / 86_400_000);
}

// তারিখ: transaction.date সবসময় Asia/Dhaka local date (Roadmap §২ E3)। UTC-substring কাটা নিষিদ্ধ।
const dhakaFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function toDhakaDate(d: Date): string {
  return dhakaFmt.format(d); // "YYYY-MM-DD"
}

export function currentMonth(now: Date = new Date()): string {
  return toDhakaDate(now).slice(0, 7);
}

/** occurredAt: আজকের তারিখ হলে এখনকার মুহূর্ত, নইলে সেই দিনের দুপুর ১২টা (Dhaka) — দিনের ভেতরে ক্রম ঠিক রাখতে */
export function occurredAtFor(date: string, now: Date = new Date()): Date {
  return toDhakaDate(now) === date ? now : new Date(`${date}T12:00:00+06:00`);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** yyyymm ± delta মাস (Overview month/year selector) */
export function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** yyyymm-এর শেষ দিন "YYYY-MM-DD" (Overview runway গড়-ব্যয় রেঞ্জ-কোয়েরির জন্য)। */
export function monthEndDate(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/**
 * "Today" / "Yesterday" / "Sep 4" (অন্য বছর হলে "Sep 4, 2025") — Home tab-এর date-group
 * header-এই ব্যবহৃত (dateLabel-এর একমাত্র caller), তাই এটা owner-এর dmy/mdy display-setting-এর
 * বাইরে সবসময় এক ফরম্যাট রাখা হয়েছে (UI Polish — আগে numeric d/m/y দেখাত, "Yesterday"-এর
 * সাথে অসামঞ্জস্যপূর্ণ লাগত)। অন্য কোথাও তারিখ দেখাতে formatDisplayDate/settings.dateFormat-ই
 * ব্যবহৃত হয়, অপরিবর্তিত।
 */
export function dateLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const prev = new Date(`${today}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  if (date === prev.toISOString().slice(0, 10)) return 'Yesterday';
  const [y, m, d] = date.split('-').map(Number);
  const label = `${MONTHS[m - 1].slice(0, 3)} ${d}`;
  return y === Number(today.slice(0, 4)) ? label : `${label}, ${y}`;
}

/** সব জায়গায় প্রদর্শনের তারিখ-ফরম্যাট — settings.dateFormat অনুযায়ী (ডিফল্ট dmy, যেমন "21/9/2026")। শুধু display-এর জন্য — stored value সবসময় "YYYY-MM-DD"-ই থাকে। */
export function formatDisplayDate(date: string, format: 'dmy' | 'mdy' = 'dmy'): string {
  const [y, m, d] = date.split('-');
  return format === 'mdy' ? `${Number(m)}/${Number(d)}/${y}` : `${Number(d)}/${Number(m)}/${y}`;
}

/** Add/Edit ফর্মের `<input type="date">` overlay-এ owner-পছন্দমতো order দেখাতে (settings.dateFormat, zero-padded) — stored value অপরিবর্তিত "YYYY-MM-DD"। */
export function formatDateForInput(date: string, format: 'dmy' | 'mdy'): string {
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return '';
  return format === 'mdy' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

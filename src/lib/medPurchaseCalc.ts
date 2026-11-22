// ক্রয় তালিকার pure হিসাব (React/Firebase ছাড়া): ফিল্টার, মোট, ধরন-অনুযায়ী গ্রুপ, নাম-সাজেশন, মেমো-টেক্সট।
import type { MedKind, MedPurchase } from '../validation/medPurchaseSchema';
import { MED_KINDS } from '../validation/medPurchaseSchema';
import { LAB_NAMES, MED_NAMES } from './medNames';
import { formatTaka } from './format';

export const KIND_LABEL: Record<MedKind, string> = {
  medicine: 'ঔষধ',
  lab: 'ল্যাব টেস্ট',
  operation: 'অপারেশন',
  other: 'অন্যান্য',
};

export interface MedFilter {
  query?: string;
  kind?: MedKind | 'all';
  patient?: string; // '' = সবাই
  from?: string; // YYYY-MM-DD (অন্তর্ভুক্ত)
  to?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

export function filterPurchases(list: readonly MedPurchase[], f: MedFilter): MedPurchase[] {
  const q = norm(f.query ?? '');
  return list.filter((p) => {
    if (f.kind && f.kind !== 'all' && p.kind !== f.kind) return false;
    if (f.patient && p.patient !== f.patient) return false;
    if (f.from && p.date < f.from) return false;
    if (f.to && p.date > f.to) return false;
    if (q && !norm(`${p.name} ${p.dose} ${p.patient} ${p.note}`).includes(q)) return false;
    return true;
  });
}

/** নতুন তারিখ আগে; একই তারিখে নাম অনুযায়ী (স্থিতিশীল ক্রম)। */
export function sortPurchases(list: readonly MedPurchase[]): MedPurchase[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

export function totalMinor(list: readonly MedPurchase[]): number {
  return list.reduce((s, p) => s + p.amountMinor, 0);
}

export function yearsOf(list: readonly MedPurchase[]): string[] {
  return [...new Set(list.map((p) => p.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
}

export function patientsOf(list: readonly MedPurchase[]): string[] {
  return [...new Set(list.map((p) => p.patient).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export interface KindGroup {
  kind: MedKind;
  rows: MedPurchase[]; // তারিখ অনুযায়ী পুরনো→নতুন (ফর্দের জন্য)
  subtotalMinor: number;
}

export function groupByKind(list: readonly MedPurchase[]): KindGroup[] {
  const out: KindGroup[] = [];
  for (const kind of MED_KINDS) {
    const rows = list.filter((p) => p.kind === kind).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
    if (rows.length > 0) out.push({ kind, rows, subtotalMinor: totalMinor(rows) });
  }
  return out;
}

/** নাম-সাজেশন: আগে নিজের লেখা নাম, তারপর স্ট্যাটিক তালিকা; শুরুতে-মেলা আগে। exact-মিল বাদ। */
export function suggestNames(query: string, kind: MedKind, history: readonly string[], limit = 6): string[] {
  const q = norm(query);
  if (!q) return [];
  const staticPool = kind === 'medicine' ? MED_NAMES : kind === 'lab' ? LAB_NAMES : [];
  const seen = new Set<string>();
  const hits: string[] = [];
  for (const n of [...history, ...staticPool]) {
    const k = norm(n);
    if (seen.has(k) || k === q || !k.includes(q)) continue;
    seen.add(k);
    hits.push(n);
  }
  const rank = (n: string) => (norm(n).startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

/** ফর্দ/মেমোর প্লেইন টেক্সট (শেয়ার/কপির জন্য)। তারিখ-ফরম্যাট কলার দেয়। */
export function buildMemoText(
  list: readonly MedPurchase[],
  opts: { title: string; period: string; patient: string; fmtDate: (d: string) => string },
): string {
  const lines: string[] = [opts.title, opts.period];
  if (opts.patient) lines.push(`রোগী: ${opts.patient}`);
  for (const g of groupByKind(list)) {
    lines.push('', `${KIND_LABEL[g.kind]} (${formatTaka(g.subtotalMinor)})`);
    g.rows.forEach((p, i) => {
      const who = opts.patient || !p.patient ? '' : ` — ${p.patient}`;
      lines.push(`${i + 1}. ${opts.fmtDate(p.date)} | ${p.name}${p.dose ? ` ${p.dose}` : ''} | ${formatTaka(p.amountMinor)}${who}`);
    });
  }
  lines.push('', `সর্বমোট: ${formatTaka(totalMinor(list))}`);
  return lines.join('\n');
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** ছাপা/PDF-এর জন্য স্বয়ংসম্পূর্ণ HTML (সব ইউজার-টেক্সট escape করা — XSS নিরাপদ)। */
export function buildMemoHtml(
  list: readonly MedPurchase[],
  opts: { title: string; period: string; patient: string; fmtDate: (d: string) => string },
): string {
  const groups = groupByKind(list)
    .map((g) => {
      const rows = g.rows
        .map((p, i) => {
          const who = opts.patient || !p.patient ? '' : ` · ${esc(p.patient)}`;
          return `<tr><td class="n">${i + 1}</td><td>${esc(p.name)}${p.dose ? ` <span class="m">· ${esc(p.dose)}</span>` : ''}<div class="m">${esc(opts.fmtDate(p.date))}${who}</div></td><td class="a">${esc(formatTaka(p.amountMinor))}</td></tr>`;
        })
        .join('');
      return `<h2>${esc(KIND_LABEL[g.kind])} <span>${esc(formatTaka(g.subtotalMinor))}</span></h2><table>${rows}</table>`;
    })
    .join('');
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(opts.title)}</title><style>
@page{size:A4;margin:16mm}body{font-family:"Noto Sans Bengali","Hind Siliguri",system-ui,sans-serif;color:#1d2b22;font-size:13px;margin:0}
h1{text-align:center;font-size:20px;margin:0 0 4px}.p{text-align:center;color:#5b6b60;margin:0 0 2px}
h2{display:flex;justify-content:space-between;font-size:15px;margin:18px 0 4px;padding-bottom:4px;border-bottom:1.5px solid #1d2b22}
table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px dashed #b9c2bb;vertical-align:top}
.n{width:24px;color:#5b6b60}.a{text-align:right;white-space:nowrap}.m{color:#5b6b60;font-size:11.5px}
.t{display:flex;justify-content:space-between;margin-top:20px;padding-top:8px;border-top:2px solid #1d2b22;font-size:17px;font-weight:700}
</style></head><body><h1>${esc(opts.title)}</h1><p class="p">${esc(opts.period)}</p>${opts.patient ? `<p class="p">রোগী: ${esc(opts.patient)}</p>` : ''}${groups}<div class="t"><span>সর্বমোট</span><span>${esc(formatTaka(totalMinor(list)))}</span></div></body></html>`;
}

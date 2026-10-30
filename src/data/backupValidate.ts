// Restore-এর আগের যাচাই (pure — Firebase import নেই, তাই সহজে টেস্টযোগ্য)।
// firestore.rules-এর validWrite()-এর আয়না: rules যা প্রত্যাখ্যান করে, restore শুরুর আগেই তা ধরা হয় —
// যাতে ফাইলে একটাও অবৈধ doc থাকলে বর্তমান ডেটায় হাতই না পড়ে (Zero Data Loss)।
// ⚠️ firestore.rules-এর validWrite বদলালে এখানেও একই বদল লাগবে।
type Doc = Record<string, unknown>;

const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v);
const posInt = (v: unknown): boolean => isInt(v) && (v as number) > 0;
const strLen = (s: string): number => Array.from(s).length;
const nameOk = (d: Doc): boolean => typeof d.name === 'string' && d.name.length > 0;
const optPosInt = (d: Doc, k: string): boolean => !(k in d) || d[k] === null || posInt(d[k]);
const optStr = (d: Doc, k: string, max: number): boolean =>
  !(k in d) || d[k] === null || (typeof d[k] === 'string' && strLen(d[k] as string) <= max);
const LOGO_RE = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const logoOk = (d: Doc): boolean =>
  !('logo' in d) ||
  d.logo === null ||
  (typeof d.logo === 'string' && d.logo.length <= 40000 && LOGO_RE.test(d.logo));
const oneOf = (v: unknown, list: readonly string[]): boolean => typeof v === 'string' && list.includes(v);

/** কোনো doc rules-এ আটকালে কারণ (ছোট বার্তা), ঠিক থাকলে null। */
function docProblem(col: string, d: Doc): string | null {
  switch (col) {
    case 'transactions':
      if (!posInt(d.amountMinor)) return 'amountMinor must be a positive integer';
      if (!oneOf(d.type, ['income', 'expense'])) return 'type must be income or expense';
      if (typeof d.date !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.date)) return 'date must be YYYY-MM-DD';
      return null;
    case 'labels':
    case 'categories':
      return nameOk(d) ? null : 'name must be a non-empty string';
    case 'customLedgers':
      if (!nameOk(d)) return 'name must be a non-empty string';
      return oneOf(d.kind, ['deposit', 'investment']) ? null : 'kind must be deposit or investment';
    case 'debts':
      return posInt(d.totalAmountMinor) ? null : 'totalAmountMinor must be a positive integer';
    case 'investments':
      if (!posInt(d.principalMinor)) return 'principalMinor must be a positive integer';
      if (!optPosInt(d, 'round')) return 'round must be a positive integer';
      if (!optStr(d, 'companyId', 100) || !optStr(d, 'platformNo', 30) || !optStr(d, 'contractFileId', 100) || !optStr(d, 'contractName', 120)) {
        return 'a text field is too long or not text';
      }
      return null;
    case 'investmentCompanies':
      if (!nameOk(d) || strLen(d.name as string) > 60) return 'name must be 1-60 characters';
      if (!optStr(d, 'medium', 60)) return 'medium must be text up to 60 characters';
      return logoOk(d) ? null : 'logo must be a small webp/png/jpeg data URL';
    case 'homeDeposits':
      return posInt(d.amountMinor) ? null : 'amountMinor must be a positive integer';
    case 'gpfEntries':
      if (!posInt(d.amountMinor)) return 'amountMinor must be a positive integer';
      return oneOf(d.type, ['contribution', 'interest', 'withdrawal']) ? null : 'type must be contribution, interest or withdrawal';
    case 'accountBalances':
      return isInt(d.balanceMinor) ? null : 'balanceMinor must be an integer';
    case 'netWorthSnapshots':
      return isInt(d.totalAssetsMinor) ? null : 'totalAssetsMinor must be an integer';
    case 'historicalYearlyTotals':
      return isInt(d.totalIncomeMinor) && isInt(d.totalExpenseMinor) && isInt(d.totalDepositMinor)
        ? null
        : 'totalIncomeMinor/totalExpenseMinor/totalDepositMinor must be integers';
    default:
      return null; // accounts, depositFunds ইত্যাদি — rules-এ বাড়তি শর্ত নেই
  }
}

function idProblem(id: string): string | null {
  if (id.length === 0 || id.includes('/') || id === '.' || id === '..' || /^__.*__$/.test(id)) return 'invalid document id';
  return null;
}

/** সব সমস্যার তালিকা ("collection/id: কারণ"); খালি = restore নিরাপদ। */
export function findBackupProblems(
  collections: Record<string, unknown>,
  cols: readonly string[],
  settings?: unknown,
): string[] {
  const out: string[] = [];
  for (const col of cols) {
    if (!(col in collections)) continue; // পুরনো ব্যাকআপে নেই → restore-ও এড়িয়ে যায়
    const docs = collections[col];
    if (!isObj(docs)) {
      out.push(`${col}: must be an object of documents`);
      continue;
    }
    for (const [id, d] of Object.entries(docs)) {
      const why = idProblem(id) ?? (isObj(d) ? docProblem(col, d) : 'document must be an object');
      if (why) out.push(`${col}/${id}: ${why}`);
    }
  }
  if (settings !== undefined && settings !== null && !isObj(settings)) out.push('settings: must be an object');
  return out;
}

/** সমস্যা থাকলে Error ছোঁড়ে (কিছু লেখা/মোছার আগে)। */
export function assertBackupValid(
  collections: Record<string, unknown>,
  cols: readonly string[],
  settings?: unknown,
): void {
  const problems = findBackupProblems(collections, cols, settings);
  if (problems.length === 0) return;
  const shown = problems.slice(0, 3).join('; ');
  const more = problems.length > 3 ? ` (+${problems.length - 3} more)` : '';
  throw new Error(`Backup has ${problems.length} invalid item(s) — nothing was changed. ${shown}${more}`);
}

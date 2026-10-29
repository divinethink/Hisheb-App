import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Owner-নিয়ম: তারিখ-ফরম্যাট (Settings → Appearance) অ্যাপের সব তারিখ-ইনপুটে মানতে হবে।
// তাই raw `<input type="date">` শুধু DateInput-এ (এবং পুরনো "স্বচ্ছ overlay" দুই পর্দায়, যারা নিজে formatDisplayDate দেখায়)। নতুন ফর্মে DateInput ব্যবহার করুন।
const ALLOWED = new Set(['DateInput.tsx', 'InvestmentDetailScreen.tsx', 'DebtDetailScreen.tsx']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('date input guard', () => {
  it('no raw type="date" outside DateInput', () => {
    const offenders = walk(join(process.cwd(), 'src'))
      .filter((f) => !ALLOWED.has(f.split(/[\\/]/).pop() ?? ''))
      .filter((f) => /type=["']date["']/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

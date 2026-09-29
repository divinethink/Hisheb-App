// CSV-seeded পুরনো category-র type===null ফিক্স করে — transaction ইতিহাস থেকে majority income/expense
// বের করে (lib/categoryTypeInfer.ts, pure)। শুধু বর্তমানে type===null এমন ক্যাটেগরি আপডেট হয়; ম্যানুয়ালি
// সেট করা কিছু কখনো বদলায় না।
import { useState } from 'react';
import FullScreenPage from '../../common/FullScreenPage';
import { getCategoriesOnce, updateCategoryType } from '../../../data/catalogRepo';
import { getAllTransactions } from '../../../data/transactionRepo';
import { inferCategoryTypes, type CategoryTypeSuggestion } from '../../../lib/categoryTypeInfer';

type Step = 'pick' | 'review' | 'done' | 'error';

export default function FixCategoryTypes({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<CategoryTypeSuggestion[]>([]);
  const [appliedCount, setAppliedCount] = useState(0);

  async function scan() {
    setBusy(true);
    setError('');
    try {
      const [categories, transactions] = await Promise.all([getCategoriesOnce(uid), getAllTransactions(uid)]);
      const found = inferCategoryTypes(categories, transactions);
      setSuggestions(found);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    setError('');
    try {
      for (const s of suggestions) await updateCategoryType(uid, s.categoryId, s.inferredType);
      setAppliedCount(suggestions.length);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenPage title="Fix Category Types (from history)" onBack={onClose}>
      {step === 'pick' && (
        <div>
          <p className="text-sm text-muted">
            CSV import থেকে seed হওয়া পুরনো category-র type (income/expense) সেট নেই বলে Add Transaction-এ ভুল
            তালিকায় দেখা যাচ্ছে। এই টুল প্রতিটা এমন category-র লেনদেন-ইতিহাস স্ক্যান করে সঠিক type suggest
            করবে — শুধু preview, কিছু আপনার approval ছাড়া বদলাবে না। ম্যানুয়ালি সেট করা category কখনো touch হয় না।
          </p>
          <button type="button" onClick={() => void scan()} disabled={busy} className="mt-4 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-40">
            {busy ? 'Scanning…' : 'Scan'}
          </button>
        </div>
      )}

      {step === 'review' && (
        <div>
          {suggestions.length === 0 ? (
            <p className="text-sm text-fg">কোনো ঠিক-করার মতো category পাওয়া যায়নি — সব category-র type ইতিমধ্যে সেট, অথবা ইতিহাস নেই।</p>
          ) : (
            <>
              <p className="text-sm text-fg">{suggestions.length}টা category-র type সেট করা হবে:</p>
              <div className="mt-3 space-y-2">
                {suggestions.map((s) => (
                  <div key={s.categoryId} className="flex items-center justify-between rounded-lg border border-muted/30 p-3 text-sm">
                    <span className="text-fg">{s.categoryName}</span>
                    <span className={s.inferredType === 'income' ? 'text-income' : 'text-expense'}>
                      {s.inferredType} ({s.inferredType === 'income' ? s.incomeCount : s.expenseCount}/{s.incomeCount + s.expenseCount})
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setStep('pick')} disabled={busy} className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
                  Back
                </button>
                <button type="button" onClick={() => void apply()} disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-40">
                  Apply {suggestions.length}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'done' && (
        <div>
          <p className="text-base font-semibold text-fg">✅ Done</p>
          <p className="mt-2 text-sm text-fg">{appliedCount}টা category-র type আপডেট হয়েছে।</p>
          <button type="button" onClick={onClose} className="mt-6 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-canvas">
            Done
          </button>
        </div>
      )}

      {step === 'error' && (
        <div>
          <p role="alert" className="text-sm text-fg">
            Failed: {error}
          </p>
          <button type="button" onClick={() => setStep('pick')} className="mt-4 min-h-11 rounded-lg border border-muted/40 px-4 text-sm text-fg">
            Retry
          </button>
        </div>
      )}
    </FullScreenPage>
  );
}

// Pure (SDK-মুক্ত, unit-testable) — CSV-seeded category.type===null ক্যাটেগরিগুলোর জন্য transaction
// ইতিহাস থেকে majority income/expense বের করে। ম্যানুয়ালি-সেট (type !== null) ক্যাটেগরি কখনো touch হয় না।
import type { Transaction } from '../validation/transactionSchema';
import type { Category } from '../validation/catalogSchemas';

export interface CategoryTypeSuggestion {
  categoryId: string;
  categoryName: string;
  inferredType: 'income' | 'expense';
  incomeCount: number;
  expenseCount: number;
}

export function inferCategoryTypes(categories: Category[], transactions: Transaction[]): CategoryTypeSuggestion[] {
  const counts = new Map<string, { income: number; expense: number }>();
  for (const t of transactions) {
    const c = counts.get(t.categoryId) ?? { income: 0, expense: 0 };
    if (t.type === 'income') c.income++;
    else c.expense++;
    counts.set(t.categoryId, c);
  }

  const out: CategoryTypeSuggestion[] = [];
  for (const cat of categories) {
    if (cat.type !== null) continue; // ম্যানুয়ালি সেট করা কখনো override না
    const c = counts.get(cat.id);
    if (!c || (c.income === 0 && c.expense === 0)) continue; // কোনো ইতিহাস নেই — skip
    out.push({
      categoryId: cat.id,
      categoryName: cat.name,
      inferredType: c.income >= c.expense ? 'income' : 'expense',
      incomeCount: c.income,
      expenseCount: c.expense,
    });
  }
  return out;
}

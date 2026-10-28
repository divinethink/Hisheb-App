// কোম্পানি-পাতার pure হিসাব (ধাপ ২) — UI/SDK-মুক্ত। বিদ্যমান investmentCalc reuse; কোনো .limit() নেই, পুরো তালিকা থেকে।
import { investmentStatus, profitMinor, sumRepayments, type Repayment } from './investmentCalc';
import { stripRoundTag } from './investmentName';

interface InvLike {
  id: string;
  date: string;
  investedTo: string;
  companyId?: string | null;
  principalMinor: number;
  repayments: readonly Repayment[];
}

export interface CompanyTotals {
  rounds: number;
  investedMinor: number;
  repaidMinor: number;
  /** শুধু closed (Σrepayments ≥ principal) থেকে — C8, per-month attribution নয় */
  profitClosedMinor: number;
}

/** companyId-তে যুক্ত এন্ট্রিগুলো, নতুন আগে (একই তারিখে মূল ক্রম বজায়)। */
export function entriesOfCompany<T extends InvLike>(all: readonly T[], companyId: string): T[] {
  return all.filter((i) => i.companyId === companyId).sort((a, b) => b.date.localeCompare(a.date));
}

export function companyTotals(entries: readonly InvLike[]): CompanyTotals {
  let invested = 0;
  let repaid = 0;
  let profit = 0;
  for (const i of entries) {
    invested += i.principalMinor;
    repaid += sumRepayments(i.repayments);
    if (investmentStatus(i.principalMinor, i.repayments) === 'closed') profit += profitMinor(i.principalMinor, i.repayments);
  }
  return { rounds: entries.length, investedMinor: invested, repaidMinor: repaid, profitClosedMinor: profit };
}

/**
 * Link সাজেশন: কোনো কোম্পানির সাথে যুক্ত নয় এমন এন্ট্রি, যার নাম ([n] বাদে) কোম্পানির নামে শুরু হয় (বড়-ছোট হাত অগ্রাহ্য)।
 * শুধু সাজেশন — Owner নিশ্চিত করলেই companyId বসে; নাম কখনো ছোঁয়া হয় না।
 */
export function linkSuggestions<T extends InvLike>(all: readonly T[], companyName: string): T[] {
  const n = companyName.trim().toLowerCase();
  if (!n) return [];
  return all
    .filter((i) => !i.companyId && stripRoundTag(i.investedTo).trim().toLowerCase().startsWith(n))
    .sort((a, b) => b.date.localeCompare(a.date));
}

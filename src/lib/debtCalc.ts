// দেনা-পাওনা ক্যালকুলেশন — pure, platform-independent (lib/ purity, Architecture Plan §০/§১৩)।
export interface Repayment {
  date: string;
  amountMinor: number;
}

export function sumRepayments(repayments: readonly Repayment[]): number {
  return repayments.reduce((s, r) => s + r.amountMinor, 0);
}

/** ০-তে ক্ল্যাম্প — over-repayment হলেও Outstanding কখনো ঋণাত্মক দেখাবে না (E5: warning অন্য জায়গায়)। */
export function outstandingMinor(totalAmountMinor: number, repayments: readonly Repayment[]): number {
  return Math.max(0, totalAmountMinor - sumRepayments(repayments));
}

export type RepaymentStatus = 'outstanding' | 'partial' | 'paid';

/** অটো-ক্যালকুলেট, কখনো Firestore-এ store হয় না (Architecture Plan §১৩ Auto vs Manual precedence, C3)। */
export function repaymentStatus(totalAmountMinor: number, repayments: readonly Repayment[]): RepaymentStatus {
  const paid = sumRepayments(repayments);
  if (paid <= 0) return 'outstanding';
  if (paid >= totalAmountMinor) return 'paid';
  return 'partial';
}

export const REPAYMENT_STATUS_LABEL: Record<RepaymentStatus, string> = {
  outstanding: 'Outstanding',
  partial: 'Partially Paid',
  paid: 'Fully Paid',
};

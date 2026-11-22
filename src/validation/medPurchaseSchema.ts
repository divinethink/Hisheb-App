// medPurchases/{id} — চিকিৎসা-ক্রয় তালিকা (ওষুধ/ল্যাব টেস্ট/অপারেশন/অন্যান্য), কল্যাণ বোর্ডে খরচ ফেরতের হিসাবের জন্য।
// Net Worth/বাজেট/Cash-flow-এর সাথে কোনো সম্পর্ক নেই। টাকা পয়সায় ধনাত্মক integer (R1); তারিখ YYYY-MM-DD।
// প্রতিটা কেনা আলাদা doc (Market-এর মতো history[] নয়) — তাই কিছুই ছাঁটা পড়ে না।
import { z } from 'zod';
import { isValidDate } from '../lib/date';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

/** enum না, string+runtime-validation (Dev Rules §২): অজানা মান পড়লে 'other'। */
export const MED_KINDS = ['medicine', 'lab', 'operation', 'other'] as const;
export type MedKind = (typeof MED_KINDS)[number];

/** firestore.rules ও backupValidate-এর সীমার সাথে মিল রাখতে হবে। */
export const MED_LIMITS = { name: 80, dose: 40, patient: 40, note: 200 } as const;

const DateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDate, 'invalid date');

export const MedPurchaseSchema = z.object({
  id: z.string(),
  kind: z.enum(MED_KINDS).catch('other'),
  name: z.string().min(1).max(MED_LIMITS.name),
  dose: z.string().max(MED_LIMITS.dose).default(''),
  amountMinor: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  patient: z.string().max(MED_LIMITS.patient).default(''),
  note: z.string().max(MED_LIMITS.note).default(''),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type MedPurchase = z.infer<typeof MedPurchaseSchema>;

export const MedPurchaseInputSchema = z.object({
  kind: z.enum(MED_KINDS),
  name: z.string().trim().min(1).max(MED_LIMITS.name),
  dose: z.string().trim().max(MED_LIMITS.dose).default(''),
  amountMinor: z.number().int().positive(),
  date: DateStr,
  patient: z.string().trim().max(MED_LIMITS.patient).default(''),
  note: z.string().trim().max(MED_LIMITS.note).default(''),
});
export type MedPurchaseInput = z.input<typeof MedPurchaseInputSchema>;

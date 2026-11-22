// zakatAssets/{id} ও zakatPayments/{id} — P8 Zakat Calculator (Architecture Plan §২)।
// zakatAssets: অ্যাপের বাইরের যাকাতযোগ্য সম্পদ (গহনা, ফসল, অন্যান্য)। zakatPayments: কবে কত যাকাত দেওয়া হলো তার সরল রেকর্ড —
// calculation থেকে সম্পূর্ণ স্বতন্ত্র, একটা আরেকটাকে auto-affect করে না। টাকা পয়সায় ধনাত্মক integer (R1)।
// firestore.rules-এর সাথে মিল: নাম ≤৮০, category enum, valueMinor int > 0, weightGrams number > 0, irrigationMethod enum।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// string + Zod enum (Roadmap §D.6)
export const ZakatCategorySchema = z.enum(['goldJewelry', 'silverJewelry', 'agriculturalProduce', 'other']);
export const IrrigationMethodSchema = z.enum(['rainfed', 'irrigated']);

export const ZakatAssetSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  category: ZakatCategorySchema,
  weightGrams: nullish(z.number().positive().max(1_000_000)), // শুধু গহনায়; মূল্য = ওজন × সেই ধাতুর দাম (লাইভ)
  valueMinor: nullish(z.number().int().positive()), // ফসল ও অন্যান্যে সরাসরি
  irrigationMethod: nullish(IrrigationMethodSchema), // শুধু ফসলে: rainfed ১০%, irrigated ৫%
  zakatable: z.boolean().default(true),
  note: z.string().max(200).default(''),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type ZakatAsset = z.infer<typeof ZakatAssetSchema>;

export const ZakatAssetInputSchema = ZakatAssetSchema.omit({ id: true, createdAt: true, updatedAt: true }).superRefine((v, ctx) => {
  const jewelry = v.category === 'goldJewelry' || v.category === 'silverJewelry';
  if (jewelry && v.weightGrams == null) ctx.addIssue({ code: 'custom', path: ['weightGrams'], message: 'weight required' });
  if (!jewelry && v.valueMinor == null) ctx.addIssue({ code: 'custom', path: ['valueMinor'], message: 'value required' });
  if (v.category === 'agriculturalProduce' && v.irrigationMethod == null) {
    ctx.addIssue({ code: 'custom', path: ['irrigationMethod'], message: 'irrigation required' });
  }
});
export type ZakatAssetInput = z.input<typeof ZakatAssetInputSchema>;

export const ZakatPaymentSchema = z.object({
  id: z.string(),
  date: DateStr,
  amountMinor: z.number().int().positive(), // R1, rules posInt()-এর সাথে মিল
  note: z.string().max(200).default(''),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type ZakatPayment = z.infer<typeof ZakatPaymentSchema>;
export const ZakatPaymentInputSchema = ZakatPaymentSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type ZakatPaymentInput = z.input<typeof ZakatPaymentInputSchema>;

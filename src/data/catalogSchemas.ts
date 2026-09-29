// categories / labels (Architecture Plan §২, B2/B6)। P1-এ শুধু list + নাম-মাত্র quick-add।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

export const NameSchema = z.string().trim().min(1).max(60);

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  icon: nullish(z.string()),
  color: nullish(z.string()), // owner-approved additive field (hex, e.g. '#22c55e') — null = auto color
  // ধারণা-অনুমান (owner-কে জানানো): income/expense বা null (উভয়ে) — picker ফিল্টারের জন্য
  type: nullish(z.enum(['income', 'expense'])),
  archived: z.boolean().default(false),
  monthlyBudgetMinor: nullish(z.number().int().positive()),
  order: z.number().default(0),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type Category = z.infer<typeof CategorySchema>;

export const LabelSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  icon: nullish(z.string()),
  color: nullish(z.string()), // owner-approved additive field (hex) — null = auto color
  archived: z.boolean().default(false),
  order: z.number().default(0),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type Label = z.infer<typeof LabelSchema>;

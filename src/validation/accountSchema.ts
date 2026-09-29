// accounts/{id} — Architecture Plan §২। holder ঐচ্ছিক free-text (enum future-proofing নীতি, §D.6) —
// owner "Me"/"Wife"/যেকোনো নাম টাইপ করবেন, rigid enum না। শুরুর ব্যালেন্স ফিল্ড নেই (O6, চূড়ান্ত)।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  order: z.number().default(0),
  holder: nullish(z.string().trim().min(1).max(30)),
  currency: z.string().default('BDT'),
  archived: z.boolean().default(false),
  zakatable: z.boolean().default(true),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type Account = z.infer<typeof AccountSchema>;

export const AccountInputSchema = AccountSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type AccountInput = z.input<typeof AccountInputSchema>;

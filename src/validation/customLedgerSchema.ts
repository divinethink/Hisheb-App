// customLedgers/{id} — owner-created named ledger, "kind" wraps an existing engine:
// kind='deposit' → backed by a normal depositFunds/{fundId} doc (auto-created).
// kind='investment' → investments/{id} docs tagged with ledgerId (additive field).
// Zero new calc/aggregate logic — this is a thin grouping/label layer only.
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

export const CustomLedgerKindSchema = z.enum(['deposit', 'investment']);

export const CustomLedgerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  kind: CustomLedgerKindSchema,
  // শুধু kind='deposit'-এ সেট থাকে — সেই depositFunds/{fundId} doc-এর reference।
  fundId: nullish(z.string()),
  archived: z.boolean().default(false),
  order: z.number().default(0),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type CustomLedger = z.infer<typeof CustomLedgerSchema>;
export const CustomLedgerInputSchema = CustomLedgerSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CustomLedgerInput = z.input<typeof CustomLedgerInputSchema>;

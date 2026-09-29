// settings/{doc} — সব ফিল্ড optional/nullable + default (defensive read, Roadmap Ai-নিয়ম E.4)।
// P1a-তে schema-তে থাকা নিশ্চিত করা হচ্ছে (B1, C4, G2, G3); UI/লজিক পরের Phase-এ।
import { z } from 'zod';

const minorOrNull = z.number().int().positive().nullish().transform((v) => v ?? null);
const dateOrNull = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().transform((v) => v ?? null);

export const SettingsSchema = z.object({
  themeColor: z.string().default('blue'),
  displayMode: z.enum(['light', 'dark', 'system']).default('system'),
  dateFormat: z.enum(['dmy', 'mdy']).default('dmy'), // date display order (day/month/year vs month/day/year)
  reminderEnabled: z.boolean().default(true),
  appLockEnabled: z.boolean().default(false), // flag only — implement হচ্ছে না
  baseCurrency: z.string().default('BDT'),
  overallMonthlyBudgetMinor: minorOrNull, // B1
  lastReminderShownDate: dateOrNull, // C4
  lastBudgetThresholdShownDate: dateOrNull, // C4
  lastBudgetThresholdShownLevel: z.enum(['70', '80', '90', '100']).nullish().transform((v) => v ?? null), // C4
  lastDueDateReminderShownDate: dateOrNull, // G2
  largeAmountWarningThresholdMinor: minorOrNull, // G3 (null = ফিচার off)
  zakatNisabStandard: z.enum(['gold', 'silver']).nullish().transform((v) => v ?? null),
  zakatGoldPriceMinor: minorOrNull,
  zakatSilverPriceMinor: minorOrNull,
  zakatCalculationDate: dateOrNull,
  legacyAccessNote: z.string().nullish().transform((v) => v ?? null),
});
export type Settings = z.infer<typeof SettingsSchema>;

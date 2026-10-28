// investmentCompanies/{id} — কোম্পানি-তালিকা (Investment ধাপ ১)। নাম + ঐচ্ছিক Medium + ঐচ্ছিক ছোট লোগো।
// লোগো = ফোনেই ছোট করা data-URL (≈১০KB), Storage/Blaze লাগে না; ব্যাকআপ JSON-এ নিজে থেকে ঢোকে।
import { z } from 'zod';

const TimestampLike = z.custom<{ toDate(): Date }>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function',
);
const nullish = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

/** firestore.rules-এর সীমার সাথে মিল রাখতে হবে (logo.size() <= ৪০০০০)। */
export const LOGO_MAX_CHARS = 40000;
export const LOGO_DATA_URL_RE = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;

/** লেখার সময় কড়া: শুধু ছোট webp/png/jpeg data-URL (svg নয়)। */
export const LogoDataUrlSchema = z.string().max(LOGO_MAX_CHARS).regex(LOGO_DATA_URL_RE);

/** পড়ার সময় নমনীয় (defensive read) — খারাপ logo থাকলেও ডক বাদ পড়ে না, শুধু লোগো দেখানো হয় না। */
export function safeLogo(logo: string | null | undefined): string | null {
  return typeof logo === 'string' && logo.length <= LOGO_MAX_CHARS && LOGO_DATA_URL_RE.test(logo) ? logo : null;
}

export const InvestmentCompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  medium: z.string().max(60).default(''),
  logo: nullish(z.string()),
  createdAt: nullish(TimestampLike),
  updatedAt: nullish(TimestampLike),
});
export type InvestmentCompany = z.infer<typeof InvestmentCompanySchema>;

export const InvestmentCompanyInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  medium: z.string().trim().max(60).default(''),
  logo: nullish(LogoDataUrlSchema),
});
export type InvestmentCompanyInput = z.input<typeof InvestmentCompanyInputSchema>;

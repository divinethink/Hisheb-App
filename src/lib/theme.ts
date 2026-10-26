// Pure theme logic (platform-independent, DOM-মুক্ত) — Architecture Plan §৬, UI Mockup §৮.৫।
export type DisplayMode = 'light' | 'dark' | 'sepia' | 'system';
export type ResolvedMode = 'light' | 'dark' | 'sepia';
export type AccentId = 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'rose' | 'terracotta' | 'nord' | 'olive' | 'mocha';

export const ACCENTS: readonly { id: AccentId; label: string }[] = [
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'purple', label: 'Purple' },
  { id: 'orange', label: 'Orange' },
  { id: 'teal', label: 'Teal' },
  { id: 'rose', label: 'Rose' },
  { id: 'terracotta', label: 'Terracotta' },
  { id: 'nord', label: 'Nord' },
  { id: 'olive', label: 'Olive' },
  { id: 'mocha', label: 'Mocha' },
];

/** পূর্ণ-প্যালেট থিম (settings.themeColor-এ থিম-id সংরক্ষিত — schema বদল নেই)। থিম নিজেই Light/Dark ঠিক করে (`tone`)। */
export type ThemeId = 'treasury' | 'bull' | 'ledger' | 'terracotta-cream' | 'nord-frost';

export const THEMES: readonly { id: ThemeId; label: string; tone: 'light' | 'dark'; hint: string }[] = [
  { id: 'treasury', label: 'Treasury', tone: 'light', hint: 'Green, cream & gold' },
  { id: 'bull', label: 'Bull Market', tone: 'dark', hint: 'Black with neon green' },
  { id: 'ledger', label: 'Ledger Paper', tone: 'light', hint: 'Sepia paper, ink text' },
  { id: 'terracotta-cream', label: 'Terracotta Cream', tone: 'light', hint: 'Warm clay' },
  { id: 'nord-frost', label: 'Nord Frost', tone: 'light', hint: 'Calm blue-grey' },
];

export function findTheme(v: string | null | undefined) {
  return THEMES.find((t) => t.id === v) ?? null;
}

export function resolveMode(mode: DisplayMode, systemPrefersDark: boolean): ResolvedMode {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

/** settings.themeColor একটা free string (enum future-proofing) — অজানা মান হলে ডিফল্ট blue */
export function normalizeAccent(v: string | null | undefined): AccentId | ThemeId {
  return findTheme(v)?.id ?? ACCENTS.find((a) => a.id === v)?.id ?? 'blue';
}

// Pure theme logic (platform-independent, DOM-মুক্ত) — Architecture Plan §৬, UI Mockup §৮.৫।
export type DisplayMode = 'light' | 'dark' | 'system';
export type AccentId = 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'rose';

export const ACCENTS: readonly { id: AccentId; label: string }[] = [
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'purple', label: 'Purple' },
  { id: 'orange', label: 'Orange' },
  { id: 'teal', label: 'Teal' },
  { id: 'rose', label: 'Rose' },
];

export function resolveMode(mode: DisplayMode, systemPrefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

/** settings.themeColor একটা free string (enum future-proofing) — অজানা মান হলে ডিফল্ট blue */
export function normalizeAccent(v: string | null | undefined): AccentId {
  return ACCENTS.find((a) => a.id === v)?.id ?? 'blue';
}

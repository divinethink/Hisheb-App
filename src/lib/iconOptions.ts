// Category/Label icon+color picker-এর curated তালিকা — pure lookup, কোনো React/Firebase
// import না (lib/ purity, §৪)। ICON_OPTIONS = categoryIcons.ts-এর RULES থেকে dedup + কিছু generic যোগ।
export const ICON_OPTIONS: string[] = [
  '🛒', '🍽️', '☕', '🚌', '✈️', '🏠', '🛍️', '🧰', '🎉', '🎁',
  '💊', '📱', '💰', '🎖️', '📈', '🏦', '📄', '👨‍👩‍👧', '👤', '💸',
  '🏷️', '🎓', '🚗', '🐾', '🎵', '🎬', '❤️', '🏥', '👶', '📚',
  // owner-request, ২০২৬-০৯-২৬: bearded man/smart woman/palace/building/village house/tools/baby boy/baby girl
  '🧔', '👩‍💼', '🏰', '🏢', '🏘️', '🛠️', '👦', '👧',
];

export const COLOR_OPTIONS: string[] = [
  '#22c55e', '#ef4444', '#f97316', '#eab308', '#06b6d4', '#ec4899', '#3b82f6', '#a855f7',
];

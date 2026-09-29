// Category-র নামের সাথে কীওয়ার্ড-মিল রেখে একটা emoji আইকন বের করে (category.icon সেট করা
// থাকলে সেটাই আগে ব্যবহার হয়, Architecture Plan §২)। এটা শুধু pure lookup — কোনো
// React/Firebase import না (lib/ purity, §৪)।

const RULES: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['grocer', 'fruit', 'sweet', 'vegetable', 'fish', 'meat', 'egg'], icon: '🛒' },
  { keywords: ['hotel', 'খাওয়া', 'restaurant', 'lunch', 'launch'], icon: '🍽️' },
  { keywords: ['চা', 'nasta', 'নাস্তা', 'tea', 'coffee'], icon: '☕' },
  { keywords: ['transport', 'bus', 'cng', 'rickshaw', 'uber', 'fare'], icon: '🚌' },
  { keywords: ['tour', 'travel', 'ভ্রমণ'], icon: '✈️' },
  { keywords: ['বাসা', 'বিদ্যুৎ', 'গ্যাস', 'ইন্টারনেট', 'ময়লা', 'rent', 'electric', 'internet', 'utility'], icon: '🏠' },
  { keywords: ['কেনাকাটা', 'shopping', 'অর্ডার', 'order'], icon: '🛍️' },
  { keywords: ['প্রয়োজনীয়', 'জিনিসপত্র', 'necessary', 'item'], icon: '🧰' },
  { keywords: ['hangout', 'আড্ডা'], icon: '🎉' },
  { keywords: ['উপহার', 'দান', 'gift', 'donat', 'charity', 'রোগী', 'বেড়াতে'], icon: '🎁' },
  { keywords: ['health', 'medicine', 'doctor', 'ঔষধ', 'ডাক্তার', 'hospital'], icon: '💊' },
  { keywords: ['mobile', 'recharge', 'রিচার্জ'], icon: '📱' },
  { keywords: ['salary', 'বেতন'], icon: '💰' },
  { keywords: ['bonus', 'বোনাস', 'honorar', 'ta/da', 'ta / da'], icon: '🎖️' },
  { keywords: ['investment', 'বিনিয়োগ'], icon: '📈' },
  { keywords: ['ধার', 'loan', 'debt'], icon: '🏦' },
  { keywords: ['tax', 'ট্যাক্স'], icon: '📄' },
  { keywords: ['পরিবার', 'family', 'পক্ষ', 'বাড়ি'], icon: '👨‍👩‍👧' },
  { keywords: ['মা', 'বাবা', 'হিরা', 'hira', 'raiyan', 'rifa', 'hasan tuhin', 'wife', 'husband'], icon: '👤' },
  { keywords: ['other', 'অন্যান্য'], icon: '💸' },
];

export function getCategoryIcon(name: string, type: 'income' | 'expense' | null = null): string {
  const n = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => n.includes(k.toLowerCase()))) return rule.icon;
  }
  return type === 'income' ? '💰' : '🏷️';
}

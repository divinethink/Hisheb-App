// AmountInput-এর calculator keypad (+, −, ×, ÷)-এর জন্য নিরাপদ expression evaluator।
// কখনো eval()/Function() ব্যবহার হয় না — শুধু নিজস্ব token-parse + arithmetic।
// পিওর ফাংশন, কোনো React/Firebase import না (lib/ purity, Architecture Plan §৪)।

const OPERATORS = ['×', '÷', '+', '−'] as const;
type Operator = (typeof OPERATORS)[number];

// একটা single operand: শূন্যও গ্রহণযোগ্য (শুধু চূড়ান্ত ফলাফল ধনাত্মক হতে হবে, R1 — সেটা চূড়ান্ত
// ধাপে parseAmountToMinor দিয়েই যাচাই হবে, এই ফাংশন শুধু expression-টা একটা প্লেইন সংখ্যায় নামায়)।
const OPERAND_RE = /^\d{1,12}(?:\.\d{1,2})?$/;

/** input-এ কোনো ক্যালকুলেটর-অপারেটর আছে কিনা — থাকলেই এই মডিউল সক্রিয় হবে, নাহলে আগের-মতোই plain amount। */
export function hasOperator(input: string): boolean {
  return OPERATORS.some((op) => input.includes(op));
}

function tokenize(expr: string): (string | Operator)[] | null {
  const parts = expr.split(new RegExp(`([${OPERATORS.join('')}])`)).filter((p) => p !== '');
  // বৈধ ফর্ম: number (op number)* — অর্থাৎ even index-এ number, odd index-এ operator।
  if (parts.length === 0 || parts.length % 2 === 0) return null;
  for (let i = 0; i < parts.length; i++) {
    const isOperandSlot = i % 2 === 0;
    if (isOperandSlot) {
      if (!OPERAND_RE.test(parts[i])) return null;
    } else if (!OPERATORS.includes(parts[i] as Operator)) {
      return null;
    }
  }
  return parts as (string | Operator)[];
}

function applyOp(a: number, op: Operator, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return Math.round(a * b * 100) / 100;
    case '÷':
      return b === 0 ? null : Math.round((a / b) * 100) / 100;
  }
}

/**
 * "500+120×2" → "740" (standard precedence: × ÷ আগে, তারপর + −)। অপারেটর না থাকলে বা
 * expression অসম্পূর্ণ/অবৈধ হলে (dangling operator, divide-by-zero, non-positive result) null —
 * caller তখন raw input-ই রেখে দেবে, existing validation (parseAmountToMinor) সেটা ধরবে।
 */
export function evaluateExpression(input: string): string | null {
  const cleaned = input.replace(/[,\s]/g, '');
  const tokens = tokenize(cleaned);
  if (!tokens) return null;

  // পাস ১: × ও ÷ বাম-থেকে-ডানে reduce
  const pass1: (number | Operator)[] = [Number(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as Operator;
    const num = Number(tokens[i + 1]);
    if (op === '×' || op === '÷') {
      const prev = pass1[pass1.length - 1] as number;
      const result = applyOp(prev, op, num);
      if (result === null) return null;
      pass1[pass1.length - 1] = result;
    } else {
      pass1.push(op, num);
    }
  }

  // পাস ২: + ও − বাম-থেকে-ডানে reduce
  let total = pass1[0] as number;
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i] as Operator;
    const num = pass1[i + 1] as number;
    const result = applyOp(total, op, num);
    if (result === null) return null;
    total = result;
  }

  if (!Number.isFinite(total)) return null;
  const minor = Math.round(total * 100);
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  const taka = Math.trunc(minor / 100);
  const paisa = minor % 100;
  return paisa === 0 ? String(taka) : `${taka}.${String(paisa).padStart(2, '0').replace(/0$/, '')}`;
}

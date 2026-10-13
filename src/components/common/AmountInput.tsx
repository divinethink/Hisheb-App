import { useRef } from 'react';
import { evaluateExpression, hasOperator } from '../../lib/calculator';
import { parseAmountToMinor } from '../../lib/money';

// Spendee-স্টাইল layout (owner-request, ২০২৬-০৯-২৬): amount-এর *display* (label+box+expression-
// preview+error, এই ফাইলের default export) ও on-screen calculator keypad (নিচের `AmountKeypad`)
// এখন দুটো আলাদা component — TransactionSheet-এ ফর্মের ওপরে AmountInput ও নিচে (Labels-এর পরে,
// category-grid-এর জায়গায়) AmountKeypad বসে, যাতে top-to-bottom অর্ডার Spendee-র মতো হয়:
// category icon → amount → date & note → labels → keypad। keypad আর নিজে থেকে open/close হয় না,
// step==='details' হলেই AmountKeypad সবসময় দৃশ্যমান।
type Operator = '+' | '−' | '×' | '÷';
const OPERATORS: readonly Operator[] = ['+', '−', '×', '÷'];

const KEY_ROWS: readonly (readonly [string, 'digit' | 'op' | 'back'])[][] = [
  [
    ['1', 'digit'],
    ['2', 'digit'],
    ['3', 'digit'],
    ['÷', 'op'],
  ],
  [
    ['4', 'digit'],
    ['5', 'digit'],
    ['6', 'digit'],
    ['×', 'op'],
  ],
  [
    ['7', 'digit'],
    ['8', 'digit'],
    ['9', 'digit'],
    ['−', 'op'],
  ],
  [
    ['.', 'digit'],
    ['0', 'digit'],
    ['⌫', 'back'],
    ['+', 'op'],
  ],
];

export default function AmountInput({
  value,
  showError,
  type,
  largeAmountThresholdMinor = null,
  onChange,
}: {
  value: string;
  /** দিলে native (OS) numeric কীবোর্ড মোড: field editable, amount-এর পাশে "+" বাটন (BDT-এর আগে)।
   * না দিলে আগের মতো readOnly + AmountKeypad (অন্য সব ফর্ম অপরিবর্তিত)। */
  onChange?: (v: string) => void;
  showError: boolean;
  /** income→সবুজ "+", expense→লাল "−" প্রিফিক্স (Spendee-স্টাইল)। ঐচ্ছিক — যেসব ফর্মে income/expense ধারণা নেই (Debt/Investment/Home Deposit/GPF) সেখানে বাদ দিলে কোনো প্রিফিক্স দেখাবে না, বিদ্যমান আচরণ অপরিবর্তিত। */
  type?: 'income' | 'expense';
  /** G3: null/undefined হলে ফিচার off (settings.largeAmountWarningThresholdMinor)। */
  largeAmountThresholdMinor?: number | null;
}) {
  const native = onChange !== undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  // "+" চাপলে input-এর focus যেন না হারায় (হারালে native কীবোর্ড নেমে যায়) — mousedown/pointerdown
  // default (focus-shift) আটকানো + click-এ আবার focus() (কীবোর্ড আগে থেকেই খোলা থাকলে no-op)।
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  const addPlus = () => {
    if (onChange && value !== '' && !value.endsWith('+')) onChange(value + '+');
    inputRef.current?.focus();
  };
  const exprActive = hasOperator(value);
  const evaluated = exprActive ? evaluateExpression(value) : null;
  // owner-request (২০২৬-০৯-২৬): main field-এ বড় করে total (evaluated) দেখাবে, ছোট লাইনে raw
  // expression — Spendee-র মতো। expression অসম্পূর্ণ থাকলে (evaluated===null) fallback হিসেবে
  // main field-এ raw value-ই থাকে, দেখানোর মতো total এখনো নেই।
  const mainDisplay = exprActive && evaluated !== null ? evaluated : value;
  const parsed = parseAmountToMinor(value);
  // expression অসম্পূর্ণ/অবৈধ (dangling operator, ÷0, non-positive result) অবস্থায় Save চাপলেও
  // যেন silently কিছু না হয়ে স্পষ্ট error দেখা যায়।
  const invalid = showError && (exprActive ? evaluated === null : parsed === null);
  const isLarge =
    !invalid && largeAmountThresholdMinor != null && parsed !== null && parsed > largeAmountThresholdMinor;

  return (
    <div>
      <label htmlFor="amount" className={native ? 'sr-only' : 'mb-1 block text-sm text-muted'}>
        Amount
      </label>
      <div className="flex items-center gap-2">
        <div className="flex min-h-12 flex-1 items-center gap-2 rounded-lg border border-muted/40 bg-surface px-3">
          {type && (
            <span className={type === 'income' ? 'text-income' : 'text-expense'} aria-hidden="true">
              {type === 'income' ? '+' : '−'}
            </span>
          )}
          {native ? (
            // native মোডে বড় field শুধু *মোট* দেখায় (display-only); আসল editable input নিচের লাইনে
            // (raw expression "12+12+12")। field-এ ট্যাপ করলে input-এই focus যায়।
            <span
              aria-hidden="true"
              onMouseDown={keepFocus}
              onClick={() => inputRef.current?.focus()}
              className={`w-full truncate text-xl ${mainDisplay ? 'text-fg' : 'text-muted'}`}
            >
              {mainDisplay || '0'}
            </span>
          ) : (
            // readOnly + inputMode="none" — OS কীবোর্ড খুলবে না; AmountKeypad-ই একমাত্র ইনপুট-উৎস।
            <input
              id="amount"
              ref={inputRef}
              inputMode="none"
              readOnly
              autoComplete="off"
              placeholder="0"
              value={mainDisplay}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'amount-error' : undefined}
              className="w-full bg-transparent text-xl text-fg outline-none"
            />
          )}
        </div>
        {native && (
          <button
            type="button"
            aria-label="Add"
            onMouseDown={keepFocus}
            onPointerDown={keepFocus}
            onClick={addPlus}
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-xl text-primary active:bg-primary/20"
          >
            +
          </button>
        )}
        <span className="text-muted">BDT</span>
      </div>

      {/* সবসময় fixed-height লাইন (ফাঁকা থাকলেও জায়গা ধরে) — expression শুরু/শেষে keypad shake করে না।
          অসম্পূর্ণ expression-এ error না, শুধু চলমান হিসেব; error শুধু Save-এ (নিচের `invalid`)। */}
      {native ? (
        // মূল editable input: expression থাকলে raw "12+12+12" দেখায়; না থাকলে লেখা লুকানো (বড় field-এ
        // একই সংখ্যা আছে, দুবার দেখানো হয় না)।
        <input
          id="amount"
          ref={inputRef}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/,/g, '.').replace(/[^0-9.+]/g, ''))}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'amount-error' : undefined}
          className={`mt-1 block h-5 w-full bg-transparent text-sm outline-none ${
            exprActive ? 'text-muted' : 'text-transparent caret-transparent'
          }`}
        />
      ) : (
        <p className="mt-1 h-5 truncate text-sm text-muted" aria-live="polite">
          {exprActive ? (evaluated !== null ? `${value} =` : value) : '\u00A0'}
        </p>
      )}
      {invalid && (
        <p id="amount-error" role="alert" className="mt-1 text-sm text-expense">
          {exprActive
            ? 'Finish the calculation before saving (e.g. remove a trailing operator).'
            : 'Enter an amount greater than 0 (up to 2 decimals).'}
        </p>
      )}
      {isLarge && (
        <p className="mt-1 text-sm text-muted">Amount looks unusually large — please double-check.</p>
      )}
    </div>
  );
}

/** নিচে (Labels-এর পরে) বসানোর জন্য আলাদা on-screen calculator keypad — AmountInput-এর সাথে
 * শুধু `value`/`onChange` দিয়ে যুক্ত, নিজের কোনো open/close state নেই (parent-এর `step` ঠিক করে
 * এটা render হবে কিনা)। */
export function AmountKeypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // "500+" এর পর আবার অপারেটর না বসুক (dangling), খালি/০ থেকে শুরু করেও অপারেটর না বসুক।
  const appendOperator = (op: Operator) => {
    if (value === '' || (OPERATORS as readonly string[]).includes(value.trim().slice(-1))) return;
    onChange(value + op);
  };
  const appendDigit = (ch: string) => onChange(value + ch);
  const backspace = () => onChange(value.slice(0, -1));

  // owner-request (২০২৬-০৯-২৭, বাগ-ফিক্স): আগে অপারেটর চাপার সাথে সাথেই নিচে একটা আলাদা
  // "=" commit-বাটন-রো যোগ হতো (min-h-11 + gap, প্রায় ৫০px) — এই হঠাৎ যোগ হওয়া রো grid-এর
  // flex-1 জায়গা কমিয়ে দিত, ফলে key-row-গুলো min-h-11-এর নিচে চেপে গিয়ে overflow/visual-glitch
  // (কিপ্যাড "সংকুচিত/ভাঙা" দেখানো) হতো। "=" বাটনটা নিছক সুবিধা ছিল — Save চাপলে বা AmountInput-এর
  // নিজস্ব preview-লাইনেই এক্সপ্রেশন এমনিতেই resolve/দেখা যায় (এই ফাইলের ওপরের অংশ), তাই সেই
  // বাটন সরিয়ে দেওয়া হলো — grid এখন সবসময় স্থির flex-1 জায়গা পায়, অপারেটর চাপলেও কিপ্যাডের
  // height কখনো লাফ দেয় না।
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 rounded-lg border border-muted/40 bg-canvas p-2">
      <div className="grid flex-1 min-h-0 grid-cols-4 grid-rows-4 gap-2">
        {KEY_ROWS.flat().map(([label, kind], i) => (
          <button
            key={`${label}-${i}`}
            type="button"
            aria-label={kind === 'back' ? 'Backspace' : label}
            onClick={
              kind === 'digit'
                ? () => appendDigit(label)
                : kind === 'back'
                  ? backspace
                  : () => appendOperator(label as Operator)
            }
            className={`flex h-full min-h-11 items-center justify-center rounded-lg border text-lg active:bg-muted/10 ${
              kind === 'op'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-muted/40 bg-surface text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

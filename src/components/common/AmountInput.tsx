import { useRef } from 'react';
import { evaluateExpression, hasOperator } from '../../lib/calculator';
import { parseAmountToMinor } from '../../lib/money';

// Amount ইনপুট — native numeric কীবোর্ড + amount-এর পাশে "+" বাটন (expression: "500+200")। label+box+expression-preview+error এই component-এ।
export default function AmountInput({
  value,
  showError,
  type,
  largeAmountThresholdMinor = null,
  onChange,
  autoFocus = false,
}: {
  value: string;
  /** দিলে native (OS) numeric কীবোর্ড মোড: field editable, amount-এর পাশে "+" বাটন (BDT-এর আগে)।
   * ২০২৬-১০-২৫ থেকে অ্যাপের সব Amount-ফর্ম (Transaction, Debt, Borrowing, Repayment, Investment, Home Deposit, GPF)
   * এই মোডে। না দিলে শুধু-পঠনযোগ্য display। */
  onChange?: (v: string) => void;
  showError: boolean;
  /** income→সবুজ "+", expense→লাল "−" প্রিফিক্স (Spendee-স্টাইল)। ঐচ্ছিক — যেসব ফর্মে income/expense ধারণা নেই (Debt/Investment/Home Deposit/GPF) সেখানে বাদ দিলে কোনো প্রিফিক্স দেখাবে না, বিদ্যমান আচরণ অপরিবর্তিত। */
  type?: 'income' | 'expense';
  /** G3: null/undefined হলে ফিচার off (settings.largeAmountWarningThresholdMinor)। */
  largeAmountThresholdMinor?: number | null;
  /** native মোডে mount-এ amount-ঘরে ফোকাস (নতুন entry-তে কীবোর্ড সাথে সাথে খুলতে)। */
  autoFocus?: boolean;
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
  // শেষে "+" ঝুলে থাকলে (পরের সংখ্যা লেখার আগে) raw expression নয়, এ পর্যন্ত চলমান মোট দেখায় — নইলে প্রতিবার "+" চাপতে
  // বড় field মোট ↔ লম্বা expression-এ লাফায় ও বাড়তে বাড়তে BDT/"+" বাটন স্ক্রিনের বাইরে ঠেলে দেয়।
  const running = exprActive && evaluated === null ? evaluateExpression(value.replace(/[+.]+$/, '')) : null;
  const mainDisplay = exprActive ? evaluated ?? running ?? value : value;
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
        <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg border border-muted/40 bg-surface px-3">
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
              className={`min-w-0 flex-1 truncate text-xl ${mainDisplay ? 'text-fg' : 'text-muted'}`}
            >
              {mainDisplay || '0'}
            </span>
          ) : (
            // onChange না দিলে শুধু-পঠনযোগ্য display (কীবোর্ড খোলে না)।
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
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-xl text-primary active:bg-primary/20"
          >
            +
          </button>
        )}
        <span className="shrink-0 text-muted">BDT</span>
      </div>

      {/* সবসময় fixed-height লাইন (ফাঁকা থাকলেও জায়গা ধরে) — expression শুরু/শেষে layout shake করে না।
          অসম্পূর্ণ expression-এ error না, শুধু চলমান হিসেব; error শুধু Save-এ (নিচের `invalid`)। */}
      {native ? (
        // মূল editable input: expression থাকলে raw "12+12+12" দেখায়; না থাকলে লেখা লুকানো (বড় field-এ
        // একই সংখ্যা আছে, দুবার দেখানো হয় না)।
        <input
          id="amount"
          ref={inputRef}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
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

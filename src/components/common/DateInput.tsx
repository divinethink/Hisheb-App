import { formatDateForInput } from '../../lib/date';
import { useSettings } from '../../hooks/useData';

// অ্যাপের একমাত্র তারিখ-ইনপুট: ফরম্যাট (Day/Month/Year বা Month/Day/Year) নিজেই Settings থেকে পড়ে — কল-সাইটকে মনে রাখতে হয় না।
// native `<input type="date">` সরাসরি ব্যবহার নিষেধ (src/lib/dateInputGuard.test.ts এটা ধরে)। stored value সবসময় "YYYY-MM-DD"।
// variant: box = ছোট (min-h-11), tall = ফর্মের সাধারণ (min-h-12), card = FieldCard-এর ভেতরে (ফ্রেম ছাড়া)।
const INPUT_CLASS = {
  box: 'min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3',
  tall: 'min-h-12 w-full rounded-lg border border-muted/40 bg-surface px-3',
  card: 'block min-h-8 w-full bg-transparent',
} as const;
const OVERLAY_CLASS = {
  box: 'left-3',
  tall: 'left-3',
  card: 'left-0 text-base',
} as const;

export default function DateInput({
  uid,
  id = 'date',
  value,
  onChange,
  invalid,
  variant = 'box',
  wrapperClassName = '',
}: {
  uid: string;
  id?: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  variant?: keyof typeof INPUT_CLASS;
  wrapperClassName?: string;
}) {
  const settings = useSettings(uid);
  const dateFormat = settings.state.status === 'ready' ? settings.state.data.dateFormat : 'dmy';
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        id={id}
        type="date"
        lang="en-GB"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className={`${INPUT_CLASS[variant]} text-transparent caret-transparent outline-none`}
      />
      {/* native input-এর নিজস্ব digit-টেক্সট transparent করে ওপরে owner-পছন্দের ফরম্যাটে overlay — click/picker-icon underlying input-এই যায় (pointer-events-none) */}
      <span aria-hidden className={`pointer-events-none absolute inset-y-0 flex items-center text-fg ${OVERLAY_CLASS[variant]}`}>
        {value ? formatDateForInput(value, dateFormat) : ''}
      </span>
    </div>
  );
}

import { formatDateForInput } from '../../lib/date';

export default function DateInput({
  id = 'date',
  value,
  onChange,
  dateFormat,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  dateFormat: 'dmy' | 'mdy';
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="date"
        lang="en-GB"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className="min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-transparent caret-transparent"
      />
      {/* native input-এর নিজস্ব digit-টেক্সট transparent করে ওপরে owner-পছন্দের ফরম্যাটে overlay — click/picker-icon underlying input-এই যায় (pointer-events-none) */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg">
        {value ? formatDateForInput(value, dateFormat) : ''}
      </span>
    </div>
  );
}

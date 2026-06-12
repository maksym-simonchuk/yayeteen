// Booking-форма під-компоненти. Co-located (`_`-префікс → Next.js ігнорує як роут).
// Компонент-файл сторінки містить лише сторінку + Props (component-file rule).

import type { ReactNode } from 'react';
import { cn } from '@ya-ye/ui';

export function RadioOption({
  checked,
  onChange,
  label,
  hint,
  name,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  name: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors',
        checked ? 'border-accent bg-accent/5' : 'border-divider bg-bgSoft',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 accent-accent"
      />
      <span className="flex-1">
        <span className="block font-sans text-sm text-ink">{label}</span>
        {hint && <span className="block font-sans text-xs text-inkSoft">{hint}</span>}
      </span>
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  required,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
        className="mt-1 h-4 w-4 accent-accent"
      />
      <span className="font-sans text-sm leading-relaxed text-ink">{children}</span>
    </label>
  );
}

import type { ReactNode } from 'react';

interface NextStepProps {
  n: string;
  text: ReactNode;
}

export function NextStep({ n, text }: NextStepProps) {
  return (
    <li className="flex gap-3 rounded-2xl border border-divider bg-bgSoft p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-mono text-xs text-accent">
        {n}
      </span>
      <p className="flex-1 font-sans text-sm leading-relaxed text-ink">{text}</p>
    </li>
  );
}

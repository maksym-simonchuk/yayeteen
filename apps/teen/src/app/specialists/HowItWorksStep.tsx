interface HowItWorksStepProps {
  n: string;
  title: string;
  text: string;
}

export function HowItWorksStep({ n, title, text }: HowItWorksStepProps) {
  return (
    <div className="rounded-2xl border border-divider bg-bgSoft p-5">
      <p className="font-mono text-xs uppercase tracking-wider text-inkSoft">{n}</p>
      <h3 className="mt-2 font-sans text-base text-ink">{title}</h3>
      <p className="mt-1 font-sans text-sm leading-relaxed text-inkSoft">{text}</p>
    </div>
  );
}

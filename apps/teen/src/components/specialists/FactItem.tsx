interface FactItemProps {
  label: string;
  value: string;
}

export function FactItem({ label, value }: FactItemProps) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-inkSoft">{label}</p>
      <p className="mt-0.5 font-sans text-sm text-ink">{value}</p>
    </div>
  );
}

import { cn } from '@ya-ye/ui';

export interface ContactMethodProps {
  primary?: boolean;
  title: string;
  badge?: string;
  handle: string;
  href: string;
  ctaText: string;
  disclaimer: string;
  icon: React.ReactNode;
  external?: boolean;
}

export function ContactMethod({
  primary = false,
  title,
  badge,
  handle,
  href,
  ctaText,
  disclaimer,
  icon,
  external = false,
}: ContactMethodProps) {
  const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-2xl p-5',
        primary ? 'border-2 border-accent bg-accent/5' : 'border border-divider bg-bgSoft',
      )}
    >
      <header className="flex items-center justify-between">
        <h3 className="font-sans text-base font-medium text-ink">{title}</h3>
        {badge && (
          <span className="rounded-lg bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
            {badge}
          </span>
        )}
      </header>

      <p className="font-mono text-sm text-ink break-all">{handle}</p>

      {disclaimer && (
        <p className="font-sans text-xs italic leading-relaxed text-inkSoft">{disclaimer}</p>
      )}

      <a
        href={href}
        {...externalProps}
        className={cn(
          'mt-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-sans text-sm transition-opacity active:opacity-80',
          primary ? 'bg-accent text-white' : 'border border-accent/40 bg-bg text-accent',
        )}
      >
        {icon}
        {ctaText}
      </a>
    </article>
  );
}

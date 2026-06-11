import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

type Props = {
  title: string;
};

export function InnerPageHeader({ title }: Props) {
  return (
    <header className="border-b border-divider px-6 py-5">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <Link
          href="/"
          className="rounded-xl p-1.5 text-inkSoft transition-colors hover:bg-bgSoft"
          aria-label="На головну"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </Link>
        <h1 className="font-serif text-2xl italic text-ink">{title}</h1>
      </div>
    </header>
  );
}

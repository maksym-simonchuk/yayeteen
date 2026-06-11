// /offer — placeholder публічної оферти. Юридичний текст у розробці.
// Спеціфікація: Demo Day Sprint v2.1, Фаза E.

import Link from 'next/link';
import { InnerPageHeader } from '../../components/InnerPageHeader';

export default function OfferPage() {
  return (
    <main className="min-h-[100dvh] bg-bg text-ink">
      <InnerPageHeader title="Публічна оферта" />

      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <div className="space-y-5 rounded-3xl border-l-4 border-accent bg-bgSoft px-6 py-8 md:px-8">
          <p className="font-mono text-sm uppercase tracking-wider text-accent">
            Документ в розробці
          </p>

          <p className="font-sans text-base leading-relaxed text-ink">
            Зараз ми працюємо з юристом над юридичним документом публічної оферти за українським
            законодавством. Він буде доступний до публічного запуску продукту.
          </p>

          <p className="font-sans text-base leading-relaxed text-ink">
            До оприлюднення оферти доступ до продукту лишається безкоштовним. Жодних платних функцій
            без юридичної рамки.
          </p>

          <p className="font-sans text-sm leading-relaxed text-inkSoft">
            Питання — пиши на{' '}
            <a
              href="mailto:hello@ya-ye.app"
              className="text-accent underline-offset-2 hover:underline"
            >
              hello@ya-ye.app
            </a>
          </p>
        </div>

        <Link
          href="/"
          className="mt-8 inline-block font-sans text-sm text-inkSoft underline-offset-2 hover:underline"
        >
          ← На головну
        </Link>
      </div>
    </main>
  );
}

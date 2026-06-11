import type { AgeBand } from '@ya-ye/contracts';

export const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: '13-15', label: '13–15' },
  { value: '16-17', label: '16–17' },
  { value: '18-25', label: '18–25' },
];

/** Presentation-маппінг каналів контакту спеціаліста → підпис/тайтл іконки. */
export const CONTACT_ICON_LABEL: Record<string, { label: string; title: string }> = {
  telegram: { label: 'TG', title: 'Доступно через Telegram' },
  email: { label: 'EMAIL', title: 'Доступно через email' },
  form: { label: 'FORM', title: 'Доступна форма запису' },
};

/**
 * Дефолтна юрисдикція для кризових ліній (MVP — UA).
 * Geo-routing: у Phase 3 jurisdiction береться з user profile.
 */
export const DEFAULT_JURISDICTION = 'UA';

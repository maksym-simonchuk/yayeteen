import type { Hotline } from '@ya-ye/method';

/**
 * URL для рядка кризової лінії за каналом.
 * phone → tel:, chat → sms: (текстовий шорткод; chat-лінію не можна дзвонити).
 */
export function hotlineHref(hotline: Hotline): string {
  const digits = hotline.number.replace(/\s/g, '');
  return hotline.channel === 'chat' ? `sms:${digits}` : `tel:${digits}`;
}

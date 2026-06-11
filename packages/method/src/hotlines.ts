import type { Hotline } from './types';

export const HOTLINES: Record<string, readonly Hotline[]> = {
  UA: [
    {
      name: 'Дитяча лінія довіри',
      number: '116 111',
      note: 'безкоштовно · цілодобово',
      channel: 'phone',
    },
    { name: 'Teenergizer', number: '7333', note: 'чат · для підлітків', channel: 'chat' },
  ],
  US: [
    { name: '988 Suicide & Crisis Lifeline', number: '988', note: 'call · text', channel: 'phone' },
  ],
  UK: [{ name: 'Samaritans', number: '116 123', note: '24/7', channel: 'phone' }],
  EU: [{ name: 'Samaritans', number: '116 123', note: '24/7', channel: 'phone' }],
} as const;

export function getHotlines(jurisdiction: string): readonly Hotline[] {
  return HOTLINES[jurisdiction] ?? HOTLINES['UA']!;
}

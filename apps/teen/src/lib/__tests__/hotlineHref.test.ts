import { describe, it, expect } from 'vitest';
import { hotlineHref } from '../hotlineHref';
import type { Hotline } from '@ya-ye/method';

const phone: Hotline = { name: 'Лінія', number: '116 111', note: '24/7', channel: 'phone' };
const chat: Hotline = { name: 'Teenergizer', number: '7333', note: 'чат', channel: 'chat' };

describe('hotlineHref', () => {
  it('phone channel → tel: with whitespace stripped', () => {
    expect(hotlineHref(phone)).toBe('tel:116111');
  });

  it('chat channel → sms: (NOT tel:) with whitespace stripped', () => {
    expect(hotlineHref(chat)).toBe('sms:7333');
  });
});

import { describe, it, expect } from 'vitest';
import { greetingFor } from '../greeting';

describe('greetingFor', () => {
  it('includes the name when present', () => {
    expect(greetingFor('Оля')).toBe('розкажи, як ти зараз, Оля?');
  });

  it('falls back to anonymous greeting when null', () => {
    expect(greetingFor(null)).toBe('розкажи, як ти зараз?');
  });
});

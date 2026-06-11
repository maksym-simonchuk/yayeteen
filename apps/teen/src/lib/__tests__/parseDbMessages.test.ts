import { describe, it, expect } from 'vitest';
import { parseDbMessages } from '../parseDbMessages';

describe('parseDbMessages', () => {
  it('returns validated messages from a well-formed payload', () => {
    const out = parseDbMessages({
      messages: [{ role: 'user', content: 'привіт', created_at: '2026-06-11T00:00:00Z' }],
      persisted: true,
    });
    expect(out).toEqual([{ role: 'user', content: 'привіт' }]);
  });

  it('returns [] for a malformed payload (no throw)', () => {
    expect(parseDbMessages({ messages: 'nope' })).toEqual([]);
    expect(parseDbMessages(null)).toEqual([]);
    expect(parseDbMessages(undefined)).toEqual([]);
  });

  it('returns [] for empty messages', () => {
    expect(parseDbMessages({ messages: [], persisted: false })).toEqual([]);
  });
});

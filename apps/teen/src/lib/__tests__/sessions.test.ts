import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSession } from '../sessions';

afterEach(() => vi.restoreAllMocks());

describe('createSession', () => {
  it('POSTs the payload and returns the validated sessionId', async () => {
    const uuid = '11111111-1111-1111-1111-111111111111';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ sessionId: uuid, persisted: true }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const out = await createSession({ age_band: '16-17', user_name: 'Оля' });
    expect(out).toEqual({ sessionId: uuid, persisted: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on a malformed response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 201 })));
    await expect(createSession({ age_band: '16-17' })).rejects.toThrow();
  });
});

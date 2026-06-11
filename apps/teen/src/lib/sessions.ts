import {
  SessionsCreateResponseSchema,
  type SessionsCreateRequest,
  type SessionsCreateResponse,
} from '@ya-ye/contracts';

/**
 * POST /api/sessions — створення сесії. Валідує відповідь контрактом.
 * Кидає Error при не-OK статусі або невалідному тілі (UI вирішує fallback).
 */
export async function createSession(
  payload: SessionsCreateRequest,
): Promise<SessionsCreateResponse> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = SessionsCreateResponseSchema.parse(await res.json());
  return data;
}

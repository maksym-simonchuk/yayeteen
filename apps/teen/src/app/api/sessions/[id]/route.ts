// DELETE /api/sessions/[id] — GDPR right-to-erasure (S5, quality-gate §S5).
// 401/403 → rate limit → deleteSession command → 204.
//
// Каскад: БД видаляє messages + crisis_events разом з session-row.
// User-row НЕ видаляємо — на ньому можуть висіти інші сесії.
// Повне видалення user — окремий GDPR-endpoint, борг Phase 4.

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { hasSessionCookie, verifySessionCookie } from '@/lib/session-token';
import { clientIp } from '@/lib/rate-limit';
import { deleteSession } from '@/server/commands/deleteSession';
import { MemoryLimiterAdapter } from '@/server/adapters/memoryLimiter';
import { jsonError } from '@/lib/api-response';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return jsonError('missing session id', 400);
  }

  // S5 401/403 семантика: немає cookie → 401; cookie є але не ця сесія → 403.
  if (!hasSessionCookie(req)) {
    return jsonError('unauthorized', 401);
  }
  if (!verifySessionCookie(req, sessionId)) {
    return jsonError('forbidden', 403);
  }

  const supabase = isSupabaseConfigured() ? createClient() : null;
  const limiter = new MemoryLimiterAdapter();
  const ip = clientIp(req);

  const result = await deleteSession({ sessionId, ip }, { supabase, limiter });

  if (result.kind === 'error') {
    return jsonError(result.error, result.status);
  }

  // 204 No Content — стандарт для успішного DELETE.
  return new Response(null, { status: 204 });
}

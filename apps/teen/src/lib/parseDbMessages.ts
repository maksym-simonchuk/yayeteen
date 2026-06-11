import { MessagesResponseSchema } from '@ya-ye/contracts';

/** Роль+контент повідомлення для гідратації UI з БД. */
export interface DbMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Валідує сиру відповідь GET /api/sessions/[id]/messages через MessagesResponseSchema.
 * Невалідне тіло → [] (мовчазний fallback, UI працює без БД).
 */
export function parseDbMessages(raw: unknown): DbMessage[] {
  const parsed = MessagesResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
}

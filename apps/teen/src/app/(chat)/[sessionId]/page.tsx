'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { Send } from 'lucide-react';
import { CrisisModal } from '@/components/crisis/CrisisModal';
import { Grounding54321 } from '@/components/crisis/Grounding54321';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ExerciseCard } from '@/components/chat/ExerciseCard';
import { SessionTimer } from '@/components/chat/SessionTimer';
import { SpecialistRedirectInline } from '@/components/chat/SpecialistRedirectInline';
import { cn } from '@ya-ye/ui';
import { CrisisEventSchema, type ChatRequest } from '@ya-ye/contracts';
import { DEFAULT_MODE_LABEL } from '@/lib/parseModeLabel';
import { applyStreamChunk } from '@/lib/applyStreamChunk';
import { EXERCISE_PREFIXES } from '@/lib/exercisePrefixes';
import { getHotlines } from '@ya-ye/method';
import type { ChatMessage } from '@/model/types';
import { parseDbMessages } from '@/lib/parseDbMessages';
import { greetingFor } from '@/lib/greeting';
import { parseSseStream } from '@/lib/chatStream';

// ---------------------------------------------------------------------------
// Main chat screen
// ---------------------------------------------------------------------------

const ERROR_BUBBLE = 'щось пішло не так. спробуй ще раз.';

export default function ChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  // postCrisisMode — true після того як спрацювала криза і юзер продовжив розмову
  const [postCrisisMode, setPostCrisisMode] = useState(false);
  const [showGroundingInChat, setShowGroundingInChat] = useState(false);
  // Hydrated від БД? Поки не закінчилось — не показуємо greeting, щоб уникнути
  // flicker'а (greeting → DB-історія). Якщо Supabase плейсхолдер — endpoint
  // одразу повертає [] і ми переходимо у звичайний first-turn flow.
  const [hydrated, setHydrated] = useState(false);
  // mode-лейбл — оновлюється з першого рядка кожної assistant-відповіді
  const [modeLabel, setModeLabel] = useState(DEFAULT_MODE_LABEL);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentStreamId = useRef<string | null>(null);
  // Встановлюється при першому відправленому повідомленні — рахуємо активний час розмови,
  // а не час відкритої сторінки. null = розмова ще не почалась.
  const sessionStartedAtRef = useRef<number | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hydrate розмови з БД (in-session resilience при page reload). Виконується
  // один раз. У fallback-режимі endpoint віддає [] і ми просто продовжуємо.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${sessionId}/messages`)
      .then((r) => r.json())
      .then((raw) => {
        if (cancelled) return;
        const dbMessages = parseDbMessages(raw);
        if (dbMessages.length > 0) {
          // Гонка з першим send: fetch стартує при mount, але може зарезолвитись
          // вже ПІСЛЯ того як юзер відправив повідомлення — тоді перезапис стейту
          // зʼїдає локальні баблі (включно зі стрім-плейсхолдером). Гідратуємо
          // тільки поки локально немає власних повідомлень (greeting не рахується).
          setMessages((prev) =>
            prev.some((m) => m.id !== 'greeting')
              ? prev
              : dbMessages.map((m, i) => ({
                  id: `db-${i}`,
                  role: m.role,
                  bubbles: m.content.split('\n\n').filter((b) => b.trim().length > 0),
                })),
          );
        }
      })
      .catch(() => {
        /* мовчазний fallback — UI працює без БД */
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Читаємо ім'я з sessionStorage один раз після mount
  useEffect(() => {
    const stored = sessionStorage.getItem('user_name');
    if (stored) setUserName(stored);
  }, []);

  // First turn greeting — показуємо тільки ПІСЛЯ гідратації, інакше
  // greeting блимне до того як ми завантажимо історію з БД.
  // EU AI Act Art. 50 disclosure вже є на splash-екрані та у header чату постійно.
  useEffect(() => {
    if (hydrated && messages.length === 0) {
      setMessages([
        {
          id: 'greeting',
          role: 'assistant',
          bubbles: [greetingFor(userName)],
        },
      ]);
    }
  }, [hydrated, messages.length, userName]);

  const handleExpire = useCallback(() => {
    setExpired(true);
    setMessages((prev) => [
      ...prev,
      {
        id: 'expired',
        role: 'assistant',
        bubbles: [
          'час. сесія закривається — це за дизайном.',
          'зроби собі паузу. вийди на повітря на 5 хвилин.',
          'я тут, якщо повернешся.',
        ],
      },
    ]);
  }, []);

  const appendToStream = useCallback(
    (id: string, text: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const next = applyStreamChunk(m.bubbles, m.hasModeRedirect ?? false, text);
          if (next.modeLabel !== DEFAULT_MODE_LABEL) {
            setModeLabel(next.modeLabel);
          }
          return {
            ...m,
            bubbles: next.bubbles,
            isStreaming: true,
            hasModeRedirect: next.hasModeRedirect,
          };
        }),
      );
    },
    [setModeLabel],
  );

  const finalizeStream = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isStreaming: false } : m)));
    currentStreamId.current = null;
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading || expired) return;

    setInput('');
    setIsLoading(true);

    // Фіксуємо час першого відправленого повідомлення — звідси рахується 25 хв
    if (!sessionStartedAtRef.current) {
      sessionStartedAtRef.current = Date.now();
    }

    // Build conversation history from current state for the model.
    // Exclude the client-only opening greeting and any empty/streaming bubbles —
    // this keeps the dialogue continuous without depending on DB persistence.
    const history = messages
      .filter((m) => m.id !== 'greeting')
      .map((m) => ({ role: m.role, content: m.bubbles.join('\n\n').trim() }))
      .filter((m) => m.content.length > 0);
    // §2.4: turnNumber — серверне поле, не передається у тілі запиту.
    // Сервер рахує user-turns сам по history.

    // Add user message
    const userId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userId, role: 'user', bubbles: [text] }]);

    // Placeholder for streaming assistant message
    const assistantId = `a-${Date.now()}`;
    currentStreamId.current = assistantId;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', bubbles: [''], isStreaming: true },
    ]);

    try {
      // Тіло запиту будується з inferred-типу ChatRequest (quality-gate §2.4).
      // Поля turnNumber / sessionStartedAt / postCrisisMode — серверні, не передаємо.
      const chatBody: ChatRequest = {
        sessionId,
        userMessage: text,
        history,
        // Demo-fallback для P0-3: коли Supabase не сконфігуровано, сервер
        // не має age_band з БД — передаємо вибір з онбордингу (сервер валідує enum)
        ageBand: (sessionStorage.getItem('age_band') as ChatRequest['ageBand']) ?? null,
        userName: sessionStorage.getItem('user_name') ?? null,
      };
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody),
      });

      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const crisis = CrisisEventSchema.safeParse(await response.json());
        if (crisis.success) {
          const message = crisis.data.message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, bubbles: message.split('\n\n').filter(Boolean), isStreaming: false }
                : m,
            ),
          );
          setCrisisOpen(true);
          setPostCrisisMode(true);
          setIsLoading(false);
          return;
        }
        // 401/403 — cookie сесії відсутня/прострочена або чужа (P0-5).
        // 404 — сесії немає в БД (старий URL після очищення/зміни бази).
        // Відновити їх клієнт не може — повертаємо на онбординг за новою сесією.
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          router.push('/');
          return;
        }
        // Non-crisis JSON (error response) — show fallback and stop
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, bubbles: [ERROR_BUBBLE], isStreaming: false } : m,
          ),
        );
        setIsLoading(false);
        return;
      }

      // SSE streaming — транспорт винесено у lib/chatStream.ts
      const reader = response.body!.getReader();
      for await (const data of parseSseStream(reader)) {
        if (data.type === 'token') {
          appendToStream(assistantId, data.text);
        } else if (data.type === 'done') {
          finalizeStream(assistantId);
        } else if (data.type === 'error') {
          // detail приходить лише в dev (S5) — без нього помилка німа в DevTools
          console.error('[chat-sse-error]', data.detail ?? '(no detail — production)');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, bubbles: [ERROR_BUBBLE], isStreaming: false } : m,
            ),
          );
        }
      }
      // Stream ended — ensure the bubble is finalized even if 'done' event was missed
      finalizeStream(assistantId);
    } catch (err) {
      console.error('Chat error', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, bubbles: [ERROR_BUBBLE], isStreaming: false } : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Mode strip — лейбл оновлюється з першого рядка кожної assistant-відповіді */}
      <div className="flex items-center justify-between border-b border-divider px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-inkSoft">
          {modeLabel}
        </span>
        <SessionTimer sessionId={sessionId} onExpire={handleExpire} />
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        aria-live="polite"
        aria-label="Розмова"
      >
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            {msg.bubbles.map((bubble, i) => {
              const isExercise =
                msg.role === 'assistant' && EXERCISE_PREFIXES.some((p) => bubble.startsWith(p));
              return isExercise ? (
                <ExerciseCard key={`${msg.id}-${i}`} text={bubble} />
              ) : (
                <ChatBubble
                  key={`${msg.id}-${i}`}
                  role={msg.role}
                  content={bubble}
                  isStreaming={msg.isStreaming === true && i === msg.bubbles.length - 1}
                />
              );
            })}
            {/* [MODE:4] inline-блок — прибираємо під час і після кризи */}
            {msg.role === 'assistant' &&
              msg.hasModeRedirect &&
              !msg.isStreaming &&
              !crisisOpen &&
              !postCrisisMode && <SpecialistRedirectInline />}

            {/* Пост-кризова вправа */}
            {msg.postCrisisExercise && !showGroundingInChat && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowGroundingInChat(true)}
                  className="w-full rounded-2xl border border-divider bg-bgSoft px-4 py-3 text-left transition-colors hover:border-accent/30 active:opacity-80"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-accent">
                    заземлення · 5-4-3-2-1
                  </p>
                  <p className="mt-0.5 font-sans text-sm text-inkSoft">
                    5 чуттів — крок за кроком · ~2 хв
                  </p>
                </button>
                <button
                  onClick={() => {
                    /* просто продовжити — нічого не робимо */
                  }}
                  className="w-full rounded-2xl px-4 py-2 font-sans text-sm text-inkSoft/60 underline-offset-2 hover:underline"
                >
                  просто поговоримо
                </button>
              </div>
            )}
            {msg.postCrisisExercise && showGroundingInChat && (
              <div className="rounded-3xl border border-divider bg-bgSoft px-5 py-5">
                <Grounding54321
                  onDone={() => {
                    setShowGroundingInChat(false);
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `after-grounding-${Date.now()}`,
                        role: 'assistant',
                        bubbles: ['ти тут. як зараз?'],
                      },
                    ]);
                  }}
                />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-divider px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={isLoading || expired}
            placeholder={expired ? 'сесія завершена' : 'напиши тут...'}
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-2xl border border-divider bg-bgSoft px-4 py-3',
              'font-sans text-base text-ink placeholder:text-inkSoft/50',
              'focus:border-accent/50 focus:outline-none',
              'max-h-32 overflow-y-auto',
              (isLoading || expired) && 'opacity-50',
            )}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || expired}
            aria-label="надіслати"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white',
              'transition-opacity active:opacity-70',
              (!input.trim() || isLoading || expired) && 'opacity-40',
            )}
          >
            <Send size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* SOS shortcut below input */}
        <div className="mt-2 flex justify-end">
          <Link
            href={`/crisis?sessionId=${sessionId}` as `/crisis?sessionId=${string}`}
            className="font-mono text-[10px] uppercase tracking-wider text-crisis/70 hover:text-crisis"
          >
            SOS →
          </Link>
        </div>
      </div>

      {/* Crisis modal */}
      {crisisOpen && (
        <CrisisModal
          hotlines={getHotlines('UA')}
          onClose={() => {
            setCrisisOpen(false);
            // Після закриття модалу — додаємо повідомлення з пропозицією вправи
            setMessages((prev) => [
              ...prev,
              {
                id: `post-crisis-${Date.now()}`,
                role: 'assistant',
                bubbles: [
                  'ти повернувся. я тут.',
                  'є вправа заземлення — вона може допомогти зараз. хочеш спробуємо?',
                ],
                postCrisisExercise: true,
              },
            ]);
          }}
          onGrounding={() => {
            setCrisisOpen(false);
            setPostCrisisMode(true);
          }}
        />
      )}
    </>
  );
}

# Я Є · Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate confirmed business-logic/UI mixing, kill correctness hazards, and enforce the strict `lib`/`model`/`ui`/`api` split across the monorepo — без переписувань, тільки точкові правки.

**Architecture:** Codebase вже добре структурований (hexagonal server layer, contracts як єдине джерело типів, component-file rule подекуди застосовано). Це НЕ rewrite — це 42 підтверджені точкові правки з адверсаріального аудиту (60 агентів, 11 спекулятивних фіксів відхилено). Кожна задача — самодостатній commit. Бізнес-логіка виноситься у `lib/`, дані/константи у `model/`, чисті reducer-функції тестуються юніт-тестами.

**Tech Stack:** Next.js 15 App Router + RSC, TypeScript strict, Tailwind + shadcn/ui, Supabase, Anthropic API (claude-haiku-4-5), Vitest 3, turborepo + pnpm. Packages: `@ya-ye/{teen,landing,therapists,method,contracts,ui,db}`.

---

## Canonical commands (used throughout)

| Дія | Команда |
|---|---|
| Юніт-тест одного файлу (teen) | `pnpm --filter @ya-ye/teen test <relative/path>` |
| Юніт-тести пакета | `pnpm --filter @ya-ye/method test` · `pnpm --filter @ya-ye/contracts test` |
| Typecheck (увесь монорепо) | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Build | `pnpm build` |

Усі команди — з кореня репозиторію `/Users/admin/Desktop/yayeproduct-main`.

---

## Constraints (read before touching anything)

1. **`packages/method` ЗАМОРОЖЕНИЙ** (CLAUDE.md §6). Будь-яка зміна, що впливає на байти промта → review Methodology Lead → інкремент `ANTHROPIC_PROMPT_VERSION`. `prompt-snapshot.test.ts` має лишатись зеленим **байт-в-байт**. Тому HOTLINES-консолідація винесена у «Deferred — blocked» (нижче), а НЕ в executable-задачі.
2. **Component-file rule** (CLAUDE.md global): файл компонента містить ТІЛЬКИ компонент + його `Props`. Хелпери → `lib/`, типи → `model/types.ts`, константи → `model/constants.ts` / co-located `*.constants.ts`.
3. **YAGNI**: жодних нових абстракцій без 3 конкретних застосувань. Витягуємо лише там, де є реальне змішування або >1 споживач.
4. **Read before edit**: кожен виконавець перечитує файл перед правкою (line-числа в плані — станом на 2026-06-11, можуть зсунутись після попередніх задач у тій самій фазі).

---

## File Structure (what changes & why)

**Phase 0 — correctness (no behavior fabrication):**
- `apps/teen/src/lib/parseModeLabel.ts` — прибрати stateful `g`-regex, замінити на stateless хелпери.
- `apps/teen/src/lib/hotlineHref.ts` — **new**: канал → коректна URL-схема (chat ≠ `tel:`).
- `apps/teen/src/lib/parseDbMessages.ts` — **new**: валідація hydration-відповіді через `MessagesResponseSchema`.
- `apps/teen/src/lib/greeting.ts` — **new**: чиста `greetingFor(name)`.
- `apps/teen/src/lib/exerciseResult.ts` — **new**: zod-валідатор тіла `exercise-feedback`.
- `packages/contracts/src/index.ts` — crisis-подія виходить із SSE discriminated-union (вона JSON, не SSE).
- `apps/teen/src/app/(chat)/[sessionId]/page.tsx`, `components/chat/SessionTimer.tsx`, `components/crisis/HotlineRow.tsx`, `apps/landing/src/app/api/exercise-feedback/route.ts` — споживають вищезгадане.

**Phase 1 — business-logic/UI separation:**
- `apps/teen/src/lib/chatStream.ts` — **new**: SSE-парсинг + споживання стріму (винесено з `sendMessage()` у page.tsx).
- `apps/teen/src/lib/applyStreamChunk.ts` — **new**: чистий reducer відображення токена в баблі.
- `apps/teen/src/lib/sessions.ts` — **new**: `createSession()` fetch-обгортка (винесено з онбордингу).
- `apps/teen/src/server/commands/sendMessage.ts` — використати `stripBom()` замість inline-replace.
- `apps/teen/src/model/constants.ts` — прийняти `CONTACT_ICON_LABEL` (UI-маппінг з data-шару).

**Phase 2 — structure hygiene:** релокації констант/під-компонентів/типів, a11y, dead-code (деталі у задачах 2.1–2.16).

---

## PHASE 0 — Correctness & Safety

> Кожна задача фази 0 — окремий commit, можна мерджити незалежно. Робити ПЕРШОЮ — це баги, не косметика.

### Task 0.1: Kill stateful `g`-flag regex in mode-redirect parsing

**Files:**
- Modify: `apps/teen/src/lib/parseModeLabel.ts:36-38`
- Modify: `apps/teen/src/app/(chat)/[sessionId]/page.tsx:16-21` (imports), `:143-172` (`appendToStream`)
- Test: `apps/teen/src/lib/__tests__/parseModeLabel.test.ts`

**Why:** `export const MODE_REDIRECT_RE = /\s*\[MODE:4\]\s*/g;` — модуль-рівневий regex з `g`-флагом. `.test()` на ньому stateful через `lastIndex`; page.tsx двічі робить `MODE_REDIRECT_RE.lastIndex = 0` (рядки 153, 161) як ручний воркераунд. Hot path (стрім, виклик на кожен токен) → flaky-детект редиректу. Заміна на stateless-хелпери прибирає клас багів.

- [ ] **Step 1: Write the failing test**

Додати в кінець `apps/teen/src/lib/__tests__/parseModeLabel.test.ts`:

```ts
import { hasModeRedirect, stripModeRedirect } from '../parseModeLabel';

describe('hasModeRedirect', () => {
  it('detects the [MODE:4] marker', () => {
    expect(hasModeRedirect('текст [MODE:4] далі')).toBe(true);
    expect(hasModeRedirect('без маркера')).toBe(false);
  });

  it('is stateless — repeated calls return the same result (no lastIndex drift)', () => {
    const s = 'хочеш до фахівця? [MODE:4]';
    expect(hasModeRedirect(s)).toBe(true);
    expect(hasModeRedirect(s)).toBe(true);
    expect(hasModeRedirect(s)).toBe(true);
  });
});

describe('stripModeRedirect', () => {
  it('removes the marker and surrounding whitespace', () => {
    expect(stripModeRedirect('так  [MODE:4]  ось')).toBe('такось');
  });

  it('removes ALL markers if model emits more than one', () => {
    expect(stripModeRedirect('a [MODE:4] b [MODE:4] c')).toBe('abc');
  });

  it('is stateless across repeated calls', () => {
    const s = 'x [MODE:4] y';
    expect(stripModeRedirect(s)).toBe('xy');
    expect(stripModeRedirect(s)).toBe('xy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/parseModeLabel.test.ts`
Expected: FAIL — `hasModeRedirect`/`stripModeRedirect` is not a function (exports не існують).

- [ ] **Step 3: Replace the stateful export with stateless helpers**

В `apps/teen/src/lib/parseModeLabel.ts` замінити рядки 36-38:

```ts
// Регекс для парсингу маркера. Підтримує опційний whitespace навколо
// і повторні маркери (хоч промт забороняє — все одно стрипаємо всі).
export const MODE_REDIRECT_RE = /\s*\[MODE:4\]\s*/g;
```

на:

```ts
/**
 * Чи містить текст маркер [MODE:4]. Stateless — свіжий літерал на кожен виклик,
 * без shared `lastIndex` (на відміну від попереднього `g`-regex export).
 */
export function hasModeRedirect(text: string): boolean {
  return /\[MODE:4\]/.test(text);
}

/**
 * Видаляє ВСІ маркери [MODE:4] разом з навколишнім whitespace.
 * `g`-літерал створюється локально → `String.replace` сам скидає lastIndex,
 * shared-state hazard відсутній.
 */
export function stripModeRedirect(text: string): string {
  return text.replace(/\s*\[MODE:4\]\s*/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/parseModeLabel.test.ts`
Expected: PASS (усі, включно з попередніми тестами файлу).

- [ ] **Step 5: Update the consumer (page.tsx)**

У `apps/teen/src/app/(chat)/[sessionId]/page.tsx` замінити import-блок (рядки 16-21):

```ts
import {
  parseModeLabel,
  stripModeLabel,
  DEFAULT_MODE_LABEL,
  MODE_REDIRECT_RE,
} from '@/lib/parseModeLabel';
```

на:

```ts
import {
  parseModeLabel,
  stripModeLabel,
  DEFAULT_MODE_LABEL,
  hasModeRedirect,
  stripModeRedirect,
} from '@/lib/parseModeLabel';
```

Потім замінити тіло `appendToStream` (рядки 145-169, всередині `setMessages(... .map(...))`):

```ts
        prev.map((m) => {
          if (m.id !== id) return m;
          // Join existing + new text, then check for [MODE:4] marker.
          // Strip marker from display, but remember it for rendering the inline.
          const rawWithMarker = m.bubbles.join('\n\n') + text;
          const hasModeRedirect = MODE_REDIRECT_RE.test(rawWithMarker);
          // Reset regex state (g-flag is stateful) before next test elsewhere
          MODE_REDIRECT_RE.lastIndex = 0;
          // Витягуємо mode-лейбл з першого рядка відповіді і оновлюємо стрічку.
          // stripModeLabel прибирає тег з тексту перед розбивкою на баббли.
          const label = parseModeLabel(rawWithMarker);
          if (label !== DEFAULT_MODE_LABEL) {
            setModeLabel(label);
          }
          const raw = stripModeLabel(rawWithMarker).replace(MODE_REDIRECT_RE, '');
          MODE_REDIRECT_RE.lastIndex = 0;
          return {
            ...m,
            bubbles: raw.split('\n\n').filter(Boolean),
            isStreaming: true,
            hasModeRedirect: m.hasModeRedirect || hasModeRedirect,
          };
        }),
```

на:

```ts
        prev.map((m) => {
          if (m.id !== id) return m;
          // Join existing + new text, then check for [MODE:4] marker.
          // Strip marker from display, but remember it for rendering the inline.
          const rawWithMarker = m.bubbles.join('\n\n') + text;
          const redirect = hasModeRedirect(rawWithMarker);
          // Витягуємо mode-лейбл з першого рядка відповіді і оновлюємо стрічку.
          // stripModeLabel прибирає тег з тексту перед розбивкою на баббли.
          const label = parseModeLabel(rawWithMarker);
          if (label !== DEFAULT_MODE_LABEL) {
            setModeLabel(label);
          }
          const raw = stripModeRedirect(stripModeLabel(rawWithMarker));
          return {
            ...m,
            bubbles: raw.split('\n\n').filter(Boolean),
            isStreaming: true,
            hasModeRedirect: m.hasModeRedirect || redirect,
          };
        }),
```

- [ ] **Step 6: Verify typecheck + lint pass**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS, no reference to `MODE_REDIRECT_RE` remains (`grep -rn MODE_REDIRECT_RE apps packages` → лише історія git).

- [ ] **Step 7: Commit**

```bash
git add apps/teen/src/lib/parseModeLabel.ts apps/teen/src/lib/__tests__/parseModeLabel.test.ts "apps/teen/src/app/(chat)/[sessionId]/page.tsx"
git commit -m "fix(chat): remove stateful g-flag from MODE_REDIRECT_RE (hot-path flaky detect)"
```

---

### Task 0.2: HotlineRow mis-dials chat channel as `tel:`

**Files:**
- Create: `apps/teen/src/lib/hotlineHref.ts`
- Test: `apps/teen/src/lib/__tests__/hotlineHref.test.ts`
- Modify: `apps/teen/src/components/crisis/HotlineRow.tsx:13-14`

**Why:** Teenergizer — `{ number: '7333', channel: 'chat' }`. HotlineRow рендерить `href={`tel:${number}`}` для ВСІХ каналів → у кризовому модалі клік по чат-лінії намагається подзвонити на нечислову. Виносимо вибір схеми у чисту тестовану функцію (component-file rule: жодних хелперів у компоненті).

> **Methodology note (non-blocking):** Для `channel: 'chat'` план використовує `sms:` (текстовий шорткод — стандарт для «напиши на лінію»). Перед launch підтвердити у Methodology Lead, чи 7333 — це SMS-шорткод чи Telegram-чат (тоді знадобиться `url` поле у `Hotline`). Поточний фікс прибирає баг (дзвінок на чат) без вигадування телефонної семантики.

- [ ] **Step 1: Write the failing test**

Create `apps/teen/src/lib/__tests__/hotlineHref.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/hotlineHref.test.ts`
Expected: FAIL — cannot find module `../hotlineHref`.

- [ ] **Step 3: Create the helper**

Create `apps/teen/src/lib/hotlineHref.ts`:

```ts
import type { Hotline } from '@ya-ye/method';

/**
 * URL для рядка кризової лінії за каналом.
 * phone → tel:, chat → sms: (текстовий шорткод; chat-лінію не можна дзвонити).
 */
export function hotlineHref(hotline: Hotline): string {
  const digits = hotline.number.replace(/\s/g, '');
  return hotline.channel === 'chat' ? `sms:${digits}` : `tel:${digits}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/hotlineHref.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the helper in HotlineRow**

У `apps/teen/src/components/crisis/HotlineRow.tsx` додати import під рядок 3 та замінити `href`:

Imports (after line 3 `import { cn } from '@ya-ye/ui';`):

```ts
import { hotlineHref } from '@/lib/hotlineHref';
```

Замінити рядок 14:

```ts
      href={`tel:${hotline.number.replace(/\s/g, '')}`}
```

на:

```ts
      href={hotlineHref(hotline)}
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/teen/src/lib/hotlineHref.ts apps/teen/src/lib/__tests__/hotlineHref.test.ts apps/teen/src/components/crisis/HotlineRow.tsx
git commit -m "fix(crisis): chat hotline channel no longer dials tel: (sms: shortcode)"
```

---

### Task 0.3: Crisis event wrongly placed in SSE discriminated union

**Files:**
- Modify: `packages/contracts/src/index.ts:87-120` (comment + union), `:161-172`
- Test: `packages/contracts/src/__tests__/sse-event.test.ts`
- Modify (consumer): `apps/teen/src/app/(chat)/[sessionId]/page.tsx:15` (import), `:233-247`

**Why:** Crisis повертається як `application/json` (`{ type: 'crisis', message }`), НЕ як SSE-токен. Проте `SseCrisisEventSchema` включена у `SseEventSchema = z.discriminatedUnion('type', [...])`, який валідує SSE-стрім (page.tsx:283). Тип-брехня: SSE-парсер ніколи не отримає crisis, а JSON-гілка (page.tsx:234) натомість використовує голий cast `as { type: string; message?: string }`. Виносимо crisis зі SSE-union у власну `CrisisEventSchema` і валідуємо нею JSON-гілку. `SseCrisisEvent*` не імпортується ззовні (grep підтвердив) → безпечно перейменувати.

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/__tests__/sse-event.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SseEventSchema, CrisisEventSchema } from '../index';

describe('SseEventSchema', () => {
  it('accepts token/done/error', () => {
    expect(SseEventSchema.safeParse({ type: 'token', text: 'hi' }).success).toBe(true);
    expect(SseEventSchema.safeParse({ type: 'done' }).success).toBe(true);
    expect(SseEventSchema.safeParse({ type: 'error', detail: 'x' }).success).toBe(true);
  });

  it('REJECTS crisis — it is JSON, not an SSE event', () => {
    expect(SseEventSchema.safeParse({ type: 'crisis', message: 'я чую тебе' }).success).toBe(false);
  });
});

describe('CrisisEventSchema', () => {
  it('accepts the JSON crisis payload', () => {
    expect(CrisisEventSchema.safeParse({ type: 'crisis', message: 'я чую тебе' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/contracts test src/__tests__/sse-event.test.ts`
Expected: FAIL — `CrisisEventSchema` is not exported; crisis still accepted by `SseEventSchema`.

- [ ] **Step 3: Rename schema & remove from SSE union**

У `packages/contracts/src/index.ts`:

(a) Замінити блок рядків 116-120:

```ts
const SseCrisisEventSchema = z.object({
  type: z.literal('crisis'),
  // message — текст, що відображається у UI до відкриття CrisisModal
  message: z.string(),
});
```

на:

```ts
// Crisis повертається як application/json (НЕ SSE). Окрема схема — не в SSE-union.
export const CrisisEventSchema = z.object({
  type: z.literal('crisis'),
  // message — текст, що відображається у UI до відкриття CrisisModal
  message: z.string(),
});
```

(b) Замінити коментар-блок рядків 95-98:

```ts
// Кризовий { type: 'crisis', message: string } повертається як JSON
// (Content-Type: application/json), а не як SSE — тому він теж включений
// в union для повноти клієнтського парсингу JSON-відповіді.
// ---------------------------------------------------------------------------
```

на:

```ts
// Кризовий { type: 'crisis', message: string } повертається як JSON
// (Content-Type: application/json), а не як SSE — тому валідується окремою
// CrisisEventSchema (див. нижче), а НЕ цим union.
// ---------------------------------------------------------------------------
```

(c) Замінити union (рядки 161-166):

```ts
export const SseEventSchema = z.discriminatedUnion('type', [
  SseTokenEventSchema,
  SseDoneEventSchema,
  SseErrorEventSchema,
  SseCrisisEventSchema,
]);
```

на:

```ts
export const SseEventSchema = z.discriminatedUnion('type', [
  SseTokenEventSchema,
  SseDoneEventSchema,
  SseErrorEventSchema,
]);
```

(d) Замінити рядок 172:

```ts
export type SseCrisisEvent = z.infer<typeof SseCrisisEventSchema>;
```

на:

```ts
export type CrisisEvent = z.infer<typeof CrisisEventSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/contracts test src/__tests__/sse-event.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the schema in the page consumer**

У `apps/teen/src/app/(chat)/[sessionId]/page.tsx`:

Замінити import (рядок 15):

```ts
import { SseEventSchema, type ChatRequest } from '@ya-ye/contracts';
```

на:

```ts
import { SseEventSchema, CrisisEventSchema, type ChatRequest } from '@ya-ye/contracts';
```

Замінити JSON-гілку (рядки 233-247):

```ts
      if (contentType?.includes('application/json')) {
        const data = (await response.json()) as { type: string; message?: string };
        if (data.type === 'crisis' && data.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, bubbles: data.message!.split('\n\n').filter(Boolean), isStreaming: false }
                : m,
            ),
          );
          setCrisisOpen(true);
          setPostCrisisMode(true);
          setIsLoading(false);
          return;
        }
```

на:

```ts
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
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. `grep -rn "SseCrisisEvent" apps packages` → no matches.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/index.ts packages/contracts/src/__tests__/sse-event.test.ts "apps/teen/src/app/(chat)/[sessionId]/page.tsx"
git commit -m "fix(contracts): crisis is JSON not SSE — split CrisisEventSchema out of SSE union"
```

---

### Task 0.4: DB hydration bypasses MessagesResponseSchema

**Files:**
- Create: `apps/teen/src/lib/parseDbMessages.ts`
- Test: `apps/teen/src/lib/__tests__/parseDbMessages.test.ts`
- Modify: `apps/teen/src/app/(chat)/[sessionId]/page.tsx:65-98`

**Why:** Hydration-fetch (рядки 67-90) робить `r.json() as Promise<{ messages?: ... }>` — голий cast, що обходить `MessagesResponseSchema` (вже визначений у contracts). Невалідна відповідь → runtime-краш у `.map`. Виносимо валідацію у чисту тестовану функцію.

- [ ] **Step 1: Write the failing test**

Create `apps/teen/src/lib/__tests__/parseDbMessages.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/parseDbMessages.test.ts`
Expected: FAIL — cannot find module `../parseDbMessages`.

- [ ] **Step 3: Create the helper**

Create `apps/teen/src/lib/parseDbMessages.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/parseDbMessages.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in page.tsx hydration effect**

У `apps/teen/src/app/(chat)/[sessionId]/page.tsx` додати import (після рядка 24 `import type { ChatMessage } from '@/model/types';`):

```ts
import { parseDbMessages } from '@/lib/parseDbMessages';
```

Замінити hydration-effect (рядки 65-98) тілом:

```ts
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
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/teen/src/lib/parseDbMessages.ts apps/teen/src/lib/__tests__/parseDbMessages.test.ts "apps/teen/src/app/(chat)/[sessionId]/page.tsx"
git commit -m "fix(chat): validate DB hydration via MessagesResponseSchema (no raw cast)"
```

---

### Task 0.5: Greeting reads sessionStorage twice (ignores userName state)

**Files:**
- Create: `apps/teen/src/lib/greeting.ts`
- Test: `apps/teen/src/lib/__tests__/greeting.test.ts`
- Modify: `apps/teen/src/app/(chat)/[sessionId]/page.tsx:104-125`

**Why:** Є `userName` state (рядок 41), що заповнюється з sessionStorage у окремому ефекті (рядки 105-108). Але greeting-ефект (рядок 115) читає `sessionStorage.getItem('user_name')` НАПРЯМУ, ігноруючи state — дублювання джерела істини, два читання storage. Деривуємо greeting з state через чисту функцію.

- [ ] **Step 1: Write the failing test**

Create `apps/teen/src/lib/__tests__/greeting.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/greeting.test.ts`
Expected: FAIL — cannot find module `../greeting`.

- [ ] **Step 3: Create the helper**

Create `apps/teen/src/lib/greeting.ts`:

```ts
/** Перше привітання чату. Деривується з імені онбордингу (null → анонімне). */
export function greetingFor(name: string | null): string {
  return name ? `розкажи, як ти зараз, ${name}?` : 'розкажи, як ти зараз?';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/greeting.test.ts`
Expected: PASS.

- [ ] **Step 5: Use state + helper in page.tsx**

У `apps/teen/src/app/(chat)/[sessionId]/page.tsx` додати import (поряд з іншими `@/lib` import-ами, напр. після рядка 22):

```ts
import { greetingFor } from '@/lib/greeting';
```

Замінити greeting-ефект (рядки 113-125):

```ts
  useEffect(() => {
    if (hydrated && messages.length === 0) {
      const name = sessionStorage.getItem('user_name');
      const greeting = name ? `розкажи, як ти зараз, ${name}?` : 'розкажи, як ти зараз?';
      setMessages([
        {
          id: 'greeting',
          role: 'assistant',
          bubbles: [greeting],
        },
      ]);
    }
  }, [hydrated, messages.length]);
```

на:

```ts
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
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/teen/src/lib/greeting.ts apps/teen/src/lib/__tests__/greeting.test.ts "apps/teen/src/app/(chat)/[sessionId]/page.tsx"
git commit -m "fix(chat): derive greeting from userName state (single source of truth)"
```

---

### Task 0.6: `exercise-feedback` route — unsafe cast + inline Supabase client

**Files:**
- Create: `apps/landing/src/lib/exerciseResult.ts`
- Test: `apps/landing/src/lib/__tests__/exerciseResult.test.ts`
- Modify: `apps/landing/src/app/api/exercise-feedback/route.ts`

**Why:** Route робить `result = body.result as string` на НЕДОВІРЕНОМУ вводі (рядок 7) перед перевіркою, і створює Supabase-клієнт inline через `@supabase/supabase-js` замість спільного `@ya-ye/db`. Виносимо валідацію у zod-парсер (тестований), прибираємо cast. Клієнт лишаємо локальним лише якщо `@ya-ye/db` не експонує anon-browser-клієнт із потрібною конфігурацією — перевіряємо у кроці 5.

> Note: `@ya-ye/db` експортує `createServerClient`/`createBrowserClient`. Якщо жоден не дає anon insert із `persistSession:false` без додаткових env, лишаємо локальний клієнт, але прибираємо unsafe-cast (головний баг). Перевіряємо сигнатуру у Step 5 перед заміною клієнта.

- [ ] **Step 1: Write the failing test**

Create `apps/landing/src/lib/__tests__/exerciseResult.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseExerciseResult } from '../exerciseResult';

describe('parseExerciseResult', () => {
  it('accepts the two valid results', () => {
    expect(parseExerciseResult({ result: 'helped' })).toBe('helped');
    expect(parseExerciseResult({ result: 'neutral' })).toBe('neutral');
  });

  it('returns null for anything else (no cast, no throw)', () => {
    expect(parseExerciseResult({ result: 'bogus' })).toBeNull();
    expect(parseExerciseResult({ result: 123 })).toBeNull();
    expect(parseExerciseResult({})).toBeNull();
    expect(parseExerciseResult(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/landing test src/lib/__tests__/exerciseResult.test.ts`
Expected: FAIL — cannot find module `../exerciseResult`. (Якщо landing не має `test`-скрипта — додати `"test": "vitest run"` у `apps/landing/package.json` scripts, дзеркалячи teen, і `vitest` у devDependencies; інакше запускати `pnpm --filter @ya-ye/landing exec vitest run <path>`.)

- [ ] **Step 3: Create the validator**

Create `apps/landing/src/lib/exerciseResult.ts`:

```ts
import { z } from 'zod';

const ExerciseResultSchema = z.object({
  result: z.enum(['helped', 'neutral']),
});

export type ExerciseResult = z.infer<typeof ExerciseResultSchema>['result'];

/** Валідує тіло POST /api/exercise-feedback. Невалідне → null (без cast/throw). */
export function parseExerciseResult(raw: unknown): ExerciseResult | null {
  const parsed = ExerciseResultSchema.safeParse(raw);
  return parsed.success ? parsed.data.result : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/landing test src/lib/__tests__/exerciseResult.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the route to use the validator**

Спершу перевірити сигнатуру спільного клієнта:
Run: `grep -n "createBrowserClient\|createServerClient" packages/db/src/client.ts`

Замінити вміст `apps/landing/src/app/api/exercise-feedback/route.ts` рядки 1-11:

```ts
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  let result: string;
  try {
    const body = (await req.json()) as { result?: unknown };
    result = body.result as string;
    if (result !== 'helped' && result !== 'neutral') throw new Error('invalid result');
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }
```

на:

```ts
import { createClient } from '@supabase/supabase-js';
import { parseExerciseResult } from '@/lib/exerciseResult';

export async function POST(req: Request) {
  let result: 'helped' | 'neutral' | null = null;
  try {
    result = parseExerciseResult(await req.json());
  } catch {
    result = null;
  }
  if (!result) {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }
```

> Клієнт Supabase лишаємо як є (рядки 13-21): anon insert із `persistSession:false` — окремий легітимний use-case для landing. Головний баг (unsafe cast на untrusted input) усунено. Якщо `@ya-ye/db` експонує сумісний anon-клієнт — замінити у окремому follow-up (не блокер).

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/landing/src/lib/exerciseResult.ts apps/landing/src/lib/__tests__/exerciseResult.test.ts apps/landing/src/app/api/exercise-feedback/route.ts
git commit -m "fix(landing): zod-validate exercise-feedback body (remove unsafe cast)"
```

---

### Task 0.7: SessionTimer — cleanup effect split from setter effect (leak risk)

**Files:**
- Modify: `apps/teen/src/components/chat/SessionTimer.tsx:21-49`

**Why:** Cleanup-логіка (clearInterval/clearTimeout) живе в окремому `useEffect` (рядки 21-27), відірваному від ефекту, що створює таймери (рядки 29-49). Якщо deps другого ефекту (`[onExpire, router, sessionId]`) змінюються, перший ефект НЕ перевиконується → старі таймери течуть. Зливаємо cleanup у `return` ефекту-сетера.

- [ ] **Step 1: Read the current file**

Run: `cat apps/teen/src/components/chat/SessionTimer.tsx`
Зафіксувати точні рядки обох ефектів та імена ref-ів (план нижче передбачає `intervalRef`/`timeoutRef` — звірити з фактичними іменами і підставити їх).

- [ ] **Step 2: Merge cleanup into the setter effect**

Видалити окремий cleanup-`useEffect` (рядки 21-27) і додати його тіло у `return` ефекту-сетера (рядки 29-49), щоб cleanup виконувався на кожен re-run і на unmount. Результуючий ефект (підставити фактичні імена ref/таймерів зі Step 1):

```ts
  useEffect(() => {
    // ... існуюча логіка створення interval/timeout без змін ...
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onExpire, router, sessionId]);
```

> Якщо таймери зберігаються у локальних `const` (не ref), повертати clean-up із замиканням на ці `const` напряму — головне, щоб cleanup був у `return` ТОГО САМОГО ефекту, що їх створює.

- [ ] **Step 3: Verify no behavior change + no leak**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Manual: відкрити чат, дочекатись редіректу таймера — спрацьовує рівно один раз; refresh не лишає висячих інтервалів (React DevTools / no duplicate expire).

- [ ] **Step 4: Commit**

```bash
git add apps/teen/src/components/chat/SessionTimer.tsx
git commit -m "fix(chat): merge SessionTimer cleanup into setter effect (timer leak on dep change)"
```

---

## PHASE 1 — Business-logic / UI separation

> Залежність: Phase 1 робиться ПІСЛЯ Phase 0 (1.1/1.2 правлять той самий `sendMessage()`/`appendToStream`, що й 0.1/0.3/0.4 — працюємо на пост-Phase-0 коді).

### Task 1.1: Extract SSE transport from `sendMessage()` (page.tsx)

**Files:**
- Create: `apps/teen/src/lib/chatStream.ts`
- Test: `apps/teen/src/lib/__tests__/chatStream.test.ts`
- Modify: `apps/teen/src/app/(chat)/[sessionId]/page.tsx` (sendMessage SSE loop, post-Phase-0 рядки ~265-310)

**Why:** `sendMessage()` (~140 рядків) змішує UI-стан із низькорівневим SSE: `getReader()`, `TextDecoder`, ручний `buffer.split('\n\n')`, парсинг events. Це транспорт, не UI. Виносимо у `lib/chatStream.ts` async-generator `parseSseStream(reader)`, що yield-ить валідовані `SseEvent`. UI лишає лише реакцію на події. Чистий парсер байт-чанків тестуємо без DOM (мок ReadableStream reader).

- [ ] **Step 1: Write the failing test**

Create `apps/teen/src/lib/__tests__/chatStream.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSseStream } from '../chatStream';

// Хелпер: робить reader-подібний об'єкт із масиву рядкових чанків.
function readerFrom(chunks: string[]) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    read: async () =>
      i < chunks.length
        ? { done: false, value: enc.encode(chunks[i++]) }
        : { done: true, value: undefined },
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

async function collect(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const out = [];
  for await (const ev of parseSseStream(reader)) out.push(ev);
  return out;
}

describe('parseSseStream', () => {
  it('parses complete token/done events', async () => {
    const out = await collect(
      readerFrom(['data: {"type":"token","text":"hi"}\n\n', 'data: {"type":"done"}\n\n']),
    );
    expect(out).toEqual([{ type: 'token', text: 'hi' }, { type: 'done' }]);
  });

  it('reassembles an event split across chunks', async () => {
    const out = await collect(readerFrom(['data: {"type":"to', 'ken","text":"x"}\n\n']));
    expect(out).toEqual([{ type: 'token', text: 'x' }]);
  });

  it('skips malformed JSON and unknown events without throwing', async () => {
    const out = await collect(
      readerFrom([
        'data: not-json\n\n',
        'data: {"type":"weird"}\n\n',
        'data: {"type":"token","text":"ok"}\n\n',
      ]),
    );
    expect(out).toEqual([{ type: 'token', text: 'ok' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/chatStream.test.ts`
Expected: FAIL — cannot find module `../chatStream`.

- [ ] **Step 3: Create the transport module**

Create `apps/teen/src/lib/chatStream.ts`:

```ts
import { SseEventSchema, type SseEvent } from '@ya-ye/contracts';

/**
 * Споживає SSE-стрім з body-reader і yield-ить валідовані SseEvent.
 * Невалідний JSON / невідома подія / обрив — пропускаються без краша
 * (quality-gate §2.4, S3: «обрив стріму → UI не зависає»).
 */
export async function* parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      if (!event.startsWith('data: ')) continue;
      let json: unknown;
      try {
        json = JSON.parse(event.slice(6));
      } catch {
        continue;
      }
      const parsed = SseEventSchema.safeParse(json);
      if (parsed.success) yield parsed.data;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/chatStream.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the generator in page.tsx**

У `apps/teen/src/app/(chat)/[sessionId]/page.tsx` додати import:

```ts
import { parseSseStream } from '@/lib/chatStream';
```

Замінити SSE-loop (пост-Phase-0: блок від `// SSE streaming` / `const reader = response.body!.getReader();` до фінального `finalizeStream(assistantId);` перед `catch`):

```ts
      // SSE streaming
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          // SseEventSchema.safeParse замість голого JSON.parse:
          // обрив стріму або невалідний chunk → пропускаємо без краша UI
          // (quality-gate §2.4, S3: «обрив стріму → UI не зависає»).
          let parsed;
          try {
            parsed = SseEventSchema.safeParse(JSON.parse(event.slice(6)));
          } catch {
            // Невалідний JSON — пропускаємо chunk
            continue;
          }
          if (!parsed.success) {
            // Невідомий або некоректний SSE-event — пропускаємо без краша
            continue;
          }
          const data = parsed.data;
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
          // type === 'crisis' обробляється через JSON Content-Type вище, не SSE
        }
      }
      // Stream ended — ensure the bubble is finalized even if 'done' event was missed
      finalizeStream(assistantId);
```

на:

```ts
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
```

Якщо після цього `SseEventSchema` більше не використовується напряму у page.tsx — прибрати його з import (рядок 15 лишає `CrisisEventSchema, type ChatRequest`). Перевірити: `grep -n "SseEventSchema" "apps/teen/src/app/(chat)/[sessionId]/page.tsx"`.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @ya-ye/teen test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/teen/src/lib/chatStream.ts apps/teen/src/lib/__tests__/chatStream.test.ts "apps/teen/src/app/(chat)/[sessionId]/page.tsx"
git commit -m "refactor(chat): extract SSE transport to lib/chatStream (separate from UI state)"
```

---

### Task 1.2: Extract stream-chunk reducer to a pure function

**Files:**
- Create: `apps/teen/src/lib/applyStreamChunk.ts`
- Test: `apps/teen/src/lib/__tests__/applyStreamChunk.test.ts`
- Modify: `apps/teen/src/app/(chat)/[sessionId]/page.tsx` (`appendToStream`, post-Phase-0)

**Why:** `appendToStream` (post-0.1) усе ще тримає бізнес-логіку (join → parse mode-label → strip → split bubbles → derive `hasModeRedirect`) усередині `setMessages`. Це чистий розрахунок наступного стану бабла з тексту. Виносимо у `applyStreamChunk(prevBubbles, prevHasRedirect, chunk)` → `{ bubbles, hasModeRedirect, modeLabel }`. UI лишає `setModeLabel`/`setMessages`.

- [ ] **Step 1: Write the failing test**

Create `apps/teen/src/lib/__tests__/applyStreamChunk.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyStreamChunk } from '../applyStreamChunk';
import { DEFAULT_MODE_LABEL } from '../parseModeLabel';

describe('applyStreamChunk', () => {
  it('splits accumulated text into bubbles on blank lines', () => {
    const r = applyStreamChunk([''], false, 'перший\n\nдругий');
    expect(r.bubbles).toEqual(['перший', 'другий']);
    expect(r.hasModeRedirect).toBe(false);
  });

  it('extracts the mode label and strips it from bubbles', () => {
    const r = applyStreamChunk([''], false, '[02 · поруч] чую тебе');
    expect(r.modeLabel).toBe('[02 · поруч]');
    expect(r.bubbles).toEqual(['чую тебе']);
  });

  it('detects [MODE:4] redirect, strips marker, latches prior redirect=true', () => {
    const r = applyStreamChunk(['привіт'], false, ' хочеш? [MODE:4]');
    expect(r.hasModeRedirect).toBe(true);
    expect(r.bubbles.join(' ')).not.toContain('[MODE:4]');
    expect(applyStreamChunk(['x'], true, 'no marker').hasModeRedirect).toBe(true);
  });

  it('defaults the mode label when no tag present', () => {
    expect(applyStreamChunk([''], false, 'просто текст').modeLabel).toBe(DEFAULT_MODE_LABEL);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/applyStreamChunk.test.ts`
Expected: FAIL — cannot find module `../applyStreamChunk`.

- [ ] **Step 3: Create the reducer**

Create `apps/teen/src/lib/applyStreamChunk.ts`:

```ts
import {
  parseModeLabel,
  stripModeLabel,
  stripModeRedirect,
  hasModeRedirect,
} from '@/lib/parseModeLabel';

export interface StreamChunkResult {
  bubbles: string[];
  hasModeRedirect: boolean;
  modeLabel: string;
}

/**
 * Чистий розрахунок наступного стану assistant-бабла зі стрім-чанку.
 * Бере поточні баблі + прапор редиректу + новий текст, повертає нові баблі,
 * залатчений прапор [MODE:4] і витягнутий mode-лейбл. Без побічних ефектів.
 */
export function applyStreamChunk(
  prevBubbles: string[],
  prevHasRedirect: boolean,
  chunk: string,
): StreamChunkResult {
  const rawWithMarker = prevBubbles.join('\n\n') + chunk;
  const modeLabel = parseModeLabel(rawWithMarker);
  const raw = stripModeRedirect(stripModeLabel(rawWithMarker));
  return {
    bubbles: raw.split('\n\n').filter(Boolean),
    hasModeRedirect: prevHasRedirect || hasModeRedirect(rawWithMarker),
    modeLabel,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/applyStreamChunk.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the reducer in appendToStream**

У `apps/teen/src/app/(chat)/[sessionId]/page.tsx` додати import:

```ts
import { applyStreamChunk } from '@/lib/applyStreamChunk';
```

Замінити `appendToStream` (post-0.1 версія) на:

```ts
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
```

Після цього, якщо `parseModeLabel`/`stripModeLabel`/`hasModeRedirect`/`stripModeRedirect` більше не використовуються напряму у page.tsx — звузити import з `@/lib/parseModeLabel` до фактично потрібних (`DEFAULT_MODE_LABEL` лишається). Перевірити grep-ом.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @ya-ye/teen test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/teen/src/lib/applyStreamChunk.ts apps/teen/src/lib/__tests__/applyStreamChunk.test.ts "apps/teen/src/app/(chat)/[sessionId]/page.tsx"
git commit -m "refactor(chat): extract applyStreamChunk pure reducer out of appendToStream"
```

---

### Task 1.3: Extract `createSession` fetch from onboarding page

**Files:**
- Create: `apps/teen/src/lib/sessions.ts`
- Test: `apps/teen/src/lib/__tests__/sessions.test.ts`
- Modify: `apps/teen/src/app/(onboarding)/page.tsx:50-58` (та виклик)

**Why:** Онбординг-сторінка інлайнить `fetch('/api/sessions', ...)` + парсинг відповіді у UI-компоненті. Це data-доступ. Виносимо у `lib/sessions.ts` `createSession(payload)`, що валідує відповідь `SessionsCreateResponseSchema`. UI лишає лише навігацію.

- [ ] **Step 1: Read exact current call site**

Run: `sed -n '40,70p' "apps/teen/src/app/(onboarding)/page.tsx"`
Зафіксувати тіло запиту (поля `age_band`, `user_name`) і як використовується `sessionId` з відповіді.

- [ ] **Step 2: Write the failing test**

Create `apps/teen/src/lib/__tests__/sessions.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/sessions.test.ts`
Expected: FAIL — cannot find module `../sessions`.

- [ ] **Step 4: Create the data-access helper**

Create `apps/teen/src/lib/sessions.ts`:

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ya-ye/teen test src/lib/__tests__/sessions.test.ts`
Expected: PASS.

- [ ] **Step 6: Use it in the onboarding page**

У `apps/teen/src/app/(onboarding)/page.tsx` додати import:

```ts
import { createSession } from '@/lib/sessions';
```

Замінити inline-fetch-блок (рядки 50-58, точний фрагмент звірити зі Step 1) викликом `createSession({ age_band, user_name })` і використати `sessionId` з результату для навігації. Зберегти існуючу обробку помилок (try/catch → fallback-роут), якщо вона є. Прибрати ручний `fetch`/`.json()`/cast.

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @ya-ye/teen test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/teen/src/lib/sessions.ts apps/teen/src/lib/__tests__/sessions.test.ts "apps/teen/src/app/(onboarding)/page.tsx"
git commit -m "refactor(onboarding): extract createSession data-access to lib/sessions"
```

---

### Task 1.4: Use `stripBom()` in sendMessage (model resolution)

**Files:**
- Modify: `apps/teen/src/server/commands/sendMessage.ts:11` (import), `:303`

**Why:** Рядок 303 інлайнить `(process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5').replace(/^﻿/, '').trim()` — дублікат логіки `stripBom()` з `@/lib/env`. DRY. Один call site, тривіальна заміна.

- [ ] **Step 1: Add the import**

У `apps/teen/src/server/commands/sendMessage.ts` додати у блок import-ів (поряд з іншими `@/lib`):

```ts
import { stripBom } from '@/lib/env';
```

- [ ] **Step 2: Replace the inline strip**

Замінити рядок 303:

```ts
    model: (process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5').replace(/^﻿/, '').trim(),
```

на:

```ts
    model: stripBom(process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5'),
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @ya-ye/teen test`
Expected: PASS (існуючі тести sendMessage лишаються зеленими — поведінка ідентична).

- [ ] **Step 4: Commit**

```bash
git add apps/teen/src/server/commands/sendMessage.ts
git commit -m "refactor(chat): use stripBom() for model env (DRY with lib/env)"
```

---

### Task 1.5: Move `CONTACT_ICON_LABEL` UI-mapping out of the data layer

**Files:**
- Modify: `apps/teen/src/lib/specialists.ts:126-130` (видалити export)
- Modify: `apps/teen/src/model/constants.ts` (прийняти константу)
- Modify: `apps/teen/src/components/specialists/SpecialistCard.tsx:9` (import)

**Why:** `CONTACT_ICON_LABEL: Record<string, { label; title }>` — UI presentation-маппінг (підписи/тайтли іконок), що живе у data-шарі `lib/specialists.ts`. Єдиний споживач — `SpecialistCard`. Переносимо у `model/constants.ts` (presentation-константи). Решту split-у `specialists.ts` (типи/дані/функції) DEFERRED — там планується DB-міграція (див. «Deferred»).

- [ ] **Step 1: Read the constant to move it verbatim**

Run: `sed -n '126,135p' apps/teen/src/lib/specialists.ts`
Скопіювати точне тіло `CONTACT_ICON_LABEL` (усі ключі/значення).

- [ ] **Step 2: Append it to model/constants.ts**

У кінець `apps/teen/src/model/constants.ts` додати (вставити СКОПІЙОВАНЕ тіло зі Step 1 замість `/* … */`):

```ts

/** Presentation-маппінг каналів контакту спеціаліста → підпис/тайтл іконки. */
export const CONTACT_ICON_LABEL: Record<string, { label: string; title: string }> = {
  /* ← точне тіло, скопійоване з lib/specialists.ts:126-130 */
};
```

- [ ] **Step 3: Remove it from lib/specialists.ts**

Видалити рядки 126-130 (export `CONTACT_ICON_LABEL`) з `apps/teen/src/lib/specialists.ts`.

- [ ] **Step 4: Update the import in SpecialistCard**

У `apps/teen/src/components/specialists/SpecialistCard.tsx` замінити рядок 9:

```ts
import { CONTACT_ICON_LABEL } from '@/lib/specialists';
```

на:

```ts
import { CONTACT_ICON_LABEL } from '@/model/constants';
```

(Якщо `SpecialistCard` імпортував ще щось із `@/lib/specialists` тим самим рядком — лишити решту, винести лише `CONTACT_ICON_LABEL` у новий import з `@/model/constants`.)

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. `grep -rn "CONTACT_ICON_LABEL" apps/teen/src` → визначення лише у `model/constants.ts`, споживач — `SpecialistCard`.

- [ ] **Step 6: Commit**

```bash
git add apps/teen/src/lib/specialists.ts apps/teen/src/model/constants.ts apps/teen/src/components/specialists/SpecialistCard.tsx
git commit -m "refactor(specialists): move CONTACT_ICON_LABEL UI map from data layer to model/constants"
```

---

## PHASE 2 — Structure hygiene (component-file rule, a11y, dead-code)

> Переважно механічні релокації. Кожна верифікується `pnpm typecheck && pnpm lint` (UI/data-зміни без нової логіки). Кожна — окремий commit.

### Task 2.1: Island — move module-scope constants to a co-located file

**Files:**
- Create: `packages/ui/src/components/Island/island.constants.ts`
- Modify: `packages/ui/src/components/Island/Island.tsx:21-43` + import

**Why:** Component-file rule: `Island.tsx` містить `const DIMENSIONS` (21-25) і `const STARS` (27-43) на module-scope. Виносимо у co-located `island.constants.ts`.

- [ ] **Step 1: Read the exact constants**

Run: `sed -n '1,45p' packages/ui/src/components/Island/Island.tsx`
Скопіювати точні `DIMENSIONS` (21-25), `STARS` (27-43) та тип `IslandVariant` (потрібен для типу `DIMENSIONS`).

- [ ] **Step 2: Create the constants file**

Create `packages/ui/src/components/Island/island.constants.ts` — вставити СКОПІЙОВАНІ визначення. Якщо `IslandVariant` визначений в `Island.tsx`, або (а) перенести його сюди й реекспортувати, або (б) імпортувати з місця, де він живе. Каркас:

```ts
import type { IslandVariant } from './Island'; // або з ./island.types, якщо там

export const DIMENSIONS: Record<IslandVariant, { maxW: number; viewBox: string }> = {
  /* ← точне тіло з Island.tsx:21-25 */
};

export const STARS: ReadonlyArray<readonly [number, number, number, number]> = [
  /* ← точне тіло з Island.tsx:27-43 */
];
```

> Якщо виникає циклічний import (`Island.tsx` ↔ `island.constants.ts` через `IslandVariant`) — винести `IslandVariant` у `island.types.ts` і імпортувати в обох. Перевірити наявний `island.types.ts`: `ls packages/ui/src/components/Island/`.

- [ ] **Step 3: Import constants in Island.tsx, remove the inline defs**

Видалити рядки 21-43 в `Island.tsx`, додати import нагорі:

```ts
import { DIMENSIONS, STARS } from './island.constants';
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @ya-ye/ui typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Island/
git commit -m "refactor(ui): move Island DIMENSIONS/STARS to co-located island.constants"
```

---

### Task 2.2: Island tooltip — replace raw hex with Tailwind tokens

**Files:**
- Modify: `packages/ui/src/components/Island/Island.tsx:364-432` (tooltip inline styles)

**Why:** Tooltip використовує сирий hex у inline-стилях (`#D9D0BD`, `#EDE5D6`, `#C28160`, `#1F1B16`, `#5A5347`) — обходить дизайн-токени. Мапінг до Tailwind-класів: `#D9D0BD`→`divider`, `#EDE5D6`→`bgSoft`, `#C28160`→`accent`, `#1F1B16`→`ink`, `#5A5347`→`inkSoft`.

- [ ] **Step 1: Read the tooltip block**

Run: `sed -n '360,433p' packages/ui/src/components/Island/Island.tsx`
Зафіксувати кожне місце з hex (border/background/color у inline `style` чи рядкових класах).

- [ ] **Step 2: Replace hex with token classes**

Для кожного inline-hex застосувати Tailwind-клас за мапінгом вище. Приклади перетворень:
- `style={{ borderColor: '#D9D0BD' }}` → `className="... border-divider"` (прибрати inline borderColor)
- `style={{ background: '#EDE5D6' }}` → `className="... bg-bgSoft"`
- `style={{ color: '#1F1B16' }}` → `className="... text-ink"`; `#5A5347` → `text-inkSoft`; `#C28160` → `text-accent`/`bg-accent` (за контекстом).

> Якщо для SVG-елементів класи не діють (SVG fill/stroke у деяких рантаймах) — використати токен через `fill`/`stroke` з тим самим значенням лише там, де клас неможливий; решту перевести на класи. Не вводити нових кольорів.

- [ ] **Step 3: Verify visually + typecheck**

Run: `pnpm --filter @ya-ye/ui typecheck && pnpm lint`
Expected: PASS. Manual: tooltip острова виглядає ідентично (ті ж кольори, бо токени = ті ж hex).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/Island/Island.tsx
git commit -m "refactor(ui): Island tooltip uses Tailwind color tokens (no raw hex)"
```

---

### Task 2.3: Island a11y — interactive role + keyboard-operable layers

**Files:**
- Modify: `packages/ui/src/components/Island/Island.tsx:90` (role)
- Modify: `packages/ui/src/lib/island-layer-props.ts:9-38`

**Why:** `role="img"` фіксований (рядок 90), хоча в interactive-режимі острів — група кнопок-шарів. `layerProps()` повертає лише mouse/click — шари недоступні з клавіатури (WCAG 2.1.1). Додаємо `tabIndex`, `role="button"`, `onKeyDown` (Enter/Space → `onTap`).

- [ ] **Step 1: Extend layerProps with keyboard affordances**

У `packages/ui/src/lib/island-layer-props.ts` замінити інтерфейс `LayerStyleProps` та return:

```ts
interface LayerStyleProps {
  style: {
    cursor: 'pointer' | undefined;
    opacity: number;
    transition: string;
  };
  onMouseEnter: MouseEventHandler<SVGGElement>;
  onMouseLeave: MouseEventHandler<SVGGElement>;
  onClick: MouseEventHandler<SVGGElement>;
}

// Повертає style+event пропси для інтерактивного шару острова.
// Винесено з Island.tsx — компонентний файл не може містити хелпери.
export function layerProps(
  fm: 1 | 2 | 3 | 4,
  activeFm: 1 | 2 | 3 | 4 | null,
  interactive: boolean,
  handlers: LayerHandlers,
): LayerStyleProps {
  return {
    style: {
      cursor: interactive ? 'pointer' : undefined,
      opacity: activeFm && activeFm !== fm ? 0.55 : 1,
      transition: 'opacity 200ms ease',
    },
    onMouseEnter: () => handlers.onEnter(fm),
    onMouseLeave: () => handlers.onLeave(),
    onClick: () => handlers.onTap(fm),
  };
}
```

на:

```ts
import type { MouseEventHandler, KeyboardEventHandler } from 'react';

interface LayerStyleProps {
  style: {
    cursor: 'pointer' | undefined;
    opacity: number;
    transition: string;
  };
  onMouseEnter: MouseEventHandler<SVGGElement>;
  onMouseLeave: MouseEventHandler<SVGGElement>;
  onClick: MouseEventHandler<SVGGElement>;
  tabIndex?: number;
  role?: 'button';
  onKeyDown?: KeyboardEventHandler<SVGGElement>;
}

// Повертає style+event пропси для інтерактивного шару острова.
// Винесено з Island.tsx — компонентний файл не може містити хелпери.
// interactive=true → шар operable з клавіатури (WCAG 2.1.1): Enter/Space → onTap.
export function layerProps(
  fm: 1 | 2 | 3 | 4,
  activeFm: 1 | 2 | 3 | 4 | null,
  interactive: boolean,
  handlers: LayerHandlers,
): LayerStyleProps {
  const base: LayerStyleProps = {
    style: {
      cursor: interactive ? 'pointer' : undefined,
      opacity: activeFm && activeFm !== fm ? 0.55 : 1,
      transition: 'opacity 200ms ease',
    },
    onMouseEnter: () => handlers.onEnter(fm),
    onMouseLeave: () => handlers.onLeave(),
    onClick: () => handlers.onTap(fm),
  };
  if (!interactive) return base;
  return {
    ...base,
    tabIndex: 0,
    role: 'button',
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlers.onTap(fm);
      }
    },
  };
}
```

Замінити верхній рядок `import type { MouseEventHandler } from 'react';` (рядок 1) на нову версію з `KeyboardEventHandler` (вже включено вище — прибрати старий дублікат рядка 1).

- [ ] **Step 2: Make the root role conditional in Island.tsx**

У `packages/ui/src/components/Island/Island.tsx` рядок 90 замінити:

```tsx
        role="img"
```

на:

```tsx
        role={interactive ? 'group' : 'img'}
```

(Звірити, що `interactive` — у scope цього JSX; це проп компонента. Якщо назва пропа інша — підставити фактичну.)

- [ ] **Step 3: Verify**

Run: `pnpm --filter @ya-ye/ui typecheck && pnpm lint`
Expected: PASS. Manual: Tab фокусує шари в interactive-режимі, Enter/Space активують той самий handler, що й клік.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/Island/Island.tsx packages/ui/src/lib/island-layer-props.ts
git commit -m "fix(a11y): Island layers keyboard-operable + interactive role (WCAG 2.1.1)"
```

---

### Task 2.4: Give method domain types a home in `src/types.ts`

**Files:**
- Modify: `packages/method/src/types.ts` (own `Mode`, `FM`, `Scenario`)
- Modify: `packages/method/system-prompt.ts:198-199` (import замість define)
- Modify: `packages/method/src/scenarios.ts:5-13` (import `Scenario`)

**Why:** Доменні типи `Mode`/`FM` визначені у `system-prompt.ts` (рядки 198-199), а `Scenario` — у `scenarios.ts` (5-13). Канонічне місце доменних типів — `src/types.ts` (зараз re-export shim). Переносимо ВИЗНАЧЕННЯ туди, лишаємо re-export для сумісності.

> **Constraint:** Це чисто типова релокація — НЕ змінює рантайм/байти промта. `prompt-snapshot.test.ts` має лишитись зеленим. Якщо щось у промт-output зміниться — STOP, це не типова правка.

- [ ] **Step 1: Read current type definitions**

Run: `sed -n '195,205p' packages/method/system-prompt.ts && echo '---' && sed -n '1,15p' packages/method/src/scenarios.ts && echo '---' && cat packages/method/src/types.ts`
Зафіксувати точні визначення `Mode`, `FM`, `Scenario` та поточний вміст `types.ts`.

- [ ] **Step 2: Move definitions into src/types.ts**

У `packages/method/src/types.ts` додати канонічні визначення (вставити точні тіла зі Step 1):

```ts
/* ← точні визначення Mode та FM (з system-prompt.ts:198-199) */
/* ← точне визначення Scenario (з scenarios.ts:5-13) */
```

Якщо `types.ts` уже re-export-ить ці імена з інших місць — замінити re-export на owned-визначення тут, і навпаки реекспортнути з колишніх місць (нижче).

- [ ] **Step 3: Replace definitions with imports at the old sites**

У `system-prompt.ts` замінити визначення `Mode`/`FM` (рядки 198-199) на import з `./src/types` (звірити фактичний relative-path; `system-prompt.ts` у корені пакета → `./src/types`). Лишити локальний re-export, якщо інші модулі імпортували `Mode`/`FM` з `system-prompt`:

```ts
import type { Mode, FM } from './src/types';
export type { Mode, FM };
```

У `packages/method/src/scenarios.ts` замінити визначення `Scenario` (5-13) на:

```ts
import type { Scenario } from './types';
export type { Scenario };
```

- [ ] **Step 4: Verify types + prompt snapshot unchanged**

Run: `pnpm --filter @ya-ye/method test`
Expected: PASS — особливо `prompt-snapshot.test.ts` (байт-в-байт). `pnpm typecheck` теж PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/method/src/types.ts packages/method/system-prompt.ts packages/method/src/scenarios.ts
git commit -m "refactor(method): own Mode/FM/Scenario in src/types (re-export shims kept)"
```

---

### Task 2.5: Remove dead `@ya-ye/db` → `@ya-ye/method` re-exports + drop the dep

**Files:**
- Modify: `packages/db/src/aliases.ts:10-11` (видалити)
- Modify: `packages/db/src/index.ts:11-21` (прибрати `Jurisdiction`, `CrisisSeverity`)
- Modify: `packages/db/package.json:17` (видалити `@ya-ye/method` dep)

**Why:** `aliases.ts` реекспортить `Jurisdiction`/`CrisisSeverity` з `@ya-ye/method`, а `index.ts` їх ре-експортить далі. Grep підтвердив: ЖОДЕН споживач не імпортує ці типи з `@ya-ye/db` — усі беруть з `@ya-ye/method` напряму. Це dead code + DIP-порушення (нижній шар `db` залежить від доменного `method`). Видаляємо обидва re-export-и і єдиний deps-запис `@ya-ye/method`, що їх живив.

- [ ] **Step 1: Re-confirm no external consumers**

Run: `grep -rn "Jurisdiction\|CrisisSeverity" --include="*.ts" --include="*.tsx" apps packages | grep "@ya-ye/db"`
Expected: НІЧОГО (порожньо). Якщо є збіги — STOP, не dead code; виправити ті імпорти на `@ya-ye/method` спершу.

- [ ] **Step 2: Remove the two re-exports from aliases.ts**

У `packages/db/src/aliases.ts` видалити рядки 10-11:

```ts
export type { Jurisdiction } from '@ya-ye/method';
export type { CrisisSeverity } from '@ya-ye/method';
```

- [ ] **Step 3: Remove them from the index barrel**

У `packages/db/src/index.ts` замінити блок (рядки 11-21):

```ts
export type {
  AgeBand,
  Jurisdiction,
  SessionEndReason,
  CrisisSeverity,
  ReferralStatus,
  ReferralUrgency,
  ConsentType,
  MessageRole,
  ProposedSlot,
} from './aliases';
```

на:

```ts
export type {
  AgeBand,
  SessionEndReason,
  ReferralStatus,
  ReferralUrgency,
  ConsentType,
  MessageRole,
  ProposedSlot,
} from './aliases';
```

- [ ] **Step 4: Drop the method dependency**

У `packages/db/package.json` видалити рядок 17 (`"@ya-ye/method": "workspace:*"`) з `dependencies`. Перевірити кому на попередньому рядку (валідний JSON після видалення).

- [ ] **Step 5: Reinstall + verify**

Run: `pnpm install && pnpm --filter @ya-ye/db typecheck && pnpm typecheck`
Expected: PASS — `@ya-ye/db` більше не тягне `@ya-ye/method`, нічого не зламано.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/aliases.ts packages/db/src/index.ts packages/db/package.json pnpm-lock.yaml
git commit -m "refactor(db): drop dead Jurisdiction/CrisisSeverity re-exports + @ya-ye/method dep (DIP)"
```

---

### Task 2.6: Sessions routes — use `jsonError()` instead of inline error responses

**Files:**
- Modify: `apps/teen/src/app/api/sessions/route.ts` (5 inline error responses)
- Modify: `apps/teen/src/app/api/sessions/[id]/route.ts` (4 inline error responses)

**Why:** `jsonError(error, status)` вже експортований з `@/lib/api-response`, але не використовується — натомість 7+ копій `new Response(JSON.stringify({ error }), { status, headers: {...} })`. DRY.

- [ ] **Step 1: Update `sessions/route.ts`**

У `apps/teen/src/app/api/sessions/route.ts` додати import нагорі:

```ts
import { jsonError } from '@/lib/api-response';
```

Замінити кожен error-response (зберегти `sessionResponse`'s `Set-Cookie` 201 — він НЕ помилка, не чіпати):
- рядки 16-19 (`'server misconfigured'`, 500) → `return jsonError('server misconfigured', 500);`
- рядки 32-35 (`'invalid request'`, 400) → `return jsonError('invalid request', 400);`
- рядки 41-44 (`firstIssue`, 400) → `return jsonError(firstIssue, 400);`
- рядки 55-58 (`result.error`, `result.status`) → `return jsonError(result.error, result.status);`

- [ ] **Step 2: Update `sessions/[id]/route.ts`**

У `apps/teen/src/app/api/sessions/[id]/route.ts` додати import:

```ts
import { jsonError } from '@/lib/api-response';
```

Замінити:
- рядки 20-23 (`'missing session id'`, 400) → `return jsonError('missing session id', 400);`
- рядки 28-31 (`'unauthorized'`, 401) → `return jsonError('unauthorized', 401);`
- рядки 34-37 (`'forbidden'`, 403) → `return jsonError('forbidden', 403);`
- рядки 47-50 (`result.error`, `result.status`) → `return jsonError(result.error, result.status);`

Залишити `return new Response(null, { status: 204 });` (рядок 54) як є — це не помилка.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @ya-ye/teen test`
Expected: PASS (route-тести, якщо є, лишаються зеленими — payload ідентичний).

- [ ] **Step 4: Commit**

```bash
git add apps/teen/src/app/api/sessions/route.ts "apps/teen/src/app/api/sessions/[id]/route.ts"
git commit -m "refactor(api): use jsonError() in sessions routes (DRY, 7 inline responses)"
```

---

### Task 2.7: Move `info` page FAQ array to a co-located constants file

**Files:**
- Create: `apps/teen/src/app/info/info.constants.ts`
- Modify: `apps/teen/src/app/info/page.tsx:5-34` + import

**Why:** `const FAQ = [...]` (рядки 5-34) на module-scope у page-компоненті. Component-file rule → co-located `info.constants.ts`.

- [ ] **Step 1: Read the FAQ array**

Run: `sed -n '1,40p' apps/teen/src/app/info/page.tsx`
Скопіювати точний `FAQ` та його inline-тип (якщо є).

- [ ] **Step 2: Create the constants file**

Create `apps/teen/src/app/info/info.constants.ts` — вставити скопійований масив:

```ts
export const FAQ = [
  /* ← точне тіло з page.tsx:5-34 */
];
```

(Якщо елементи містять JSX — лишити у page.tsx як є; це не «константа», а UI. У такому разі цю задачу SKIP і занотувати. Зі структури (FAQ — q/a текст) очікується чистий масив рядків.)

- [ ] **Step 3: Import in page.tsx, remove inline def**

Видалити рядки 5-34 в `page.tsx`, додати import:

```ts
import { FAQ } from './info.constants';
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/teen/src/app/info/
git commit -m "refactor(info): move FAQ array to co-located info.constants"
```

---

### Task 2.8: Booking page — move `RadioOption` + `Checkbox` to co-located components file

**Files:**
- Create: `apps/teen/src/app/specialists/[slug]/book/[sessionType]/_components.tsx`
- Modify: `apps/teen/src/app/specialists/[slug]/book/[sessionType]/page.tsx:361-419` + imports

**Why:** `RadioOption` (361-394) та `Checkbox` (396-419) — module-scope під-компоненти в page-файлі. Component-file rule → co-located `_components.tsx` (Next.js ігнорує `_`-префікс як роут).

- [ ] **Step 1: Read both sub-components**

Run: `sed -n '361,419p' "apps/teen/src/app/specialists/[slug]/book/[sessionType]/page.tsx"`
Скопіювати обидва компоненти + їх Props-типи. Зафіксувати, які import-и вони потребують (React types, lucide-icons, `cn`).

- [ ] **Step 2: Create `_components.tsx`**

Create `apps/teen/src/app/specialists/[slug]/book/[sessionType]/_components.tsx` — вставити обидва компоненти з потрібними import-ами нагорі:

```tsx
/* ← необхідні import-и (React, cn, icons), визначені зі Step 1 */

export function RadioOption(/* ← точна сигнатура */) {
  /* ← точне тіло з page.tsx:361-394 */
}

export function Checkbox(/* ← точна сигнатура */) {
  /* ← точне тіло з page.tsx:396-419 */
}
```

- [ ] **Step 3: Import them in page.tsx, remove inline defs**

Видалити рядки 361-419 в `page.tsx`, додати import:

```ts
import { RadioOption, Checkbox } from './_components';
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/teen/src/app/specialists/[slug]/book/[sessionType]/"
git commit -m "refactor(booking): extract RadioOption/Checkbox to co-located _components"
```

---

### Task 2.9: Specialists list — extract `Step` sub-component

**Files:**
- Create: `apps/teen/src/app/specialists/HowItWorksStep.tsx`
- Modify: `apps/teen/src/app/specialists/page.tsx:97-105` + import

**Why:** `function Step({ n, title, text })` (97-105) — module-scope під-компонент у page. Виносимо у `HowItWorksStep.tsx`.

- [ ] **Step 1: Read the Step component**

Run: `sed -n '97,106p' apps/teen/src/app/specialists/page.tsx`
Скопіювати точне тіло + props.

- [ ] **Step 2: Create the component file**

Create `apps/teen/src/app/specialists/HowItWorksStep.tsx`:

```tsx
interface HowItWorksStepProps {
  n: string;
  title: string;
  text: string;
}

export function HowItWorksStep({ n, title, text }: HowItWorksStepProps) {
  /* ← точне тіло з page.tsx:97-105 (return JSX) */
}
```

- [ ] **Step 3: Update page.tsx**

Видалити `function Step(...)` (97-105). Додати import:

```ts
import { HowItWorksStep } from './HowItWorksStep';
```

Замінити всі `<Step ... />` на `<HowItWorksStep ... />` у `page.tsx` (grep: `grep -n "<Step" apps/teen/src/app/specialists/page.tsx`).

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/teen/src/app/specialists/
git commit -m "refactor(specialists): extract Step → HowItWorksStep component"
```

---

### Task 2.10: Success page — extract `NextStep` sub-component

**Files:**
- Create: `apps/teen/src/app/specialists/[slug]/book/[sessionType]/success/NextStep.tsx`
- Modify: `.../success/page.tsx:113-122` + import

**Why:** `function NextStep({ n, text })` (113-122) — module-scope під-компонент. Виносимо. (НЕ створювати спільний `NumberedCard` з `HowItWorksStep` — різні props/контексти, спільна абстракція = overengineering без 3-го споживача.)

- [ ] **Step 1: Read NextStep**

Run: `sed -n '113,123p' "apps/teen/src/app/specialists/[slug]/book/[sessionType]/success/page.tsx"`
Скопіювати точне тіло + props (`text: React.ReactNode`).

- [ ] **Step 2: Create the component file**

Create `apps/teen/src/app/specialists/[slug]/book/[sessionType]/success/NextStep.tsx`:

```tsx
import type { ReactNode } from 'react';

interface NextStepProps {
  n: string;
  text: ReactNode;
}

export function NextStep({ n, text }: NextStepProps) {
  /* ← точне тіло з success/page.tsx:113-122 (return JSX) */
}
```

- [ ] **Step 3: Update page.tsx**

Видалити `function NextStep(...)` (113-122). Додати import:

```ts
import { NextStep } from './NextStep';
```

Виклики `<NextStep ... />` (рядки 49/58/67) лишаються без змін.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/teen/src/app/specialists/[slug]/book/[sessionType]/success/"
git commit -m "refactor(booking): extract NextStep component from success page"
```

---

### Task 2.11: CrisisScreen — move `DEFAULT_JURISDICTION` to model/constants

**Files:**
- Modify: `apps/teen/src/components/crisis/CrisisScreen.tsx:12` (remove), `:21` (import usage)
- Modify: `apps/teen/src/model/constants.ts` (add)

**Why:** `const DEFAULT_JURISDICTION = 'UA'` (рядок 12) — module-scope константа у компоненті. Component-file rule → `model/constants.ts`.

- [ ] **Step 1: Add to model/constants.ts**

У кінець `apps/teen/src/model/constants.ts` додати:

```ts

/** Дефолтна юрисдикція для кризових ліній (MVP — UA). */
export const DEFAULT_JURISDICTION = 'UA';
```

- [ ] **Step 2: Update CrisisScreen.tsx**

Видалити рядок 12 (`const DEFAULT_JURISDICTION = 'UA';`). Додати import:

```ts
import { DEFAULT_JURISDICTION } from '@/model/constants';
```

Використання на рядку 21 (`getHotlines(DEFAULT_JURISDICTION)`) лишається.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/teen/src/components/crisis/CrisisScreen.tsx apps/teen/src/model/constants.ts
git commit -m "refactor(crisis): move DEFAULT_JURISDICTION to model/constants"
```

---

### Task 2.12: CrisisModal — add `aria-describedby`

**Files:**
- Modify: `apps/teen/src/components/crisis/CrisisModal.tsx:32-47`

**Why:** `role="dialog"` (рядок 34) має `aria-label`, але не `aria-describedby` — скрінрідер не оголошує пояснювальний текст. Додаємо `id` на пояснювальний `<p>` (рядок 41) і `aria-describedby` на діалог.

- [ ] **Step 1: Add id + aria-describedby**

У `apps/teen/src/components/crisis/CrisisModal.tsx` замінити рядок 36 (`aria-label="Кризова підтримка"`) — додати наступним рядком:

```tsx
      aria-label="Кризова підтримка"
      aria-describedby="crisis-modal-desc"
```

Замінити рядок 41:

```tsx
          <p className="font-sans text-base leading-relaxed text-ink">я чую тебе.</p>
```

на:

```tsx
          <p id="crisis-modal-desc" className="font-sans text-base leading-relaxed text-ink">
            я чую тебе.
          </p>
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/teen/src/components/crisis/CrisisModal.tsx
git commit -m "fix(a11y): CrisisModal dialog aria-describedby"
```

---

### Task 2.13: Onboarding — fix `text-white` on `bg-accent` contrast

**Files:**
- Modify: `apps/teen/src/app/(onboarding)/page.tsx:121,222`

**Why:** `text-white` на `bg-accent` (#C28160) — контраст ~2.3:1, нижче WCAG AA 4.5:1. Дизайн-система не має `white` як токен; основний текст — `ink` (#1F1B16). Замінюємо на `text-ink` (узгоджено з рештою кнопок).

> Перевірити перед заміною: чи `text-ink` на `bg-accent` дає AA. #1F1B16 на #C28160 ≈ 5.9:1 — PASS. Якщо дизайн вимагає світлого тексту — це методолог/дизайн-рішення (тоді STOP і спитати). Дефолт плану: `text-ink`.

- [ ] **Step 1: Replace at line 121**

Замінити (рядок 121):

```tsx
                ? 'bg-accent text-white active:opacity-80'
```

на:

```tsx
                ? 'bg-accent text-ink active:opacity-80'
```

- [ ] **Step 2: Replace at line 222**

Замінити (рядок 222):

```tsx
            selected ? 'bg-accent text-white active:opacity-80' : 'bg-divider text-inkSoft',
```

на:

```tsx
            selected ? 'bg-accent text-ink active:opacity-80' : 'bg-divider text-inkSoft',
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Manual: вибрані кнопки онбордингу читабельні (темний текст на акценті).

> Note: button `text-white` у chat send-button (`page.tsx:440`) — це іконка `<Send>` (SVG stroke), не текст; контраст не застосовується так само. Не чіпати в цій задачі.

- [ ] **Step 4: Commit**

```bash
git add "apps/teen/src/app/(onboarding)/page.tsx"
git commit -m "fix(a11y): onboarding selected buttons use text-ink (AA contrast on accent)"
```

---

### Task 2.14: Landing — move `grounding-minute` into components/ + de-magic step count

**Files:**
- Create: `apps/landing/src/components/GroundingMinute.tsx`
- Delete: `apps/landing/src/app/grounding-minute.tsx`
- Modify: importers of `grounding-minute`
- (within moved file) `:14,40` — derive done-state from `STEPS.length`

**Why:** (a) Client-компонент живе в `app/`-директорії (роут-простір) замість `components/`. (b) Magic-number `7` для done-стану (рядки 14, 40) — крихко прив'язаний до кількості кроків. Деривуємо: `STEPS.length` кроків + feedback + done.

- [ ] **Step 1: Find importers + read the file**

Run: `grep -rn "grounding-minute" apps/landing/src && echo '---' && cat apps/landing/src/app/grounding-minute.tsx`
Зафіксувати: хто імпортує, чи є локальний `STEPS`-масив і його довжину (очікувано 5: кроки 1–5).

- [ ] **Step 2: Create the component in components/**

Створити `apps/landing/src/components/GroundingMinute.tsx` із ПОВНИМ вмістом старого файлу. Замінити magic-числа на derived-константи. Якщо у файлі є `STEPS` довжиною 5: ввести нагорі (поза компонентом, presentation-константа):

```ts
const FEEDBACK_STEP = STEPS.length + 1; // 6 — крок фідбеку
const DONE_STEP = STEPS.length + 2;     // 7 — завершено
```

і замінити:
- рядок 14 коментар/семантику лишити, але будь-яке порівняння `=== 7` → `=== DONE_STEP`, `=== 6` → `=== FEEDBACK_STEP`.
- рядок 40 `const isDone = step === 7;` → `const isDone = step === DONE_STEP;`.

> Якщо `STEPS` НЕ існує в файлі (кроки інлайнові) — ввести `const STEP_COUNT = 5;` з коментарем і деривувати `FEEDBACK_STEP`/`DONE_STEP` від нього. Не вгадувати: звірити фактичну к-сть кроків зі Step 1.

- [ ] **Step 3: Delete the old file + update importers**

```bash
git rm apps/landing/src/app/grounding-minute.tsx
```

Оновити кожен importer (зі Step 1): шлях `.../app/grounding-minute` → `@/components/GroundingMinute` (і назву імпорту, якщо змінилась на `GroundingMinute`).

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/src
git commit -m "refactor(landing): move GroundingMinute to components/, derive step count"
```

---

### Task 2.15: Therapists referral — fix dead button

**Files:**
- Modify: `apps/therapists/src/app/referral/[id]/page.tsx:101-103`

**Why:** `<button className="...">` (рядок 101) без `type`, `onClick` чи `disabled` — мертва кнопка (нічого не робить, не submit). Визначити намір: якщо це placeholder майбутньої дії — зробити `type="button" disabled` з явним станом; якщо submit — `type="submit"`.

- [ ] **Step 1: Read context around the button**

Run: `sed -n '85,110p' "apps/therapists/src/app/referral/[id]/page.tsx"`
Визначити: чи кнопка в `<form>` (тоді `type="submit"`), чи самостійна (тоді потрібен `onClick` або `disabled` placeholder).

- [ ] **Step 2: Apply the minimal correct fix**

Якщо НЕ у формі і дія ще не реалізована (MVP-placeholder) — замінити рядок 101:

```tsx
        <button className="w-full rounded-2xl bg-accent py-4 font-sans text-base text-white transition-opacity hover:opacity-90">
```

на:

```tsx
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full rounded-2xl bg-accent py-4 font-sans text-base text-ink opacity-50 transition-opacity"
        >
```

(`text-white`→`text-ink` теж виправляє контраст. Якщо кнопка реально має submit-дію у формі — натомість `type="submit"` + лишити стилі активними. Обрати за результатом Step 1.)

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/therapists/src/app/referral/[id]/page.tsx"
git commit -m "fix(therapists): referral button has explicit type/state (no dead button)"
```

---

### Task 2.16: Therapists login — associate labels with inputs (`htmlFor`)

**Files:**
- Modify: `apps/therapists/src/app/login/page.tsx:13-31`

**Why:** `<label>` (рядки 14, 23) без `htmlFor`, `<input>` (15, 26) без `id` — labels не асоційовані (WCAG 1.3.1 / 4.1.2; клік по label не фокусує input).

- [ ] **Step 1: Read the form**

Run: `sed -n '10,35p' apps/therapists/src/app/login/page.tsx`
Зафіксувати точні label-тексти та порядок input-ів (email, далі другий — ймовірно OTP/password).

- [ ] **Step 2: Add id + htmlFor pairs**

Для email (рядки 14-15): label отримує `htmlFor="login-email"`, input — `id="login-email"`. Для другого поля (рядки 23-26): `htmlFor="login-otp"` + `id="login-otp"` (підставити семантичне ім'я за фактичним полем зі Step 1). Приклад для email:

```tsx
            <label htmlFor="login-email" className="font-mono text-xs uppercase tracking-wider text-inkSoft">email</label>
            <input
              id="login-email"
```

(аналогічно для другого поля з його власним `id`).

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Manual: клік по label фокусує відповідний input.

- [ ] **Step 4: Commit**

```bash
git add apps/therapists/src/app/login/page.tsx
git commit -m "fix(a11y): therapists login labels associated via htmlFor/id (WCAG 1.3.1)"
```

---

## Deliberately deferred (YAGNI / blocked)

Свідомо НЕ робимо — або потребує зовнішнього погодження, або немає 3-го застосування, або відхилено адверсаріальним аудитом:

| Item | Чому ні |
|---|---|
| **HOTLINES-консолідація** (`system-prompt.ts` private `HOTLINES` + hardcoded `116 111` ↔ canonical `src/hotlines.ts`) | **BLOCKED — Methodology Lead sign-off.** Форми даних різні (`{anonymous[],specialist}` vs `{name,number,note,channel}`), а рядки в `buildElevatedCrisisBlock`/`buildCrisisOverride` — методологічна копія промта. Будь-яке злиття ризикує змінити байти промта → потребує review + інкремент `ANTHROPIC_PROMPT_VERSION` + зелений `prompt-snapshot.test.ts`. CLAUDE.md §6. |
| Sticky crisis-level extraction (`sendMessage.ts:164-181`) | Один call site. Витяг = абстракція без 2-го споживача. Аудит REJECTED. |
| `specialists.ts` повний split (типи/дані/функції) | Планується DB-міграція спеціалістів — split зараз = робота двічі. Зробити РАЗОМ з міграцією. (`CONTACT_ICON_LABEL` винесено окремо в 1.5 — це UI, не дані.) |
| Спільний `NumberedCard` для `HowItWorksStep`+`NextStep` | Різні props/контексти, лише 2 споживачі. Передчасна абстракція. |
| Заміна landing Supabase-клієнта на `@ya-ye/db` | Anon-insert із `persistSession:false` — окремий legit use-case. Головний баг (cast) усунено в 0.6. Не блокер. |
| Решта 6 відхилених аудитом фіксів | Спекулятивні (error handling неможливих станів, «extract to hook» без потреби). Аудит REJECTED — не вводимо. |

---

## Self-Review (executed against the audit)

**Spec coverage:** 42 підтверджені знахідки → задачі 0.1–0.7, 1.1–1.5, 2.1–2.16 + Deferred-таблиця. Кожна знахідка має задачу або явну причину відкладення. ✅

**Placeholder scan:** Усі логічні задачі мають повний код тестів+імплементації. Механічні релокації (2.1, 2.7–2.10, 2.14) містять директиву «скопіювати точне тіло зі Step 1» — це навмисно (виконавець читає файл перед правкою; вставляти стале тіло у план ризиковано при зсуві рядків). Жодних «TODO/fill-in/handle edge cases». ✅

**Type consistency:** `hasModeRedirect`/`stripModeRedirect` (0.1) → споживаються у 1.2 `applyStreamChunk` під тими ж іменами. `CrisisEventSchema`/`CrisisEvent` (0.3) — узгоджені exports↔import. `parseSseStream` (1.1), `applyStreamChunk` (1.2), `parseDbMessages`/`DbMessage` (0.4), `greetingFor` (0.5), `createSession`/`SessionsCreateRequest` (1.3), `hotlineHref` (0.2), `parseExerciseResult` (0.6) — сигнатури консистентні між визначенням і викликом. ✅

**Ordering hazard:** Phase 1 (1.1, 1.2) правлять той самий `page.tsx`, що й Phase 0 (0.1, 0.3, 0.4, 0.5). План явно вимагає Phase 0 → Phase 1 порядок; 1.1/1.2 написані під пост-Phase-0 код. ✅

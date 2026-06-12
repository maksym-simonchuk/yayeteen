'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@ya-ye/ui';
import type { AgeBand } from '@ya-ye/contracts';
import { AGE_BANDS } from '@/model/constants';
import { createSession } from '@/lib/sessions';

type Step = 'splash' | 'age' | 'name';

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<AgeBand | null>(null);
  const [step, setStep] = useState<Step>('splash');
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Фокус на інпут імені при появі кроку
  useEffect(() => {
    if (step === 'name') {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [step]);

  function handleStart() {
    setStep('age');
  }

  function handleAgeNext() {
    if (!selected) return;
    setStep('name');
  }

  async function startSession(userName: string | null) {
    if (submitting) return;
    setSubmitting(true);
    setStartError(false);

    // Зберігаємо дані для контексту чату
    sessionStorage.setItem('age_band', selected!);
    if (userName) sessionStorage.setItem('user_name', userName);
    else sessionStorage.removeItem('user_name');

    // Сесія працює лише з httpOnly-cookie від POST /api/sessions (P0-5):
    // локальний UUID без cookie гарантує 401 на /api/chat, тому фолбеку немає.
    try {
      const { sessionId } = await createSession({ age_band: selected!, user_name: userName });
      router.push(`/${sessionId}`);
    } catch (err) {
      console.error('[onboarding] /api/sessions failed', err);
      setStartError(true);
      setSubmitting(false);
    }
  }

  function handleNameSubmit() {
    const name = nameInput.trim() || null;
    startSession(name);
  }

  function handleSkipName() {
    startSession(null);
  }

  // ── Крок: ім'я ────────────────────────────────────────────────────────────
  if (step === 'name') {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-between bg-bg px-6 py-12">
        <div className="flex w-full max-w-sm flex-1 flex-col justify-center gap-8">
          <div className="space-y-2">
            <h2 className="font-serif text-3xl italic text-ink">як до тебе звертатись?</h2>
            <p className="font-sans text-sm leading-relaxed text-inkSoft">
              ім&apos;я, нікнейм, псевдонім — або нічого.
              <br />
              ти вирішуєш.
            </p>
          </div>

          <div className="space-y-3">
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
              }}
              maxLength={32}
              placeholder="Аня · Кіт · xyz · sol_7 ..."
              className={cn(
                'w-full rounded-2xl border border-divider bg-bgSoft px-5 py-4',
                'font-sans text-base text-ink placeholder:text-inkSoft/40',
                'focus:border-accent/50 focus:outline-none',
              )}
            />
            {/* Підказка про нікнейми */}
            <p className="px-1 font-sans text-xs text-inkSoft/60">
              підлітки часто пишуть нікнейми або навіть просто літеру — це окей
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleNameSubmit}
            disabled={submitting || !nameInput.trim()}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl py-4',
              'font-sans text-base font-medium transition-all',
              nameInput.trim() && !submitting
                ? 'bg-accent text-ink active:opacity-80'
                : 'bg-divider text-inkSoft',
            )}
          >
            {submitting ? 'починаємо…' : 'далі'}
            {!submitting && <ChevronRight size={18} strokeWidth={1.5} />}
          </button>
          <button
            onClick={handleSkipName}
            disabled={submitting}
            className="block w-full text-center font-sans text-sm text-inkSoft/70 underline-offset-2 hover:underline disabled:opacity-40"
          >
            продовжити без імені
          </button>
          {startError && (
            <p role="alert" className="text-center font-sans text-sm text-crisis">
              не вдалося почати. спробуй ще раз.
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── Крок: splash ──────────────────────────────────────────────────────────
  if (step === 'splash') {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-between bg-bg px-6 py-12">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <h1 className="font-serif text-[4.5rem] italic leading-none text-ink">Я є</h1>
          <p className="max-w-xs font-sans text-base leading-relaxed text-inkSoft">
            простір, поки знайдеш живу людину
          </p>
          {/* EU AI Act Article 50 — обов'язкове розкриття */}
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-inkSoft">
            я не людина · я алгоритм
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          {/* text-ink на accent: 5.6:1 (white — 3.2:1, fail WCAG 4.5:1 — S7 Lighthouse a11y) */}
          <button
            onClick={handleStart}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 font-sans text-base font-medium text-ink transition-opacity active:opacity-80"
          >
            почати
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
          <Link
            href="/info"
            className="block text-center font-sans text-sm text-inkSoft underline-offset-2 hover:underline"
          >
            як це працює?
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-between bg-bg px-6 py-12">
      <div className="flex w-full max-w-sm flex-1 flex-col justify-center gap-8">
        <div className="space-y-2">
          <h2 className="font-serif text-3xl italic text-ink">скільки тобі років?</h2>
          <p className="font-sans text-sm text-inkSoft">це впливає на те, як я відповідаю</p>
        </div>

        <div className="space-y-3">
          {AGE_BANDS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSelected(value)}
              className={cn(
                'flex w-full items-center justify-between rounded-2xl border px-5 py-4 font-sans text-base transition-all',
                selected === value
                  ? 'border-accent bg-accent/10 text-ink'
                  : 'border-divider bg-bgSoft text-inkSoft',
              )}
            >
              <span>{label}</span>
              {selected === value && <span className="font-mono text-xs text-accent">вибрано</span>}
            </button>
          ))}
        </div>

        {selected === '13-15' && (
          <div className="rounded-2xl bg-bgSoft px-4 py-3">
            <p className="font-sans text-sm leading-relaxed text-inkSoft">
              якщо тобі 13–15, батьки або опікун мають знати, що ти тут. ти можеш продовжити — але
              подумай, чи є поруч дорослий, якому ти довіряєш.
            </p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm">
        <button
          onClick={handleAgeNext}
          disabled={!selected}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-sans text-base font-medium transition-all',
            selected ? 'bg-accent text-ink active:opacity-80' : 'bg-divider text-inkSoft',
          )}
        >
          далі
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>
    </main>
  );
}

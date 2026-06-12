'use client';

import { useState } from 'react';

const STEPS = [
  { count: 5, sense: 'побач', prompt: 'речей, які ти зараз бачиш' },
  { count: 4, sense: 'торкнись', prompt: 'речі, яких ти можеш торкнутись' },
  { count: 3, sense: 'почуй', prompt: 'звуки, які ти чуєш' },
  { count: 2, sense: 'відчуй', prompt: 'запахи навколо' },
  { count: 1, sense: 'спробуй', prompt: 'смак, який відчуваєш' },
] as const;

// Стани машини кроків, деривовані від кількості кроків (не magic-числа):
// 0 = не почато · 1..STEPS.length = кроки · FEEDBACK_STEP = фідбек · DONE_STEP = завершено
const FEEDBACK_STEP = STEPS.length + 1;
const DONE_STEP = STEPS.length + 2;

export function GroundingMinute() {
  const [step, setStep] = useState<number>(0);
  const [feedback, setFeedback] = useState<'helped' | 'neutral' | null>(null);

  function start() {
    setStep(1);
  }

  function next() {
    setStep((s) => (s < STEPS.length ? s + 1 : FEEDBACK_STEP));
  }

  async function handleFeedback(value: 'helped' | 'neutral') {
    setFeedback(value);
    setStep(DONE_STEP);
    await fetch('/api/exercise-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: value }),
    }).catch(() => {
      /* silent */
    });
  }

  const currentStep = step >= 1 && step <= STEPS.length ? STEPS[step - 1] : null;
  const isActive = step >= 1 && step <= STEPS.length;
  const showFeedback = step === FEEDBACK_STEP;
  const isDone = step === DONE_STEP;

  return (
    <div className="rounded-2xl border border-divider bg-bgSoft px-4 py-4">
      <p className="font-mono text-xs uppercase tracking-wider text-accent">хвилина тут</p>

      {step === 0 && (
        <>
          <p className="mt-2 font-serif text-xl italic text-ink">Озирнись. Це займе хвилину.</p>
          <p className="mt-1 font-sans text-xs leading-relaxed text-inkSoft">
            П&apos;ять чуттів — крок за кроком. Без реєстрації.
          </p>
          <button
            onClick={start}
            className="mt-4 rounded-2xl bg-accent px-4 py-2 font-sans text-sm font-medium text-white transition-opacity active:opacity-80"
          >
            почати →
          </button>
        </>
      )}

      {isActive && currentStep && (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-4xl italic text-ink">{currentStep.count}</span>
            <span className="font-sans text-base text-inkSoft">{currentStep.sense}</span>
          </div>
          <p className="mt-1 font-sans text-sm leading-relaxed text-inkSoft">
            {currentStep.count} {currentStep.prompt}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < step ? 'bg-accent' : 'bg-divider'
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="mt-4 rounded-2xl border border-divider bg-bg px-4 py-2 font-sans text-sm text-ink transition-colors hover:border-accent/40 active:opacity-80"
          >
            {step < STEPS.length ? 'далі →' : 'готово →'}
          </button>
        </>
      )}

      {showFeedback && (
        <>
          <p className="mt-3 font-sans text-sm text-ink">Як тобі?</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => handleFeedback('helped')}
              className="flex-1 rounded-2xl border border-divider bg-bg py-2 font-sans text-sm text-ink transition-colors hover:border-ok/60 active:opacity-80"
            >
              трохи краще
            </button>
            <button
              onClick={() => handleFeedback('neutral')}
              className="flex-1 rounded-2xl border border-divider bg-bg py-2 font-sans text-sm text-inkSoft transition-colors hover:border-divider active:opacity-80"
            >
              так само
            </button>
          </div>
        </>
      )}

      {isDone && (
        <p className="mt-3 font-sans text-sm text-inkSoft">
          {feedback === 'helped' ? 'добре.' : 'окей. ти тут — вже важливо.'}
        </p>
      )}
    </div>
  );
}

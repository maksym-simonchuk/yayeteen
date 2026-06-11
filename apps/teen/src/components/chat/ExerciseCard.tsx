'use client';

import { useState } from 'react';
import { getExercise } from '@ya-ye/method/exercises';
import { EXERCISE_PREFIXES, PREFIX_TO_EXERCISE } from '@/lib/exercisePrefixes';

interface ExerciseCardProps {
  text: string;
}

export function ExerciseCard({ text }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.slice(1, -1).split(' · ');
  const title = lines[0] ?? text;
  const subtitle = lines.slice(1).join(' · ');

  const prefix = EXERCISE_PREFIXES.find((p) => text.startsWith(p));
  const exerciseId = prefix ? PREFIX_TO_EXERCISE[prefix] : undefined;
  const exercise = exerciseId ? getExercise(exerciseId) : null;

  return (
    <div className="my-1 rounded-2xl border border-divider bg-bgSoft px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-wider text-inkSoft">{title}</p>
      {subtitle && <p className="mt-0.5 font-sans text-sm text-ink">{subtitle}</p>}
      {exercise?.steps && expanded && (
        <ol className="mt-3 space-y-2">
          {exercise.steps.map((step, i) => (
            <li key={i} className="flex gap-2 font-sans text-sm text-ink">
              <span className="font-mono text-xs text-inkSoft">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {exercise?.steps && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 font-mono text-xs text-accent transition-opacity active:opacity-80"
        >
          {expanded ? 'згорнути' : exercise.ui_card.cta}
        </button>
      )}
    </div>
  );
}

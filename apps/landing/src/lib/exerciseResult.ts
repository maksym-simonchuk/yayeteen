/** Дозволені результати вправи (POST /api/exercise-feedback). */
export type ExerciseResult = 'helped' | 'neutral';

/**
 * Валідує тіло запиту feedback. Невалідне тіло → null — без cast на untrusted
 * input, без throw. Звужує до літералу через рівність (жодного `as`).
 */
export function parseExerciseResult(raw: unknown): ExerciseResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const result = (raw as Record<string, unknown>).result;
  return result === 'helped' || result === 'neutral' ? result : null;
}

import type { ExerciseId } from '@ya-ye/method/exercises';

export const EXERCISE_PREFIXES = ['[ВПРАВА', '[ЗАЗЕМЛЕННЯ', '[ТІЛО', '[RAIN', '[КОМПАС', '[ЯКІР'];

// Маркер промта → id вправи у whitelist (exercises/exercises-whitelist.json)
export const PREFIX_TO_EXERCISE: Record<string, ExerciseId> = {
  '[ВПРАВА': 'breathing-4-6',
  '[ЗАЗЕМЛЕННЯ': 'grounding-54321',
  '[ТІЛО': 'body-scan-short',
  '[RAIN': 'rain',
  '[КОМПАС': 'values-compass',
  '[ЯКІР': 'meaning-anchor',
};

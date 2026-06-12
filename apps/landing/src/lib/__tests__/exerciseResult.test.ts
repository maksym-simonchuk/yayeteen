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

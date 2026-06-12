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

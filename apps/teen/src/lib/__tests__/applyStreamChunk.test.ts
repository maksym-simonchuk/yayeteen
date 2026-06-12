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

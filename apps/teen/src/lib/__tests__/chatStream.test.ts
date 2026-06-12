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

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

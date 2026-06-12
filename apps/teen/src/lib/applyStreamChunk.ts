import {
  parseModeLabel,
  stripModeLabel,
  stripModeRedirect,
  hasModeRedirect,
} from '@/lib/parseModeLabel';

export interface StreamChunkResult {
  bubbles: string[];
  hasModeRedirect: boolean;
  modeLabel: string;
}

/**
 * Чистий розрахунок наступного стану assistant-бабла зі стрім-чанку.
 * Бере поточні баблі + прапор редиректу + новий текст, повертає нові баблі,
 * залатчений прапор [MODE:4] і витягнутий mode-лейбл. Без побічних ефектів.
 */
export function applyStreamChunk(
  prevBubbles: string[],
  prevHasRedirect: boolean,
  chunk: string,
): StreamChunkResult {
  const rawWithMarker = prevBubbles.join('\n\n') + chunk;
  const modeLabel = parseModeLabel(rawWithMarker);
  const raw = stripModeRedirect(stripModeLabel(rawWithMarker));
  return {
    bubbles: raw.split('\n\n').filter(Boolean),
    hasModeRedirect: prevHasRedirect || hasModeRedirect(rawWithMarker),
    modeLabel,
  };
}

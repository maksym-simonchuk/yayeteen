// matchScenario — fuzzy-пошук сценарію за текстом повідомлення.
// Підхід: нормалізація тексту + substring match по triggerKeywords.
// Phase 2: можна замінити на векторний пошук або класифікатор.

import { SCENARIOS, type Scenario } from './scenarios';

/** Повертає triggerKeywords усіх сценаріїв заданої FM, згрупованих по id. */
export function keywordsByFm(fm: 1 | 2 | 3 | 4): Record<string, readonly string[]> {
  return Object.fromEntries(
    SCENARIOS.filter((s) => s.fm === fm).map((s) => [s.id, s.triggerKeywords]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Нормалізація: нижній регістр, зайві пробіли геть */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Знаходить перший сценарій, хоча б одне ключове слово якого
 * міститься у повідомленні користувача.
 *
 * Повертає `null`, якщо жоден сценарій не підійшов.
 */
export function matchScenario(userMessage: string): Scenario | null {
  const text = normalize(userMessage);

  for (const scenario of SCENARIOS) {
    for (const keyword of scenario.triggerKeywords) {
      if (text.includes(normalize(keyword))) {
        return scenario;
      }
    }
  }

  return null;
}

/**
 * Повертає всі сценарії, що хоча б частково матчать повідомлення.
 * Корисно для налагодження і тестів.
 */
export function matchAllScenarios(userMessage: string): Scenario[] {
  const text = normalize(userMessage);

  return SCENARIOS.filter((scenario) =>
    scenario.triggerKeywords.some((kw) => text.includes(normalize(kw))),
  );
}

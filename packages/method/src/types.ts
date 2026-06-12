// Канонічний дім доменних типів методології: Mode, FM, Scenario.
// system-prompt.ts і scenarios.ts реекспортять їх звідси (shim сумісності).
// CrisisSeverity — єдине джерело в ../crisis-detector.ts.
export type Mode = 1 | 2 | 3 | 4;
export type FM = 1 | 2 | 3 | 4;
export type { CrisisSeverity } from '../crisis-detector';

export interface Scenario {
  id: string;
  title: string; // внутрішня назва (не показується користувачу)
  fm: 1 | 2 | 3 | 4; // Фундаментальна Мотивація
  mode: 1 | 2 | 3 | 4; // режим розмови
  triggerKeywords: string[]; // ключові слова для matchScenario
  openingPrompt: string; // перше повідомлення AI (українською)
  systemContext: string; // додатковий контекст для системного промту (англійська)
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  mode?: Mode;
  fm_detected?: FM;
  principle_applied?: string;
}

export interface ModeDetection {
  mode: Mode;
  fm: FM;
  confidence: number;
  triggers: string[];
}

export interface Hotline {
  name: string;
  number: string;
  note: string;
  channel: 'phone' | 'chat';
}

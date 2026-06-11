// Канонічні типи Mode/FM і SessionContext живуть у
// ../system-prompt.ts (runtime-версія, яку використовує route.ts).
// CrisisSeverity — єдине джерело в ../crisis-detector.ts.
// Тут — лише типи, що не мають канонічного джерела.
export type { Mode, FM } from '../system-prompt';
export type { CrisisSeverity } from '../crisis-detector';

import type { Mode, FM } from '../system-prompt';

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

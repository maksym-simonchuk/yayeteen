// ============================================================
// Backward-compatible доменні аліаси — контракт index.ts.
// Живуть ОКРЕМО від types.ts, бо types.ts — чистий артефакт
// `supabase gen types typescript --local > packages/db/src/types.ts`
// і перезаписується повністю при кожній регенерації (S2 gate:
// scripts/check-db-types.sh порівняє його з БД байт-в-байт).
// ============================================================

export type { AgeBand } from '@ya-ye/contracts';
export type { Jurisdiction } from '@ya-ye/method';
export type { CrisisSeverity } from '@ya-ye/method';
export type SessionEndReason = 'time_up' | 'user_closed' | 'crisis_handoff' | 'therapist_handoff';
export type ReferralStatus = 'new' | 'accepted' | 'declined' | 'completed' | 'no_show';
export type ReferralUrgency = 'normal' | 'urgent';
export type ConsentType = 'share_summary' | 'share_profile' | 'crisis_handoff';
export type MessageRole = 'user' | 'assistant';

export interface ProposedSlot {
  datetime: string;
  duration_min: number;
  free: boolean;
}

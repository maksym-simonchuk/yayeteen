export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  bubbles: string[];
  isStreaming?: boolean;
  hasModeRedirect?: boolean; // true якщо AI емітив [MODE:4] — UI рендерить SpecialistRedirectInline під реплікою
  postCrisisExercise?: boolean; // true для пост-кризового повідомлення з пропозицією вправи
}

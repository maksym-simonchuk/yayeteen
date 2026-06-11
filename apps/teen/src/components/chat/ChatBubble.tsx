import { cn } from '@ya-ye/ui';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function ChatBubble({ role, content, isStreaming }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] space-y-1',
          isUser ? 'items-end' : 'items-start',
          'flex flex-col',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser ? 'bg-accent text-white' : 'bg-bgSoft text-ink',
          )}
        >
          {/* AI-репліки — малі літери, за дизайном */}
          <p className={cn('font-sans text-base leading-relaxed', !isUser && 'lowercase')}>
            {content}
            {isStreaming && (
              <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-current opacity-70" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

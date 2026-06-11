import { Phone, MessageSquare } from 'lucide-react';
import type { Hotline } from '@ya-ye/method';
import { cn } from '@ya-ye/ui';
import { hotlineHref } from '@/lib/hotlineHref';

interface HotlineRowProps {
  hotline: Hotline;
}

export function HotlineRow({ hotline }: HotlineRowProps) {
  const isChat = hotline.channel === 'chat';

  return (
    <a
      href={hotlineHref(hotline)}
      className="flex items-center gap-4 rounded-2xl border border-divider bg-bgSoft px-4 py-3.5 transition-colors hover:border-crisis/30 hover:bg-crisisSoft/30 active:opacity-80"
    >
      <div className={cn('rounded-xl p-2', isChat ? 'bg-accent/10' : 'bg-crisisSoft')}>
        {isChat ? (
          <MessageSquare size={18} strokeWidth={1.5} className="text-accent" />
        ) : (
          <Phone size={18} strokeWidth={1.5} className="text-crisis" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm text-ink">{hotline.name}</p>
        <p className="font-mono text-xs text-inkSoft">{hotline.note}</p>
      </div>
      <span className="font-mono text-base font-medium text-crisis whitespace-nowrap">
        {hotline.number}
      </span>
    </a>
  );
}

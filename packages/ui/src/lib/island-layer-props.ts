import type { MouseEventHandler, KeyboardEventHandler } from 'react';

interface LayerHandlers {
  onEnter: (fm: 1 | 2 | 3 | 4) => void;
  onLeave: () => void;
  onTap: (fm: 1 | 2 | 3 | 4) => void;
}

interface LayerStyleProps {
  style: {
    cursor: 'pointer' | undefined;
    opacity: number;
    transition: string;
  };
  onMouseEnter: MouseEventHandler<SVGGElement>;
  onMouseLeave: MouseEventHandler<SVGGElement>;
  onClick: MouseEventHandler<SVGGElement>;
  tabIndex?: number;
  role?: 'button';
  onKeyDown?: KeyboardEventHandler<SVGGElement>;
}

// Повертає style+event пропси для інтерактивного шару острова.
// Винесено з Island.tsx — компонентний файл не може містити хелпери.
// interactive=true → шар operable з клавіатури (WCAG 2.1.1): Enter/Space → onTap.
export function layerProps(
  fm: 1 | 2 | 3 | 4,
  activeFm: 1 | 2 | 3 | 4 | null,
  interactive: boolean,
  handlers: LayerHandlers,
): LayerStyleProps {
  const base: LayerStyleProps = {
    style: {
      cursor: interactive ? 'pointer' : undefined,
      opacity: activeFm && activeFm !== fm ? 0.55 : 1,
      transition: 'opacity 200ms ease',
    },
    onMouseEnter: () => handlers.onEnter(fm),
    onMouseLeave: () => handlers.onLeave(),
    onClick: () => handlers.onTap(fm),
  };
  if (!interactive) return base;
  return {
    ...base,
    tabIndex: 0,
    role: 'button',
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlers.onTap(fm);
      }
    },
  };
}

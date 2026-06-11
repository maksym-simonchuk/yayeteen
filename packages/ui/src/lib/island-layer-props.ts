import type { MouseEventHandler } from 'react';

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
}

// Повертає style+event пропси для інтерактивного шару острова.
// Винесено з Island.tsx — компонентний файл не може містити хелпери.
export function layerProps(
  fm: 1 | 2 | 3 | 4,
  activeFm: 1 | 2 | 3 | 4 | null,
  interactive: boolean,
  handlers: LayerHandlers,
): LayerStyleProps {
  return {
    style: {
      cursor: interactive ? 'pointer' : undefined,
      opacity: activeFm && activeFm !== fm ? 0.55 : 1,
      transition: 'opacity 200ms ease',
    },
    onMouseEnter: () => handlers.onEnter(fm),
    onMouseLeave: () => handlers.onLeave(),
    onClick: () => handlers.onTap(fm),
  };
}

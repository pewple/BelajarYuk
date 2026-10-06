import { useEffect } from 'react';

export type Direction = { row: number; col: number };

const KEYS: Record<string, Direction> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

/**
 * The four arrow keys, for games laid out on a grid.
 *
 * A toddler on a laptop finds the arrow keys long before they can aim a
 * trackpad, and a grown-up beside them can play along. `preventDefault` stops
 * the page scrolling under the game while the keys are in use.
 */
export function useDirectionKeys(onMove: (direction: Direction) => void): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const direction = KEYS[event.key];
      if (!direction) return;

      event.preventDefault();
      onMove(direction);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onMove]);
}

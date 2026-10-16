import { useEffect } from 'react';

/** Keys the lessons listen for. While a dialog is up they must not reach the game underneath. */
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar']);

/**
 * Keeps the arrow keys and space from steering the lesson behind a dialog.
 *
 * Listens in the capture phase and stops the event there, so the lesson's own
 * window listeners never see it. Enter, Tab, digits and Escape still work, as
 * does space on a focused button - that one is a `click`, not a keydown the
 * lesson cares about.
 */
export function useSwallowGameKeys(active = true): void {
  useEffect(() => {
    if (!active) return;
    const swallow = (event: KeyboardEvent) => {
      if (GAME_KEYS.has(event.key)) event.stopPropagation();
    };
    window.addEventListener('keydown', swallow, true);
    return () => window.removeEventListener('keydown', swallow, true);
  }, [active]);
}

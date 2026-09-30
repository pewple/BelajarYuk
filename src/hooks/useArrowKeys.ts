import { useEffect } from 'react';

type ArrowKeyHandlers = {
  onPrev: () => void;
  onNext: () => void;
  /** Optional: Space/Enter when no control is focused. */
  onActivate?: () => void;
};

/**
 * Left/right arrow keys drive the lesson carousels.
 *
 * Useful well beyond accessibility here: a toddler on a laptop finds the two
 * big arrow keys long before they can aim a trackpad, and a grown-up sitting
 * alongside can advance the card without reaching across the screen.
 */
export function useArrowKeys({ onPrev, onNext, onActivate }: ArrowKeyHandlers): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Leave browser and OS shortcuts alone.
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          onPrev();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onNext();
          break;
        case ' ':
        case 'Enter': {
          if (!onActivate) break;
          // A focused button already handles Space/Enter natively; stepping
          // in here too would fire the action twice.
          const active = document.activeElement;
          const onControl =
            active instanceof HTMLElement &&
            (active.tagName === 'BUTTON' ||
              active.tagName === 'INPUT' ||
              active.tagName === 'TEXTAREA' ||
              active.isContentEditable);
          if (onControl) break;
          event.preventDefault();
          onActivate();
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPrev, onNext, onActivate]);
}

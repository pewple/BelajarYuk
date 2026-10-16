import { useCallback, useEffect, useRef, useState } from 'react';
import { REST_GRACE_MS, SESSION_LIMIT_MS } from '../data/session';

/**
 * A gentle nudge to stop, after a quarter of an hour of play.
 *
 * Only time the page is actually in view counts - a phone left in a pocket is
 * not a child at the screen. When the limit is reached the rest screen does
 * not cut in mid-tap: it waits for a natural pause (`notePause`: a finished
 * round, or arriving at the menu) and only after `REST_GRACE_MS` more does it
 * come regardless.
 *
 * It is a nudge, not a lock. Dismissing it starts a fresh quarter hour.
 */
export function useRestBreak(tickMs = 1000): {
  /** The limit has been reached (the rest screen may still be waiting for a pause). */
  due: boolean;
  /** Show the rest screen now. */
  resting: boolean;
  /** A natural pause: if a rest is due, take it. */
  notePause: () => void;
  /** Rest over - or at least acknowledged. Starts the clock again. */
  dismiss: () => void;
} {
  const [due, setDue] = useState(false);
  const [resting, setResting] = useState(false);

  // Kept in refs: they change every tick and nothing renders from them.
  const played = useRef(0);
  const waited = useRef(0);
  const dueRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;

      if (!dueRef.current) {
        played.current += tickMs;
        if (played.current >= SESSION_LIMIT_MS) {
          dueRef.current = true;
          setDue(true);
        }
        return;
      }

      waited.current += tickMs;
      if (waited.current >= REST_GRACE_MS) setResting(true);
    }, tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  const notePause = useCallback(() => {
    if (dueRef.current) setResting(true);
  }, []);

  const dismiss = useCallback(() => {
    played.current = 0;
    waited.current = 0;
    dueRef.current = false;
    setDue(false);
    setResting(false);
  }, []);

  return { due, resting, notePause, dismiss };
}

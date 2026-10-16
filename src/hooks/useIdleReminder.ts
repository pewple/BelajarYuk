import { useEffect, useRef } from 'react';
import { IDLE_REMINDER_MS } from '../data/session';

/**
 * Says the instruction again - once - if the child has gone quiet.
 *
 * A three-year-old who stops tapping is usually stuck or distracted, and a
 * single reminder helps with both. One only: repeating every few seconds would
 * turn a helpful voice into nagging. Any touch or key press re-arms it, so a
 * child who is playing never hears it.
 *
 * `key` identifies the round; a new round starts the wait afresh.
 */
export function useIdleReminder(active: boolean, key: unknown, remind: () => void): void {
  const remindRef = useRef(remind);
  useEffect(() => {
    remindRef.current = remind;
  }, [remind]);

  useEffect(() => {
    if (!active) return;

    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        remindRef.current();
        // Said once. Wait for the next touch before arming again.
        timer = 0;
      }, IDLE_REMINDER_MS);
    };

    const events = ['pointerdown', 'keydown'] as const;
    const onActivity = () => arm();
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    arm();

    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, onActivity));
    };
  }, [active, key]);
}

import { useCallback, useEffect, useState } from 'react';

/**
 * A value that goes back to rest by itself: the glow on the right answer after
 * a wrong tap, the wiggle of the wrong tile.
 *
 * Set it to anything but `rest` and, `ms` later, it is `rest` again. Setting it
 * to something new before then starts the wait afresh.
 */
export function useFlash<T>(rest: T, ms: number): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(rest);

  useEffect(() => {
    if (value === rest) return;
    const id = window.setTimeout(() => setValue(rest), ms);
    return () => window.clearTimeout(id);
  }, [value, rest, ms]);

  const set = useCallback((next: T) => setValue(next), []);
  return [value, set];
}

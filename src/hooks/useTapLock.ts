import { useCallback, useRef } from 'react';

/**
 * How long a control ignores being tapped again. A toddler's "one tap" is
 * often a double: two touches a fifth of a second apart. That is long enough to
 * skip two rounds with the "Lanjut" button or hand over the same coin twice.
 * A tap that is truly meant to repeat comes slower than this.
 */
const DEFAULT_LOCK_MS = 350;

let lockMs = DEFAULT_LOCK_MS;

/** Tests set this to 0 so a run of quick taps is not mistaken for a stutter. */
export function setTapLockMs(ms: number): void {
  lockMs = ms;
}

export function resetTapLockMs(): void {
  lockMs = DEFAULT_LOCK_MS;
}

/**
 * Returns `once(key, action)`: runs `action` unless the same `key` ran a moment
 * ago. Different keys never block each other - tapping two different tiles in
 * quick succession is fine; tapping *one* tile twice is the slip being caught.
 */
export function useTapLock(): (key: string, action: () => void) => void {
  const lastRun = useRef(new Map<string, number>());

  return useCallback((key, action) => {
    const now = Date.now();
    const previous = lastRun.current.get(key);
    if (previous !== undefined && now - previous < lockMs) return;
    lastRun.current.set(key, now);
    action();
  }, []);
}

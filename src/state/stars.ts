import { useSyncExternalStore } from 'react';

/**
 * Bintang - the star the child earns for every right answer, in any module.
 *
 * One wallet for the whole app, kept on this device only (like the hint levels
 * and the review book). Stars are spent in Kuda on food and colours for the
 * pony. `earned` only ever goes up, so a grown-up can see how many right
 * answers there have been in all, whatever has been spent since.
 *
 * Storage can throw (private mode, blocked site data). The wallet still works
 * for the visit; it just starts from nothing next time.
 */
export const STARS_STORAGE_KEY = 'belajar-yuk:bintang';

export type Wallet = {
  /** Stars to spend now. */
  stars: number;
  /** Every star ever earned on this device. */
  earned: number;
};

const EMPTY: Wallet = { stars: 0, earned: 0 };

const wholeCount = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;

function load(): Wallet {
  try {
    const raw = window.localStorage.getItem(STARS_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Wallet>;
    const stars = wholeCount(parsed.stars);
    return { stars, earned: Math.max(stars, wholeCount(parsed.earned)) };
  } catch {
    return EMPTY;
  }
}

let wallet: Wallet | null = null;
const listeners = new Set<() => void>();

function current(): Wallet {
  wallet ??= load();
  return wallet;
}

function commit(next: Wallet): void {
  wallet = next;
  try {
    window.localStorage.setItem(STARS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* A lost star is not worth breaking the game over. */
  }
  listeners.forEach((listener) => listener());
}

export function getWallet(): Wallet {
  return current();
}

/** A right answer: one more star (or `n`). */
export function earnStars(n = 1): void {
  const count = wholeCount(n);
  if (count === 0) return;
  const { stars, earned } = current();
  commit({ stars: stars + count, earned: earned + count });
}

/** Pays `price` if there are enough stars. False, and nothing spent, if not. */
export function spendStars(price: number): boolean {
  const cost = wholeCount(price);
  const now = current();
  if (now.stars < cost) return false;
  if (cost > 0) commit({ ...now, stars: now.stars - cost });
  return true;
}

/** Forget the in-memory copy so the next read comes from storage again. For tests. */
export function reloadWallet(): void {
  wallet = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The wallet, kept up to date. */
export function useWallet(): Wallet {
  return useSyncExternalStore(subscribe, current, current);
}

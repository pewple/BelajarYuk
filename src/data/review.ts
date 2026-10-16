/**
 * Spaced review: what a child fumbled comes back, at growing gaps.
 *
 * Every item (a letter, a number, a customer's change) is tracked in a small
 * Leitner ladder. A miss drops it to the bottom and makes it due at once. A
 * right answer moves it up a rung and pushes its next appearance further out:
 * ten minutes, a day, three days. Only items that have been missed *and are
 * not yet secure* count as weak; things the child has never got wrong are left
 * alone, so there is nothing to nag about.
 *
 * Everything is stored in this browser's localStorage. Nothing leaves the
 * device, and there are no accounts - on purpose: it is a child's learning
 * record.
 */

export type ReviewEntry = {
  /** Rung of the ladder: 0 right after a miss, up to MAX_BOX. */
  box: number;
  /** When it is next worth showing again (ms since the epoch). */
  due: number;
  /** How many times it was got wrong, ever. */
  misses: number;
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** How long to wait after landing on each rung. Rung 0 is "right away". */
export const BOX_WAITS = [0, 10 * MINUTE, 1 * DAY, 3 * DAY, 7 * DAY] as const;

export const MAX_BOX = BOX_WAITS.length - 1;

/** From this rung up, an item has been got right often enough to call it learned. */
export const SECURE_BOX = 3;

export const REVIEW_STORAGE_KEY = 'belajar-yuk:review';

export type ReviewBook = Record<string, ReviewEntry>;

function isEntry(value: unknown): value is ReviewEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.box === 'number' && typeof v.due === 'number' && typeof v.misses === 'number';
}

export function loadReview(): ReviewBook {
  try {
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => isEntry(entry)));
  } catch {
    return {};
  }
}

function saveReview(book: ReviewBook): void {
  try {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(book));
  } catch {
    /* A lost review book only means the child starts from a clean page. */
  }
}

/**
 * Note one answer. `now` is injectable so the ladder can be tested without
 * waiting a day.
 *
 * A right answer for something never missed is not recorded at all - there is
 * nothing to review, and the book would only grow.
 */
export function recordResult(key: string, correct: boolean, now: number = Date.now()): void {
  const book = loadReview();
  const entry = book[key];

  if (!correct) {
    book[key] = { box: 0, due: now, misses: (entry?.misses ?? 0) + 1 };
  } else if (entry) {
    const box = Math.min(entry.box + 1, MAX_BOX);
    book[key] = { ...entry, box, due: now + BOX_WAITS[box] };
  } else {
    return;
  }

  saveReview(book);
}

/**
 * Keys under `prefix` that are worth bringing back now: missed before, not yet
 * secure, and past their due time. Most overdue first.
 */
export function dueForReview(prefix: string, now: number = Date.now()): string[] {
  const book = loadReview();
  return Object.entries(book)
    .filter(([key, e]) => key.startsWith(prefix) && e.misses > 0 && e.box < SECURE_BOX && e.due <= now)
    .sort(([, a], [, b]) => a.due - b.due)
    .map(([key]) => key);
}

/* ------------------------------------------------------------------ */
/* Keys                                                                */
/* ------------------------------------------------------------------ */

/**
 * The key for a letter or number in the maze. The script is part of it: a
 * child who knows "3" may not yet know "٣".
 */
export function mazeItemKey(kind: 'letters' | 'numbers', script: string, value: number): string {
  return `maze:${kind}:${script}:${value}`;
}

export function mazeItemPrefix(kind: 'letters' | 'numbers', script: string): string {
  return `maze:${kind}:${script}:`;
}

/** The key for a customer at the till. */
export function kasirItemKey(item: string): string {
  return `kasir:${item}`;
}

export const KASIR_PREFIX = 'kasir:';

/** The key for a pattern level. */
export function polaItemKey(levelId: string): string {
  return 'pola:' + levelId;
}

export const POLA_PREFIX = 'pola:';

/** Every this-many rounds, one of the ones the child fumbled comes round again. */
export const REVIEW_EVERY = 3;

/**
 * Which of `count` things in a fixed order comes next.
 *
 * Things come in their fixed order; `sequential` is the place reached in it
 * and only moves when the order itself is followed. Every REVIEW_EVERY-th round
 * is instead the first thing `isWeak` picks out (if any), and that detour does
 * not lose the place in the order.
 */
export function reviewOrder(
  count: number,
  sequential: number,
  round: number,
  isWeak: (index: number) => boolean,
): { index: number; sequential: number } {
  if (round % REVIEW_EVERY === REVIEW_EVERY - 1) {
    for (let index = 0; index < count; index += 1) {
      if (isWeak(index)) return { index, sequential };
    }
  }
  const next = (sequential + 1) % count;
  return { index: next, sequential: next };
}

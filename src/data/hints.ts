/**
 * Fading hints: help while it is needed, then step back.
 *
 * A child who is new to a game gets the answer pointed out. Once they have
 * shown they can do it - a few right choices in a row - the pointing stops and
 * they work it out for themselves. If they then struggle, it comes back. The
 * level is remembered per game, on this device only.
 *
 * This is the "prompt fading" of errorless-learning teaching: the support
 * leaves at the child's pace, not on a schedule.
 */

export type HintLevel = 'guided' | 'independent';

export type HintState = {
  level: HintLevel;
  /**
   * Guided: right choices in a row. Independent: wrong choices in a row.
   * The streak that matters for the next change of level, and nothing else.
   */
  streak: number;
};

/** Right choices in a row, with help, before the help is taken away. */
export const FADE_AFTER = 3;

/** Wrong choices in a row, without help, before it comes back. */
export const RETURN_AFTER = 2;

export const NEW_HINT_STATE: HintState = { level: 'guided', streak: 0 };

/** The state after one more choice. Pure, so the rule can be tested on its own. */
export function nextHintState(state: HintState, correct: boolean): HintState {
  if (state.level === 'guided') {
    if (!correct) return { level: 'guided', streak: 0 };
    const streak = state.streak + 1;
    return streak >= FADE_AFTER ? { level: 'independent', streak: 0 } : { level: 'guided', streak };
  }

  if (correct) return { level: 'independent', streak: 0 };
  const streak = state.streak + 1;
  return streak >= RETURN_AFTER ? { level: 'guided', streak: 0 } : { level: 'independent', streak };
}

/* ------------------------------------------------------------------ */
/* Remembering                                                         */
/* ------------------------------------------------------------------ */

export const HINTS_STORAGE_KEY = 'belajar-yuk:hints';

/** The games that have hints. */
export type HintedGame = 'labirin' | 'kasir' | 'pola' | 'memori' | 'menulis';

type Stored = Partial<Record<HintedGame, HintState>>;

function readAll(): Stored {
  try {
    const raw = window.localStorage.getItem(HINTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function isState(value: unknown): value is HintState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.level === 'guided' || v.level === 'independent') && typeof v.streak === 'number';
}

export function loadHintState(game: HintedGame): HintState {
  const saved = readAll()[game];
  return isState(saved) ? saved : NEW_HINT_STATE;
}

export function saveHintState(game: HintedGame, state: HintState): void {
  try {
    window.localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ ...readAll(), [game]: state }));
  } catch {
    /* Forgetting the level only means starting guided again. */
  }
}

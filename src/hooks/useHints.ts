import { useCallback, useRef, useState } from 'react';
import { loadHintState, nextHintState, saveHintState } from '../data/hints';
import type { HintedGame } from '../data/hints';
import { usePlay } from '../state/play';

/**
 * Whether this game is currently pointing out the answer, and a way to tell it
 * how the last choice went. See `data/hints.ts` for the rule.
 *
 * The same choice is passed on to the play count, which lets go of the home
 * button for a child who gets three in a row wrong. A game whose choices are
 * only steps towards an answer (Kasir: one piece among several) says so with
 * `countsTowardLeaving: false` and reports how each whole attempt went itself.
 */
export function useHints(game: HintedGame): {
  /** True while the child still gets the answer pointed out. */
  guided: boolean;
  /** One choice was made: right or wrong. */
  record: (correct: boolean, countsTowardLeaving?: boolean) => void;
} {
  const { reportAttempt } = usePlay();
  const [state, setState] = useState(() => loadHintState(game));
  // The latest state, so two choices in the same tick cannot both start from the old one.
  const latest = useRef(state);

  const record = useCallback(
    (correct: boolean, countsTowardLeaving = true) => {
      latest.current = nextHintState(latest.current, correct);
      setState(latest.current);
      saveHintState(game, latest.current);
      if (countsTowardLeaving) reportAttempt(correct);
    },
    [game, reportAttempt],
  );

  return { guided: state.level === 'guided', record };
}

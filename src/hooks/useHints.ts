import { useCallback, useRef, useState } from 'react';
import { loadHintState, nextHintState, saveHintState } from '../data/hints';
import type { HintedGame } from '../data/hints';

/**
 * Whether this game is currently pointing out the answer, and a way to tell it
 * how the last choice went. See `data/hints.ts` for the rule.
 */
export function useHints(game: HintedGame): {
  /** True while the child still gets the answer pointed out. */
  guided: boolean;
  /** One choice was made: right or wrong. */
  record: (correct: boolean) => void;
} {
  const [state, setState] = useState(() => loadHintState(game));
  // The latest state, so two choices in the same tick cannot both start from the old one.
  const latest = useRef(state);

  const record = useCallback(
    (correct: boolean) => {
      latest.current = nextHintState(latest.current, correct);
      setState(latest.current);
      saveHintState(game, latest.current);
    },
    [game],
  );

  return { guided: state.level === 'guided', record };
}

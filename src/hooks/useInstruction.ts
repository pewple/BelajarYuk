import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { KNOWS_THE_DRILL_AFTER } from '../data/session';
import { usePlay } from '../state/play';
import { useIdleReminder } from './useIdleReminder';

/**
 * Whether the child has finished enough games in this visit to know the drill.
 *
 * A ref, not state, on purpose: finishing the third game flips it, and that
 * must not itself make a screen announce anything again.
 */
export function useKnowsTheDrill(): RefObject<boolean> {
  const { gamesDone } = usePlay();
  const knows = useRef(false);

  useEffect(() => {
    knows.current = gamesDone >= KNOWS_THE_DRILL_AFTER;
  }, [gamesDone]);

  return knows;
}

type InstructionOptions = {
  /**
   * What makes the reminder start its wait again. Defaults to `key`; give a
   * different one when the reminder should follow something finer than what
   * triggers the first announcement (a new card, say, in a deck of them).
   */
  idleKey?: unknown;
  /** True while the instruction should be kept as quiet as the child can bear. */
  quiet?: () => boolean;
  /** False when nothing is left to do, so there is nothing to remind about. */
  active?: boolean;
  /** What to say when the child goes quiet, if that should differ from the first time. */
  remind?: () => void;
};

/**
 * Says what to do, once when `key` changes and once more if the child goes quiet.
 *
 * Every game opens a round with a spoken instruction, because a pre-reader
 * cannot read one: say it when the round starts, unless the child already
 * knows the drill (`quiet`), and say it again - once - after fifteen quiet
 * seconds. `say` is read when it is needed, so it may change between renders
 * without re-announcing; only `key` does that.
 */
export function useInstruction(say: () => void, key: unknown, options: InstructionOptions = {}): void {
  const { idleKey = key, quiet, active = true, remind } = options;

  const sayRef = useRef(say);
  const quietRef = useRef(quiet);
  useEffect(() => {
    sayRef.current = say;
    quietRef.current = quiet;
  });

  useEffect(() => {
    if (!quietRef.current?.()) sayRef.current();
  }, [key]);

  useIdleReminder(active, idleKey, remind ?? say);
}

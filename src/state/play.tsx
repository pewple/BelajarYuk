import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { UNLOCK_AFTER_GAMES } from '../data/session';

/**
 * How much has been played in the module the child is in right now.
 *
 * Screens report each finished game; the shared screen frame reads the count
 * to decide whether the home button is still gated. The count belongs to one
 * visit - it starts again from nothing whenever the module changes - so
 * "five games" always means five games *here*, not five over a whole afternoon.
 *
 * With no provider (a screen rendered on its own) nothing is gated and
 * nothing is counted.
 */
export type PlayState = {
  /** Games finished in this visit. */
  gamesDone: number;
  /** True once enough games are done for the home button to work freely. */
  homeUnlocked: boolean;
  /**
   * A game was finished. Give an `id` when the same game could be reported
   * twice - the same card heard again - and it will only count once.
   */
  reportGame: (id?: string) => void;
};

const OUTSIDE_A_PROVIDER: PlayState = {
  gamesDone: 0,
  homeUnlocked: true,
  reportGame: () => {},
};

const PlayContext = createContext<PlayState>(OUTSIDE_A_PROVIDER);

export function usePlay(): PlayState {
  return useContext(PlayContext);
}

type PlayProviderProps = {
  /** Changes when the child moves to another module; that starts a fresh count. */
  resetKey: string;
  /** Called for every counted game, e.g. so the session can take a pause. */
  onGame?: () => void;
  children: ReactNode;
};

export function PlayProvider({ resetKey, onGame, children }: PlayProviderProps) {
  const [counted, setCounted] = useState({ key: resetKey, count: 0 });
  const seen = useRef({ key: resetKey, ids: new Set<string>() });

  const gamesDone = counted.key === resetKey ? counted.count : 0;

  const reportGame = useCallback(
    (id?: string) => {
      if (seen.current.key !== resetKey) seen.current = { key: resetKey, ids: new Set() };
      if (id !== undefined) {
        if (seen.current.ids.has(id)) return;
        seen.current.ids.add(id);
      }
      setCounted((prev) => ({ key: resetKey, count: (prev.key === resetKey ? prev.count : 0) + 1 }));
      onGame?.();
    },
    [onGame, resetKey],
  );

  const value = useMemo<PlayState>(
    () => ({ gamesDone, homeUnlocked: gamesDone >= UNLOCK_AFTER_GAMES, reportGame }),
    [gamesDone, reportGame],
  );

  return <PlayContext.Provider value={value}>{children}</PlayContext.Provider>;
}

/**
 * Reports one finished game each time `finished` turns true.
 *
 * The report goes through a ref so that a changing `reportGame` (it changes
 * whenever the count does) can never make the same finish count twice.
 */
export function useGameFinished(finished: boolean): void {
  const { reportGame } = usePlay();
  const report = useRef(reportGame);

  useEffect(() => {
    report.current = reportGame;
  }, [reportGame]);

  useEffect(() => {
    if (finished) report.current();
  }, [finished]);
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Hash, RotateCcw, Shuffle, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { CardArt } from '../components/CardArt';
import { MAZE_LEVELS, buildMaze, kindFor, routeEnds, stepResult } from '../data/maze';
import type { MazeKind, MazeMode, Position } from '../data/maze';
import { CHEER_PROSODY, useAudio } from '../hooks/useAudio';
import type { LetterLang } from '../hooks/useAudio';
import { useDirectionKeys } from '../hooks/useDirectionKeys';
import type { Direction } from '../hooks/useDirectionKeys';
import { mazePicture } from '../media/pictures';
import { arriveLine, chooseLine, hintLine, instructionLine, stepLine } from '../media/mazeVoice';
import { stepsFor } from '../media/voiceParts';

type LabirinScreenProps = {
  onHome: () => void;
  /** Which language letter names are spoken in - the same choice as Mengenal Huruf. */
  letterLang: LetterLang;
};

/** How long the "look here" glow stays on the right tile after a wrong tap. */
const HINT_MS = 2600;
/** How long a wrong tile wiggles. */
const WIGGLE_MS = 500;

const CHOICES: { mode: MazeMode; title: string; glyph: string; icon: LucideIcon; theme: string }[] = [
  { mode: 'letters', title: 'Huruf', glyph: 'A B C', icon: Type, theme: 'from-rose-500 to-red-600' },
  { mode: 'numbers', title: 'Angka', glyph: '1 2 3', icon: Hash, theme: 'from-sky-600 to-blue-700' },
  { mode: 'random', title: 'Acak', glyph: 'A 2 C', icon: Shuffle, theme: 'from-violet-600 to-purple-700' },
];

/**
 * Labirin - follow the sequence to the treat.
 *
 * First the child (or the grown-up beside them) picks what the way is lined
 * with: Huruf, Angka, or Acak - which flips a coin for every maze. Then the
 * maze begins with the first label showing, and the first tap *is* the start.
 *
 * The way through is lined with consecutive letters or numbers, and the child
 * taps the neighbouring tile that comes next. Side tiles carry labels that are
 * not in the sequence. A tap on one of those is answered with a soft sound, a
 * wiggle, and a spoken "Cari huruf be!" - a nudge back towards the answer,
 * never a penalty - and the right tile glows for a moment.
 *
 * The glow appears only *after* a wrong tap. Shown from the start it would
 * point at the answer at every fork and there would be nothing to work out.
 */
export function LabirinScreen({ onHome, letterLang }: LabirinScreenProps) {
  const { playVoice, praiseStep, playPop, playChime, playNudge, playTap } = useAudio();

  /** What the child chose; null while they are still choosing. */
  const [mode, setMode] = useState<MazeMode | null>(null);
  /** What *this* maze is lined with. Fixed by the choice, except for "Acak". */
  const [kind, setKind] = useState<MazeKind>('numbers');

  const [levelIndex, setLevelIndex] = useState(0);
  /** Bumped on a reset, so the instruction is spoken again. */
  const [attempt, setAttempt] = useState(0);
  /** Has the first tile been tapped? Until then the animal is a small badge, not on the move. */
  const [started, setStarted] = useState(false);
  /** Where on the route the animal is standing. */
  const [at, setAt] = useState(0);
  const [hint, setHint] = useState(false);
  const [wiggling, setWiggling] = useState<number | null>(null);

  const level = MAZE_LEVELS[levelIndex % MAZE_LEVELS.length];
  const maze = useMemo(() => buildMaze(level, kind), [level, kind]);
  const { hero, treat } = level;

  const lastIndex = maze.route.length - 1;
  const done = started && at === lastIndex;
  const [first, last] = routeEnds(level, kind);
  const noun = kind === 'letters' ? 'Huruf' : 'Angka';

  // The choice is spoken, not just shown: a pre-reader cannot read "Huruf".
  useEffect(() => {
    if (mode !== null) return;
    playVoice(stepsFor(chooseLine()));
  }, [mode, playVoice]);

  // So is the way through: "Ikuti huruf dari a sampai e!"
  useEffect(() => {
    if (mode === null) return;
    playVoice(stepsFor(instructionLine(level, kind, letterLang)));
  }, [mode, levelIndex, attempt, level, kind, letterLang, playVoice]);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(false), HINT_MS);
    return () => window.clearTimeout(id);
  }, [hint]);

  useEffect(() => {
    if (wiggling === null) return;
    const id = window.setTimeout(() => setWiggling(null), WIGGLE_MS);
    return () => window.clearTimeout(id);
  }, [wiggling]);

  const choose = useCallback(
    (picked: MazeMode) => {
      playTap();
      setMode(picked);
      setKind(kindFor(picked));
      setLevelIndex(0);
      setAt(0);
      setStarted(false);
      setHint(false);
    },
    [playTap],
  );

  /** The first tile was tapped: the animal steps out onto it and says what it is. */
  const start = useCallback(() => {
    setStarted(true);
    playPop();
    playVoice(stepsFor(stepLine(kind, level.from, letterLang)));
  }, [kind, letterLang, level.from, playPop, playVoice]);

  const tapAt = useCallback(
    (target: Position) => {
      if (mode === null || done) return;

      if (!started) {
        // Only the first tile starts the game. Everything else waits.
        const origin = maze.route[0];
        if (target.row === origin.row && target.col === origin.col) start();
        return;
      }

      const result = stepResult(maze, at, target);
      if (result === 'ignore') return;

      if (result === 'wrong') {
        playNudge();
        setWiggling(target.row * maze.cols + target.col);
        setHint(true);
        playVoice(stepsFor(hintLine(kind, level.from + at + 1, letterLang)));
        return;
      }

      const next = at + 1;
      setAt(next);
      setHint(false);
      playPop();

      if (next === lastIndex) {
        // Arrived. The chime is a separate audio channel, so it rings under
        // the cheer; the cheer and the praise share one uninterrupted run.
        playChime();
        playVoice([
          ...stepsFor(arriveLine(kind, level.from + next, letterLang), CHEER_PROSODY),
          praiseStep(),
        ]);
      } else {
        playVoice(stepsFor(stepLine(kind, level.from + next, letterLang)));
      }
    },
    [
      at, done, kind, lastIndex, letterLang, level.from, maze, mode, playChime, playNudge, playPop, playVoice,
      praiseStep, start, started,
    ],
  );

  const handleKey = useCallback(
    (direction: Direction) => {
      if (mode === null || done) return;
      // On a keyboard the first arrow press is the first tap: it starts the
      // maze without moving, exactly as tapping the first tile would.
      if (!started) {
        start();
        return;
      }
      const here = maze.route[at];
      tapAt({ row: here.row + direction.row, col: here.col + direction.col });
    },
    [at, done, maze, mode, start, started, tapAt],
  );
  useDirectionKeys(handleKey);

  const handleReset = useCallback(() => {
    playTap();
    setAt(0);
    setStarted(false);
    setHint(false);
    setAttempt((a) => a + 1);
  }, [playTap]);

  const handleNext = useCallback(() => {
    playTap();
    setAt(0);
    setStarted(false);
    setHint(false);
    setLevelIndex((i) => i + 1);
    // "Acak" flips its coin again for every maze; a fixed choice stays put.
    if (mode !== null) setKind(kindFor(mode));
  }, [mode, playTap]);

  /* ---------------------------------------------------------------- */
  /* Choosing                                                          */
  /* ---------------------------------------------------------------- */

  if (mode === null) {
    return (
      <ScreenFrame title="Labirin" onHome={onHome} caption="Pilih dulu, lalu mulai">
        <div role="group" aria-label="Pilih isi labirin" className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row">
          {CHOICES.map((choice) => {
            const Icon = choice.icon;
            return (
              <button
                key={choice.mode}
                type="button"
                onClick={() => choose(choice.mode)}
                className={`toddler-tap flex h-36 w-full flex-col items-center justify-center gap-2 rounded-[2.5rem] bg-gradient-to-br ${choice.theme} px-3 text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:h-56 sm:flex-1`}
              >
                <Icon aria-hidden="true" className="size-9 sm:size-14" strokeWidth={2.2} />
                <span aria-hidden="true" className="text-3xl font-black tracking-wide drop-shadow-sm sm:text-4xl">
                  {choice.glyph}
                </span>
                <span className="text-lg font-bold sm:text-xl">{choice.title}</span>
              </button>
            );
          })}
        </div>
      </ScreenFrame>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Playing                                                           */
  /* ---------------------------------------------------------------- */

  const heroPicture = mazePicture(hero.name);
  const treatPicture = mazePicture(treat.name);

  const caption = done
    ? `${hero.name} dapat ${treat.name.toLowerCase()}!`
    : started
      ? `Ikuti ${noun.toLowerCase()} ${first} sampai ${last}`
      : `Ketuk ${first} untuk mulai`;

  return (
    <ScreenFrame title="Labirin" onHome={onHome} caption={caption}>
      {done && (
        <Celebration
          key={`${levelIndex}-${attempt}`}
          headline="Hore!"
          subline={`${hero.name} dapat ${treat.name.toLowerCase()}!`}
        />
      )}

      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        {/* The whole sequence, so the order is always in view. */}
        <ol aria-label="Urutan" className="flex flex-wrap justify-center gap-1.5">
          {maze.route.map((p, i) => {
            const cell = maze.cells[p.row * maze.cols + p.col];
            const label = cell.type === 'path' ? cell.label : '';
            return (
              <li
                key={i}
                className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-sm font-black ${
                  started && i < at
                    ? 'bg-emerald-200 text-emerald-800'
                    : started && i === at
                      ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-500'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {label}
              </li>
            );
          })}
        </ol>

        <div
          role="group"
          aria-label="Papan labirin"
          // A 5-wide board is the tightest thing on a phone, and every pixel of
          // padding or gap comes straight off a tile. Trim them there so the
          // tiles stay a comfortable size for small fingers.
          className={`grid w-full rounded-3xl bg-emerald-100 shadow-inner ring-2 ring-emerald-200 ${
            maze.cols >= 5 ? 'gap-1.5 p-2' : 'gap-2 p-2.5'
          }`}
          style={{
            gridTemplateColumns: `repeat(${maze.cols}, minmax(0, 1fr))`,
            maxWidth: `${maze.cols * 6.5}rem`,
          }}
        >
          {maze.cells.map((cell, i) => {
            if (cell.type === 'wall') {
              return <div key={i} aria-hidden="true" className="aspect-square rounded-2xl bg-emerald-300/50" />;
            }

            const position = { row: Math.floor(i / maze.cols), col: i % maze.cols };
            const onRoute = cell.type === 'path';
            const index = onRoute ? cell.index : -1;

            // The animal is "on the move" only once the first tile has been tapped.
            const isHero = started && onRoute && index === at;
            const isVisited = started && onRoute && index < at;
            const isFinish = onRoute && index === lastIndex;
            const isHinted = hint && onRoute && index === at + 1;
            // Before that, the first tile is the one to tap: label showing, animal small.
            const isWaitingStart = !started && onRoute && index === 0;

            const state = isHero
              ? `, ada ${hero.name.toLowerCase()}`
              : isWaitingStart
                ? ', ketuk untuk mulai'
                : isVisited
                  ? ', sudah dilewati'
                  : isFinish
                    ? `, ada ${treat.name.toLowerCase()}`
                    : '';

            // Route tiles and dead ends look alike on purpose; only the animal,
            // the trail behind it and the treat set a tile apart.
            const tone = isHero
              ? 'bg-gradient-to-br from-amber-100 to-amber-300 ring-amber-500'
              : isVisited
                ? 'bg-emerald-100 text-emerald-700 ring-emerald-400'
                : isFinish
                  ? 'bg-amber-50 text-amber-700 ring-amber-400'
                  : kind === 'letters'
                    ? 'bg-white text-rose-600 ring-rose-200 hover:bg-rose-50'
                    : 'bg-white text-sky-700 ring-sky-200 hover:bg-sky-50';

            return (
              <button
                key={i}
                type="button"
                onClick={() => tapAt(position)}
                aria-label={`${noun} ${cell.label}${state}`}
                data-hint={isHinted ? 'true' : undefined}
                data-start={isWaitingStart ? 'true' : undefined}
                // Exactly one ring width, and an `!` colour for the glow: two ring
                // classes on one element would be settled by CSS source order,
                // not by what was meant. The first tile bobs until it is tapped -
                // "start here" - which says nothing about where the route goes.
                className={`toddler-tap relative flex aspect-square items-center justify-center rounded-2xl text-3xl font-black shadow-md outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:text-4xl ${tone} ${
                  isHinted || isWaitingStart ? 'animate-gentle-bob ring-4 ring-amber-400!' : 'ring-2'
                } ${wiggling === i ? 'animate-wiggle' : ''}`}
              >
                {isHero ? (
                  <>
                    <CardArt
                      icon={hero.icon}
                      picture={heroPicture}
                      className={`animate-pop-in size-3/5 ${hero.color}`}
                      strokeWidth={2}
                    />
                    {/* Standing on the finish: the treat is theirs now. */}
                    {isFinish && (
                      <CardArt
                        icon={treat.icon}
                        picture={treatPicture}
                        className={`absolute top-1 right-1 size-1/4 ${treat.color}`}
                        strokeWidth={2.4}
                      />
                    )}
                  </>
                ) : isFinish ? (
                  <CardArt
                    icon={treat.icon}
                    picture={treatPicture}
                    className={`size-3/5 ${treat.color}`}
                    strokeWidth={2}
                  />
                ) : (
                  cell.label
                )}

                {/* Waiting to start: the label stays the big thing, and the animal
                    sits small in the corner. It grows and moves to the middle only
                    once this tile is tapped. */}
                {isWaitingStart && (
                  <CardArt
                    icon={hero.icon}
                    picture={heroPicture}
                    className={`absolute top-1 right-1 size-1/4 ${hero.color}`}
                    strokeWidth={2.4}
                  />
                )}

                {/* A tile showing a picture still says which letter or number it is. */}
                {(isHero || isFinish) && (
                  <span aria-hidden="true" className="absolute bottom-0.5 left-1.5 text-xs font-black opacity-70">
                    {cell.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4">
          {at > 0 && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Ulangi labirin"
              className="toddler-tap flex size-20 items-center justify-center rounded-3xl bg-white text-slate-600 shadow-lg ring-2 ring-slate-200 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95"
            >
              <RotateCcw className="size-9" strokeWidth={2.6} />
            </button>
          )}

          {done && (
            <button
              type="button"
              onClick={handleNext}
              aria-label="Labirin berikutnya"
              className="toddler-tap flex h-20 items-center justify-center gap-3 rounded-3xl bg-emerald-500 px-8 text-2xl font-black text-white shadow-xl outline-none hover:bg-emerald-600 focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95"
            >
              <Check className="size-8" strokeWidth={3} />
              Lanjut
              <ArrowRight className="size-8" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

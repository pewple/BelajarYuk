import { useCallback, useMemo, useState } from 'react';
import { Hash, RotateCcw, Shuffle, Type } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { CardArt } from '../components/CardArt';
import { ModeChooser } from '../components/ModeChooser';
import type { ModeChoice } from '../components/ModeChooser';
import { IconButton, NextButton } from '../components/RoundButtons';
import { ScriptToggle } from '../components/ScriptToggle';
import { MAZE_LEVELS, buildMaze, isFork, kindFor, routeEnds, stepResult } from '../data/maze';
import { dueForReview, mazeItemKey, mazeItemPrefix, recordResult } from '../data/review';
import type { Script } from '../data/scripts';
import type { MazeKind, MazeMode, Position } from '../data/maze';
import { CHEER_PROSODY } from '../audio/voice';
import { useAudio } from '../hooks/useAudio';
import type { LetterLang } from '../audio/words';
import { useDirectionKeys } from '../hooks/useDirectionKeys';
import { useHints } from '../hooks/useHints';
import { useFlash } from '../hooks/useFlash';
import { useInstruction } from '../hooks/useInstruction';
import { useTapLock } from '../hooks/useTapLock';
import { useGameFinished } from '../state/play';
import type { Direction } from '../hooks/useDirectionKeys';
import { mazePicture } from '../media/pictures';
import { arriveLine, chooseLine, hintLine, instructionLine, stepLine } from '../media/mazeVoice';
import { stepsFor } from '../media/voiceParts';

type LabirinScreenProps = {
  onHome: () => void;
  /** Which language letter names are spoken in - the same choice as Mengenal Huruf. */
  letterLang: LetterLang;
  /** Latin or Arabic: what the tiles are written with, and which names are spoken. */
  script: Script;
  onScriptChange: (next: Script) => void;
};

/** How long the "look here" glow stays on the right tile after a wrong tap. */
const HINT_MS = 2600;
/** How long a wrong tile wiggles. */
const WIGGLE_MS = 500;

const CHOICES: ModeChoice<MazeMode>[] = [
  { id: 'letters', title: 'Huruf', glyph: 'A B C', icon: Type, theme: 'from-rose-500 to-red-600' },
  { id: 'numbers', title: 'Angka', glyph: '1 2 3', icon: Hash, theme: 'from-sky-600 to-blue-700' },
  { id: 'random', title: 'Acak', glyph: 'A 2 C', icon: Shuffle, theme: 'from-violet-600 to-purple-700' },
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
export function LabirinScreen({ onHome, letterLang, script, onScriptChange }: LabirinScreenProps) {
  const { playVoice, praiseStep, playPop, playChime, playNudge, playTap } = useAudio();
  const { guided, record } = useHints('labirin');
  const once = useTapLock();

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
  // Each goes back to rest by itself: the glow on the right tile, the wrong tile's wiggle.
  const [hint, setHint] = useFlash(false, HINT_MS);
  const [wiggling, setWiggling] = useFlash<number | null>(null, WIGGLE_MS);

  const level = MAZE_LEVELS[levelIndex % MAZE_LEVELS.length];

  // Letters or numbers the child has fumbled before turn up as dead ends in
  // this maze. Worked out once per maze - not on every tap, which would
  // reshuffle the board under their finger as the review book changes.
  const review = useMemo(
    () =>
      mode === null
        ? []
        : dueForReview(mazeItemPrefix(kind, script)).map((key) => Number(key.split(':').pop())),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new maze, not a new tap
    [mode, levelIndex, kind, script],
  );
  const maze = useMemo(() => buildMaze(level, kind, script, review), [level, kind, script, review]);
  const { hero, treat } = level;
  const arabic = script === 'arab';

  const lastIndex = maze.route.length - 1;
  const done = started && at === lastIndex;
  const [first, last] = routeEnds(level, kind, script);
  const noun = kind === 'letters' ? 'Huruf' : 'Angka';

  useGameFinished(done);

  const sayChoose = useCallback(() => playVoice(stepsFor(chooseLine())), [playVoice]);
  const sayInstruction = useCallback(
    () => playVoice(stepsFor(instructionLine(level, kind, letterLang, script))),
    [kind, letterLang, level, playVoice, script],
  );

  // The choice is spoken, not just shown - a pre-reader cannot read "Huruf" -
  // and so is the way through: "Ikuti huruf dari a sampai e!" A child who goes
  // quiet hears it once more. The way through is said again when anything it is
  // made of changes (the level, the kind, the language, the script).
  const repeat = mode === null ? sayChoose : sayInstruction;
  useInstruction(
    repeat,
    mode === null ? 'choose' : `${mode}|${levelIndex}|${attempt}|${kind}|${letterLang}|${script}`,
    { idleKey: `${mode}-${levelIndex}-${attempt}`, active: !done },
  );

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
    playVoice(stepsFor(stepLine(kind, level.from, letterLang, script)));
  }, [kind, letterLang, level.from, playPop, playVoice, script]);

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

      // Only a real fork - a dead end beside the animal - is a choice worth
      // counting. Where the way on is the only way, getting it right proves nothing.
      // The same choice feeds both the hint level and the review book, which
      // files it under the letter or number that was being looked for.
      if (isFork(maze, at)) {
        record(result === 'advance');
        recordResult(mazeItemKey(kind, script, level.from + at + 1), result === 'advance');
      }

      if (result === 'wrong') {
        playNudge();
        setWiggling(target.row * maze.cols + target.col);
        setHint(true);
        playVoice(stepsFor(hintLine(kind, level.from + at + 1, letterLang, script)));
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
          ...stepsFor(arriveLine(kind, level.from + next, letterLang, script), CHEER_PROSODY),
          praiseStep(),
        ]);
      } else {
        playVoice(stepsFor(stepLine(kind, level.from + next, letterLang, script)));
      }
    },
    [
      at, done, kind, lastIndex, letterLang, level.from, maze, mode, playChime, playNudge, playPop, playVoice,
      praiseStep, record, script, start, started,
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
      <ScreenFrame title="Labirin" onHome={onHome} onRepeat={repeat} caption="Pilih dulu, lalu mulai">
        <ModeChooser label="Pilih isi labirin" choices={CHOICES} onChoose={choose} />

        <div className="mt-8">
          <ScriptToggle value={script} onChange={onScriptChange} />
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
    <ScreenFrame title="Labirin" onHome={onHome} onRepeat={repeat} caption={caption}>
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
                className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 font-black ${
                  arabic ? 'font-arabic text-xl' : 'text-sm'
                } ${
                  started && i < at
                    ? 'bg-emerald-200 text-emerald-800'
                    : started && i === at
                      ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-500'
                      : 'bg-slate-200 text-slate-600'
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
            // Guided: the way on always glows. Independent: only after a wrong tap.
            const isHinted = started && (hint || guided) && onRoute && index === at + 1;
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
                onClick={() => once(`tile-${i}`, () => tapAt(position))}
                aria-label={`${noun} ${cell.label}${state}`}
                data-hint={isHinted ? 'true' : undefined}
                data-start={isWaitingStart ? 'true' : undefined}
                // Exactly one ring width, and an `!` colour for the glow: two ring
                // classes on one element would be settled by CSS source order,
                // not by what was meant. The first tile bobs until it is tapped -
                // "start here" - which says nothing about where the route goes.
                lang={arabic ? 'ar' : undefined}
                // Arabic letters are drawn shorter than Latin ones at the same
                // font size, so they get a larger size to read as equally big.
                className={`toddler-tap relative flex aspect-square items-center justify-center rounded-2xl font-black shadow-md outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 ${
                  arabic ? 'font-arabic text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl'
                } ${tone} ${
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
                ) : (
                  cell.label
                )}

                {/* The finish, like the start, keeps its label as the big thing:
                    the treat sits small in the corner until the animal arrives. */}
                {isFinish && !isHero && (
                  <CardArt
                    icon={treat.icon}
                    picture={treatPicture}
                    className={`absolute top-1 right-1 size-1/4 ${treat.color}`}
                    strokeWidth={2.4}
                  />
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

                {/* The animal's tile shows a picture, but still says which letter or number it is. */}
                {isHero && (
                  <span
                    aria-hidden="true"
                    className={`absolute font-black ${
                      arabic ? 'bottom-0 left-2 text-xl leading-none' : 'bottom-0.5 left-1.5 text-xs'
                    }`}
                  >
                    {cell.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4">
          {at > 0 && <IconButton label="Ulangi labirin" icon={RotateCcw} onClick={() => once('reset', handleReset)} />}

          {done && <NextButton label="Labirin berikutnya" onClick={() => once('next', handleNext)} />}
        </div>
      </div>
    </ScreenFrame>
  );
}

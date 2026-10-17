import { useCallback, useMemo, useState } from 'react';
import { Box, Rows3, Shuffle } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { ModeChooser } from '../components/ModeChooser';
import type { ModeChoice } from '../components/ModeChooser';
import { NextButton } from '../components/RoundButtons';
import { PolaBox } from '../components/PolaBox';
import { PolaToken } from '../components/PolaToken';
import { LEVELS, TOKENS, buildRound, fullPattern, kindFor } from '../data/pola';
import type { PolaKind, PolaMode, TokenId } from '../data/pola';
import { POLA_PREFIX, dueForReview, polaItemKey, recordResult, reviewOrder } from '../data/review';
import { CHEER_PROSODY } from '../audio/voice';
import { useAudio } from '../hooks/useAudio';
import { useHints } from '../hooks/useHints';
import { useFlash } from '../hooks/useFlash';
import { useInstruction, useKnowsTheDrill } from '../hooks/useInstruction';
import { useTapLock } from '../hooks/useTapLock';
import { chooseKindLine, continueLine, nameOf, patternLine, tryAgainLine } from '../media/polaVoice';
import { stepsFor } from '../media/voiceParts';
import { useGameFinished } from '../state/play';

/** How long the "look here" glow stays on the right pick after a wrong one. */
const HINT_MS = 2600;
/** How long a wrong pick wiggles. */
const WIGGLE_MS = 500;

const CHOICES: ModeChoice<PolaMode>[] = [
  { id: 'baris', title: 'Baris', glyph: '● ■ ●', icon: Rows3, theme: 'from-rose-500 to-red-600' },
  { id: 'kotak', title: 'Kotak', glyph: '▣ ▣ ▣', icon: Box, theme: 'from-sky-600 to-blue-700' },
  { id: 'acak', title: 'Acak', glyph: '● ▣ ■', icon: Shuffle, theme: 'from-violet-600 to-purple-700' },
];

/** Where a kind has got to in its own order of levels, and whether it has been played at all yet. */
type Place = { index: number; sequential: number; played: boolean };

const FRESH: Place = { index: 0, sequential: 0, played: false };

/**
 * Pola - carry the pattern on.
 *
 * First the child (or the grown-up beside them) picks what the pattern is made
 * of: Baris - a row of single shapes, Kotak - a row of boxes that each hold two
 * to four shapes, or Acak - which flips a coin for every round. Then a row
 * repeats and ends in a question mark, and the child picks what comes next from
 * a tray that never moves.
 *
 * Wrong picks get a soft sound, a wiggle and "Coba lagi!", then the right one
 * glows for a moment - the same kind, gentle correction as the maze. A new child
 * has the right pick glowing from the start, and that help fades as they get it
 * right (see data/hints.ts).
 *
 * Getting it right says the whole row aloud, so the child hears the rhythm of
 * the pattern - "merah, biru, merah, biru, merah!" - not just one word.
 */
export function PolaScreen({ onHome }: { onHome: () => void }) {
  const { playVoice, praiseStep, playPop, playChime, playNudge, playTap } = useAudio();
  const { guided, record } = useHints('pola');
  const knowsTheDrill = useKnowsTheDrill();
  const once = useTapLock();

  /** What the child chose; null while they are still choosing. */
  const [mode, setMode] = useState<PolaMode | null>(null);
  /** What *this* round is made of. Fixed by the choice, except for "Acak". */
  const [kind, setKind] = useState<PolaKind>('baris');
  /** How many rounds have been played: it decides where in the unit a row starts. */
  const [round, setRound] = useState(0);
  /** Where each kind has got to in its own fixed order of levels. */
  const [places, setPlaces] = useState<Record<PolaKind, Place>>({ baris: FRESH, kotak: FRESH });
  const [picked, setPicked] = useState<string | null>(null);
  // Each goes back to rest by itself: the glow on the right pick, the wrong pick's wiggle.
  const [hint, setHint] = useFlash(false, HINT_MS);
  const [wiggling, setWiggling] = useFlash<string | null>(null, WIGGLE_MS);

  const level = LEVELS[kind][places[kind].index];
  const current = useMemo(() => buildRound(level, round), [level, round]);
  const done = picked === current.answer;

  useGameFinished(done);

  const sayChoose = useCallback(() => playVoice(stepsFor(chooseKindLine())), [playVoice]);
  const sayContinue = useCallback(() => playVoice(stepsFor(continueLine())), [playVoice]);

  // The choice is spoken, not just shown - a pre-reader cannot read "Baris" -
  // and so is what to do. Once a few rounds are done the child knows the drill,
  // so that goes; a child who goes quiet hears it once more.
  const repeat = mode === null ? sayChoose : sayContinue;
  useInstruction(repeat, `${mode}-${round}`, {
    quiet: () => mode !== null && knowsTheDrill.current,
    active: !done,
  });

  const choose = useCallback(
    (pickedMode: PolaMode) => {
      playTap();
      setMode(pickedMode);
      const first = kindFor(pickedMode);
      setKind(first);
      setRound(0);
      setPlaces({ baris: FRESH, kotak: FRESH, [first]: { ...FRESH, played: true } });
      setPicked(null);
      setHint(false);
      setWiggling(null);
    },
    [playTap],
  );

  const pick = useCallback(
    (id: string) => {
      if (done) return;
      const right = id === current.answer;

      // The same choice feeds the hint level and the review book.
      record(right);
      recordResult(polaItemKey(level.id), right);

      if (right) {
        setPicked(id);
        setHint(false);
        playPop();
        playChime();
        playVoice([...stepsFor(patternLine(fullPattern(current), kind), CHEER_PROSODY), praiseStep()]);
      } else {
        // Not that one: a soft sound and the words, never a buzzer.
        playNudge();
        setWiggling(id);
        setHint(true);
        playVoice(stepsFor(tryAgainLine()));
      }
    },
    [current, done, kind, level.id, playChime, playNudge, playPop, playVoice, praiseStep, record],
  );

  const handleNext = useCallback(() => {
    if (mode === null) return;
    playTap();
    setPicked(null);
    setHint(false);
    setWiggling(null);

    // "Acak" flips its coin again for every round; a fixed choice stays put.
    const next = kindFor(mode);
    const levels = LEVELS[next];
    const weak = dueForReview(POLA_PREFIX).map((key) => key.slice(POLA_PREFIX.length));
    setPlaces((p) => ({
      ...p,
      // A kind that has not come up yet starts at its first level; the order only
      // moves for a kind that was actually played.
      [next]: p[next].played
        ? { ...reviewOrder(levels.length, p[next].sequential, round + 1, (i) => weak.includes(levels[i].id)), played: true }
        : { ...FRESH, played: true },
    }));
    setKind(next);
    setRound((r) => r + 1);
  }, [mode, playTap, round]);

  /* ---------------------------------------------------------------- */
  /* Choosing                                                          */
  /* ---------------------------------------------------------------- */

  if (mode === null) {
    return (
      <ScreenFrame title="Pola" onHome={onHome} onRepeat={repeat} caption="Pilih dulu, lalu mulai">
        <ModeChooser label="Pilih jenis pola" choices={CHOICES} onChoose={choose} />
      </ScreenFrame>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Playing                                                           */
  /* ---------------------------------------------------------------- */

  const boxes = kind === 'kotak';
  const answerName = nameOf(current.answer, kind);

  // A short row can have bigger things; a long one has to fit across a phone.
  const TILE = boxes
    ? 'size-16 sm:size-24'
    : current.shown.length <= 4
      ? 'size-14 sm:size-20'
      : 'size-10 sm:size-16';

  /** One thing in the row or the tray: a shape, or a box of shapes. */
  const draw = (id: string, size: string) =>
    boxes ? <PolaBox id={id} className={size} /> : <PolaToken token={TOKENS[id as TokenId]} className={size} />;

  return (
    <ScreenFrame
      title="Pola"
      onHome={onHome}
      onRepeat={repeat}
      caption={done ? 'Polanya sudah benar!' : 'Apa yang berikutnya?'}
    >
      {done && <Celebration key={round} headline="Hebat!" subline={`Berikutnya ${answerName}!`} />}

      <div className="flex w-full max-w-xl flex-col items-center gap-8">
        {/* The pattern so far, and the place where the next one goes. */}
        <ol aria-label="Pola" className="flex flex-wrap items-center justify-center gap-1 sm:gap-3">
          {current.shown.map((id, i) => (
            <li
              key={`${round}-${i}`}
              aria-label={nameOf(id, kind)}
              className={
                boxes
                  ? 'flex items-center justify-center'
                  : 'flex items-center justify-center rounded-2xl bg-white p-0.5 shadow ring-1 ring-slate-200 sm:p-1'
              }
            >
              {draw(id, TILE)}
            </li>
          ))}
          <li
            aria-label={done ? answerName : 'Yang mana berikutnya?'}
            className={`flex items-center justify-center rounded-2xl ${boxes ? '' : 'p-0.5 sm:p-1'} ${
              done && !boxes
                ? 'bg-white shadow ring-1 ring-slate-200'
                : done
                  ? ''
                  : 'border-2 border-dashed border-slate-400 bg-amber-100'
            }`}
          >
            {done ? (
              <span className="animate-pop-in">{draw(current.answer, TILE)}</span>
            ) : (
              <span aria-hidden="true" className={`flex items-center justify-center text-4xl font-black text-slate-600 ${TILE}`}>
                ?
              </span>
            )}
          </li>
        </ol>

        {/* What to pick from. The same things in the same places for every round of a level. */}
        {!done && (
          <section aria-label="Pilihan" className="flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-slate-600">Ketuk yang berikutnya</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {level.palette.map((id) => {
                const hinted = (guided || hint) && id === current.answer;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => once(`pick-${id}`, () => pick(id))}
                    aria-label={`Pilih ${nameOf(id, kind)}`}
                    data-hint={hinted ? 'true' : undefined}
                    className={`toddler-tap flex items-center justify-center rounded-[2rem] bg-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 ${
                      boxes ? 'size-28 sm:size-40' : 'size-24 sm:size-32'
                    } ${hinted ? 'animate-gentle-bob ring-4 ring-amber-400' : 'ring-2 ring-slate-200'} ${
                      wiggling === id ? 'animate-wiggle' : ''
                    }`}
                  >
                    {draw(id, boxes ? 'size-3/4' : 'size-3/5')}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {done && <NextButton label="Pola berikutnya" onClick={() => once('next', handleNext)} />}
      </div>
    </ScreenFrame>
  );
}

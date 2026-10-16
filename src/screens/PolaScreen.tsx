import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { PolaToken } from '../components/PolaToken';
import { POLA_LEVELS, TOKENS, buildRound, fullPattern } from '../data/pola';
import type { TokenId } from '../data/pola';
import { POLA_PREFIX, dueForReview, polaItemKey, recordResult, reviewOrder } from '../data/review';
import { KNOWS_THE_DRILL_AFTER } from '../data/session';
import { CHEER_PROSODY, useAudio } from '../hooks/useAudio';
import { useHints } from '../hooks/useHints';
import { useIdleReminder } from '../hooks/useIdleReminder';
import { useTapLock } from '../hooks/useTapLock';
import { continueLine, patternLine, tryAgainLine } from '../media/polaVoice';
import { stepsFor } from '../media/voiceParts';
import { useGameFinished, usePlay } from '../state/play';

/** How long the "look here" glow stays on the right shape after a wrong pick. */
const HINT_MS = 2600;
/** How long a wrong shape wiggles. */
const WIGGLE_MS = 500;


/**
 * Pola - carry the pattern on.
 *
 * A row of shapes repeats and ends in a question mark; the child picks which
 * shape comes next from a tray that never moves. Wrong picks get a soft sound,
 * a wiggle and "Coba lagi!", then the right shape glows for a moment - the same
 * kind, gentle correction as the maze. A new child has the right shape glowing
 * from the start, and that help fades as they get it right (see data/hints.ts).
 *
 * Getting it right says the whole row aloud, so the child hears the rhythm of
 * the pattern - "merah, biru, merah, biru, merah!" - not just one word.
 */
export function PolaScreen({ onHome }: { onHome: () => void }) {
  const { playVoice, praiseStep, playPop, playChime, playNudge, playTap } = useAudio();
  const { guided, record } = useHints('pola');
  const { gamesDone } = usePlay();
  const once = useTapLock();

  /** How many rounds have been played: it decides where in the unit a row starts. */
  const [round, setRound] = useState(0);
  /** Which level is showing, and where the fixed order has got to. */
  const [place, setPlace] = useState({ index: 0, sequential: 0 });
  const [picked, setPicked] = useState<TokenId | null>(null);
  const [hint, setHint] = useState(false);
  const [wiggling, setWiggling] = useState<TokenId | null>(null);

  const level = POLA_LEVELS[place.index];
  const current = useMemo(() => buildRound(level, round), [level, round]);
  const done = picked === current.answer;

  useGameFinished(done);

  // Once a few rounds are done the child knows the drill, so the opening
  // instruction goes. Held in a ref: finishing the third round must not itself
  // make the app say it.
  const knowsTheDrill = useRef(false);
  useEffect(() => {
    knowsTheDrill.current = gamesDone >= KNOWS_THE_DRILL_AFTER;
  }, [gamesDone]);

  const instruct = useCallback(() => playVoice(stepsFor(continueLine())), [playVoice]);

  useEffect(() => {
    if (!knowsTheDrill.current) instruct();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new round, nothing else
  }, [round]);

  // A child who goes quiet hears it once more.
  useIdleReminder(!done, round, instruct);

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

  const pick = useCallback(
    (id: TokenId) => {
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
        playVoice([...stepsFor(patternLine(fullPattern(current)), CHEER_PROSODY), praiseStep()]);
      } else {
        // Not that one: a soft sound and the words, never a buzzer.
        playNudge();
        setWiggling(id);
        setHint(true);
        playVoice(stepsFor(tryAgainLine()));
      }
    },
    [current, done, level.id, playChime, playNudge, playPop, playVoice, praiseStep, record],
  );

  const handleNext = useCallback(() => {
    playTap();
    setPicked(null);
    setHint(false);
    setWiggling(null);
    const weak = dueForReview(POLA_PREFIX).map((key) => key.slice(POLA_PREFIX.length));
    setPlace((p) => reviewOrder(POLA_LEVELS.length, p.sequential, round + 1, (i) => weak.includes(POLA_LEVELS[i].id)));
    setRound((r) => r + 1);
  }, [playTap, round]);

  const answerToken = TOKENS[current.answer];

  // A short row can have bigger shapes; a long one has to fit across a phone.
  const TILE = current.shown.length <= 4 ? 'size-14 sm:size-20' : 'size-10 sm:size-16';

  return (
    <ScreenFrame
      title="Pola"
      onHome={onHome}
      onRepeat={instruct}
      caption={done ? 'Polanya sudah benar!' : 'Apa yang berikutnya?'}
    >
      {done && (
        <Celebration key={round} headline="Hebat!" subline={`Berikutnya ${answerToken.name}!`} />
      )}

      <div className="flex w-full max-w-xl flex-col items-center gap-8">
        {/* The pattern so far, and the place where the next shape goes. */}
        <ol aria-label="Pola" className="flex flex-wrap items-center justify-center gap-1 sm:gap-3">
          {current.shown.map((id, i) => (
            <li
              key={`${round}-${i}`}
              aria-label={TOKENS[id].name}
              className="flex items-center justify-center rounded-2xl bg-white p-0.5 shadow ring-1 ring-slate-200 sm:p-1"
            >
              <PolaToken token={TOKENS[id]} className={TILE} />
            </li>
          ))}
          <li
            aria-label={done ? answerToken.name : 'Yang mana berikutnya?'}
            className={`flex items-center justify-center rounded-2xl p-0.5 sm:p-1 ${
              done ? 'bg-white shadow ring-1 ring-slate-200' : 'border-2 border-dashed border-slate-400 bg-amber-100'
            }`}
          >
            {done ? (
              <PolaToken token={answerToken} className={`animate-pop-in ${TILE}`} />
            ) : (
              <span aria-hidden="true" className={`flex items-center justify-center text-4xl font-black text-slate-600 ${TILE}`}>
                ?
              </span>
            )}
          </li>
        </ol>

        {/* What to pick from. The same shapes in the same places for every round of a level. */}
        {!done && (
          <section aria-label="Pilihan" className="flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-slate-600">Ketuk yang berikutnya</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {level.palette.map((id) => {
                const token = TOKENS[id];
                const hinted = (guided || hint) && id === current.answer;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => once(`pick-${id}`, () => pick(id))}
                    aria-label={`Pilih ${token.name}`}
                    data-hint={hinted ? 'true' : undefined}
                    className={`toddler-tap flex size-24 items-center justify-center rounded-[2rem] bg-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:size-32 ${
                      hinted ? 'animate-gentle-bob ring-4 ring-amber-400' : 'ring-2 ring-slate-200'
                    } ${wiggling === id ? 'animate-wiggle' : ''}`}
                  >
                    <PolaToken token={token} className="size-3/5" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {done && (
          <button
            type="button"
            onClick={() => once('next', handleNext)}
            aria-label="Pola berikutnya"
            className="toddler-tap flex h-20 items-center justify-center gap-3 rounded-3xl bg-emerald-600 px-8 text-2xl font-black text-white shadow-xl outline-none hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95"
          >
            <Check className="size-8" strokeWidth={3} />
            Lanjut
            <ArrowRight className="size-8" strokeWidth={3} />
          </button>
        )}
      </div>
    </ScreenFrame>
  );
}

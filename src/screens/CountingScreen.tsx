import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { CardArt } from '../components/CardArt';
import { ScriptToggle } from '../components/ScriptToggle';
import { COUNTING_SETS, MAX_COUNT } from '../data/curriculum';
import { formatNumeral } from '../data/scripts';
import type { Script } from '../data/scripts';
import { countingPicture } from '../media/pictures';
import { numberPart } from '../media/scriptVoice';
import { stepsFor } from '../media/voiceParts';
import { CHEER_PROSODY, numberWordId, useAudio } from '../hooks/useAudio';
import { KNOWS_THE_DRILL_AFTER } from '../data/session';
import { useIdleReminder } from '../hooks/useIdleReminder';
import { useTapLock } from '../hooks/useTapLock';
import { useGameFinished, usePlay } from '../state/play';

type CountingScreenProps = {
  onHome: () => void;
  script: Script;
  onScriptChange: (next: Script) => void;
};

/** Tile size shrinks as the set grows, but never below a generous touch target. */
function tileSize(total: number): string {
  if (total <= 3) return 'size-32 sm:size-40';
  if (total <= 6) return 'size-28 sm:size-36';
  return 'size-24 sm:size-28';
}

/**
 * Capping the row width is what decides how many objects sit on a line.
 * A wrapping flex row (rather than a fixed grid) keeps every row centred,
 * including a short final row - a lopsided set is harder for a child to
 * scan and count.
 *
 * The widths are chosen to produce shapes a toddler can subitise: 4 as a
 * 2x2 square, 6 as two rows of three, 10 as two rows of five.
 */
function rowWidth(total: number): string {
  if (total <= 2) return 'max-w-sm';
  if (total === 3) return 'max-w-xl';
  if (total === 4) return 'max-w-sm';
  if (total <= 6) return 'max-w-lg';
  return 'max-w-2xl';
}

/**
 * Berhitung 1-10 - gamified one-to-one correspondence.
 *
 * The child taps each object once. Every tap pops, greys the object out and
 * stamps it with the ordinal just spoken ("satu", "dua", "tiga"), which is
 * exactly the one-to-one correspondence practice that precedes real counting.
 * The final tap is also the cardinal answer, so the total can be announced
 * without an awkward pause.
 *
 * The numbers are written and said in the chosen script: 1 2 3 and "satu, dua,
 * tiga", or ١ ٢ ٣ and "wahid, itsnan, tsalatsah". The spoken instruction and
 * the praise stay Indonesian either way.
 */
export function CountingScreen({ onHome, script, onScriptChange }: CountingScreenProps) {
  const { speakCountPrompt, playVoice, praiseStep, playPop, playChime, playTap } = useAudio();
  const arabic = script === 'arab';
  const { gamesDone } = usePlay();
  const once = useTapLock();

  const [round, setRound] = useState(1);
  /** Tap order per object index; -1 means "not tapped yet". */
  const [order, setOrder] = useState<number[]>(() => Array<number>(1).fill(-1));
  /** Bumped whenever a fresh count begins, including a reset of the same round. */
  const [attempt, setAttempt] = useState(0);

  const set = COUNTING_SETS[(round - 1) % COUNTING_SETS.length];
  const picture = countingPicture(set.label);

  const tappedCount = useMemo(() => order.filter((o) => o > 0).length, [order]);
  const isDone = tappedCount === round;

  useGameFinished(isDone);

  // Auditory instruction at the top of a count. A pre-reader cannot read
  // "Ketuk satu per satu", so the app says what to do out loud instead. After
  // a few finished rounds the child knows the drill and it is left out - saying
  // "Ayo hitung!" before every single round would be nagging. Held in a ref so
  // finishing the third round does not itself trigger the prompt.
  const knowsTheDrill = useRef(false);
  useEffect(() => {
    knowsTheDrill.current = gamesDone >= KNOWS_THE_DRILL_AFTER;
  }, [gamesDone]);

  useEffect(() => {
    if (!knowsTheDrill.current) speakCountPrompt();
  }, [attempt, round, speakCountPrompt]);

  // A child who goes quiet mid-count hears it once more.
  useIdleReminder(!isDone, `${round}-${attempt}`, speakCountPrompt);

  const startRound = useCallback((n: number) => {
    setRound(n);
    setOrder(Array<number>(n).fill(-1));
    setAttempt((a) => a + 1);
  }, []);

  const handleTap = useCallback(
    (i: number) => {
      if (order[i] > 0) return; // already counted - ignore, no punishment sound

      const position = tappedCount + 1;
      playPop();

      setOrder((prev) => {
        const next = [...prev];
        next[i] = position;
        return next;
      });

      if (position === round) {
        // Last object: this count *is* the total, so announce it with gusto.
        //
        // The chime is Web Audio, a separate channel, so it rings *under* the
        // announcement. The praise has to share the single speech queue, so
        // it is handed over in the same call - two back-to-back `speak`s
        // would have the praise cancel the total mid-word.
        playChime();
        const total = numberPart(position, script);
        playVoice([
          ...stepsFor([{ ...total, text: `${total.text}!` }], CHEER_PROSODY),
          praiseStep(),
        ]);
      } else {
        playVoice(stepsFor([numberPart(position, script)]));
      }
    },
    [order, playChime, playPop, playVoice, praiseStep, round, script, tappedCount],
  );

  const handleReset = useCallback(() => {
    playTap();
    setOrder(Array<number>(round).fill(-1));
    setAttempt((a) => a + 1);
  }, [playTap, round]);

  const handleNext = useCallback(() => {
    playTap();
    startRound(round >= MAX_COUNT ? 1 : round + 1);
  }, [playTap, round, startRound]);

  return (
    <ScreenFrame
      title="Berhitung"
      onHome={onHome}
      onRepeat={speakCountPrompt}
      caption={`Ketuk satu per satu — ada ${formatNumeral(round, script)} ${set.label}`}
    >
      {isDone && (
        <Celebration
          key={`${round}-${tappedCount}`}
          // The big word on the card is the number itself: spelled out in
          // Latin ("TIGA"), or as the Arabic numeral (٣) - a name in Arabic
          // letters would be a lot to ask of a reader who knows only the digit.
          headline={arabic ? formatNumeral(round, script) : numberWordId(round).toUpperCase()}
          subline={`Ada ${formatNumeral(round, script)} ${set.label}!`}
        />
      )}

      {/* Answer badge: a question mark until the count is finished, so the
          numeral arrives as the reward rather than as a spoiler. */}
      <div
        className={`mb-6 flex size-24 items-center justify-center rounded-3xl text-6xl font-black shadow-lg transition-colors sm:size-28 sm:text-7xl ${
          isDone
            ? 'bg-emerald-600 text-white'
            : 'animate-gentle-bob bg-white text-slate-500 ring-2 ring-slate-200'
        } ${arabic ? 'font-arabic' : ''}`}
        aria-live="polite"
        aria-label={isDone ? `Jumlahnya ${round}` : 'Ada berapa?'}
      >
        {isDone ? formatNumeral(round, script) : '?'}
      </div>

      <div
        className={`flex w-full flex-wrap items-center justify-center gap-3 sm:gap-5 ${rowWidth(round)}`}
        role="group"
        aria-label={`Hitung ${set.label}`}
      >
        {order.map((position, i) => {
          const counted = position > 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => once(`object-${i}`, () => handleTap(i))}
              disabled={counted}
              aria-label={counted ? `${set.label} ke-${position}, sudah dihitung` : `Hitung ${set.label}`}
              className={`toddler-tap relative flex ${tileSize(round)} shrink-0 items-center justify-center rounded-[1.75rem] shadow-lg ring-2 ring-slate-200 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 ${
                counted ? 'scale-90 bg-slate-100' : 'bg-white hover:bg-slate-50 active:scale-95'
              }`}
            >
              {/* Only the object fades. The tally badge stays vivid - it is
                  the reward, and must not be dimmed along with it. */}
              <CardArt
                icon={set.icon}
                picture={picture}
                // A photo cannot be recoloured, so a counted one is faded
                // with opacity instead. The tally badge sits outside this
                // element and keeps its full colour either way.
                className={`size-3/5 transition ${
                  counted ? (picture ? 'opacity-30' : 'text-slate-300') : set.color
                }`}
                strokeWidth={1.8}
              />

              {counted && (
                <span
                  aria-hidden="true"
                  className={`animate-pop-in absolute -top-2 -right-2 flex size-9 items-center justify-center rounded-full bg-emerald-700 text-lg font-black text-white shadow-md sm:size-10 sm:text-xl ${
                    arabic ? 'font-arabic' : ''
                  }`}
                >
                  {formatNumeral(position, script)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={() => once('reset', handleReset)}
          aria-label="Ulangi hitungan"
          className="toddler-tap flex size-20 items-center justify-center rounded-3xl bg-white text-slate-600 shadow-lg ring-2 ring-slate-200 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95"
        >
          <RotateCcw className="size-9" strokeWidth={2.6} />
        </button>

        <button
          type="button"
          onClick={() => once('next', handleNext)}
          aria-label={round >= MAX_COUNT ? 'Mulai lagi dari satu' : `Lanjut ke angka ${round + 1}`}
          className={`toddler-tap flex h-20 items-center justify-center gap-3 rounded-3xl px-8 text-2xl font-black text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 ${
            isDone ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-500 hover:bg-slate-600'
          }`}
        >
          {isDone ? <Check className="size-8" strokeWidth={3} /> : null}
          Lanjut
          <ArrowRight className="size-8" strokeWidth={3} />
        </button>
      </div>

      <div className="mt-6">
        <ScriptToggle value={script} onChange={onScriptChange} />
      </div>
    </ScreenFrame>
  );
}
